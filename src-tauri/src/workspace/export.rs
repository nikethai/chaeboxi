//! Native Save As export. Renderer never supplies a destination path.

use super::authority::WorkspaceRuntime;
use super::budgets::{EXPORT_MANIFEST_TTL_MS, EXPORT_MAX_BYTES, EXPORT_MAX_DEPTH, EXPORT_MAX_FILES, READ_MAX_BYTES};
use super::error::{
    enospc, feature_disabled, hard_denied, limit_exceeded, stale_capability, WorkspaceError, CONFLICT, EXPORT_CONFLICT,
    PERMISSION_DENIED,
};
use super::ignore::{is_hard_denied, IgnoreStack};
use super::path::{content_revision, RelativePath};
use super::suite_state::{ArtifactRecord, ExportFile, ExportManifest};
use super::traverse::{list_children, read_file_limited};
use serde_json::{json, Value};
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::Path;
use uuid::Uuid;

impl WorkspaceRuntime {
    pub fn prepare_workspace_export(
        &self,
        capability_id: &str,
        window_label: &str,
        selection: &Value,
    ) -> Result<Value, WorkspaceError> {
        if !self.rollout().export {
            return Err(feature_disabled("export"));
        }
        let (root, project_id, generation, _) = self.lookup_cap(capability_id, window_label)?;
        let kind = selection.get("kind").and_then(|v| v.as_str()).unwrap_or("selection");
        if kind != "selection" && kind != "snapshot" {
            return Err(super::error::unauthorized_root("Unknown export selection"));
        }
        if selection.get("destination").is_some() || selection.get("destinationPath").is_some() {
            return Err(super::error::unauthorized_root("Renderer destination paths are rejected"));
        }
        let mut files = Vec::new();
        let mut excluded = 0usize;
        let mut total = 0u64;
        if kind == "snapshot" {
            self.walk_export(&root, &RelativePath { components: vec![] }, 0, &mut files, &mut excluded, &mut total)?;
        } else {
            let paths = selection
                .get("relativePaths")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            for p in paths {
                let Some(rel) = p.as_str() else { continue };
                if is_hard_denied(rel) {
                    excluded += 1;
                    continue;
                }
                match self.collect_one(&root, rel, &mut files, &mut total) {
                    Ok(()) => {}
                    Err(_) => excluded += 1,
                }
            }
        }
        if files.len() > EXPORT_MAX_FILES || total > EXPORT_MAX_BYTES {
            return Err(limit_exceeded("Export exceeds file or byte quota"));
        }
        let id = Uuid::new_v4().to_string();
        let manifest = ExportManifest {
            id: id.clone(),
            capability_id: capability_id.to_string(),
            project_id,
            root_generation: generation.clone(),
            kind: kind.to_string(),
            files,
            excluded,
            total_bytes: total,
            expires_at: WorkspaceRuntime::now_ms() + EXPORT_MANIFEST_TTL_MS,
            artifact_id: None,
        };
        let preview = json!({
            "manifestId": id,
            "kind": kind,
            "included": manifest.files.len(),
            "excluded": excluded,
            "totalBytes": total,
            "rootGeneration": generation,
            "expiresAt": manifest.expires_at,
        });
        if let Ok(mut suite) = self.suite.lock() {
            suite.exports.insert(id, manifest);
        }
        Ok(preview)
    }

    pub fn prepare_app_artifact_export(
        &self,
        artifact_id: &str,
        window_label: &str,
    ) -> Result<Value, WorkspaceError> {
        if !self.rollout().export {
            return Err(feature_disabled("export"));
        }
        Self::require_main(window_label)?;
        if artifact_id.contains('/') || artifact_id.contains('\\') || artifact_id.contains("..") {
            return Err(super::error::unauthorized_root("Artifact IDs cannot be filesystem paths"));
        }
        let mut suite = self.suite.lock().map_err(|_| {
            WorkspaceError::new(PERMISSION_DENIED, "suite lock poisoned")
        })?;
        let artifact = suite
            .artifacts
            .get(artifact_id)
            .cloned()
            .ok_or_else(|| super::error::not_found(artifact_id))?;
        if artifact.expires_at < WorkspaceRuntime::now_ms() {
            return Err(stale_capability());
        }
        let id = Uuid::new_v4().to_string();
        let manifest = ExportManifest {
            id: id.clone(),
            capability_id: String::new(),
            project_id: artifact.owner_project.clone(),
            root_generation: String::new(),
            kind: "artifact".into(),
            files: vec![ExportFile {
                relative_path: artifact.filename.clone(),
                size: artifact.bytes.len() as u64,
                revision: artifact.hash.clone(),
            }],
            excluded: 0,
            total_bytes: artifact.bytes.len() as u64,
            expires_at: WorkspaceRuntime::now_ms() + EXPORT_MANIFEST_TTL_MS,
            artifact_id: Some(artifact.id.clone()),
        };
        suite.exports.insert(id.clone(), manifest);
        Ok(json!({
            "manifestId": id,
            "kind": "artifact",
            "included": 1,
            "excluded": 0,
            "totalBytes": artifact.bytes.len(),
            "filename": artifact.filename,
        }))
    }

    pub fn discard_workspace_export(&self, manifest_id: &str) -> Result<Value, WorkspaceError> {
        if let Ok(mut suite) = self.suite.lock() {
            suite.exports.remove(manifest_id);
        }
        Ok(json!({ "ok": true }))
    }

    pub fn register_artifact(
        &self,
        owner_project: &str,
        filename: &str,
        mime: &str,
        bytes: Vec<u8>,
    ) -> Result<String, WorkspaceError> {
        if bytes.len() as u64 > super::budgets::ARTIFACT_MAX_BYTES {
            return Err(limit_exceeded("Artifact exceeds size quota"));
        }
        let hash = content_revision(&bytes);
        let id = Uuid::new_v4().to_string();
        let rec = ArtifactRecord {
            id: id.clone(),
            owner_project: owner_project.to_string(),
            filename: filename.to_string(),
            mime: mime.to_string(),
            bytes,
            hash,
            expires_at: WorkspaceRuntime::now_ms() + super::budgets::ARTIFACT_TTL_MS,
        };
        if let Ok(mut suite) = self.suite.lock() {
            suite.artifacts.insert(id.clone(), rec);
        }
        Ok(id)
    }

    /// Production save: native picker owns the destination.
    pub fn export_workspace(&self, manifest_id: &str, window_label: &str) -> Result<Value, WorkspaceError> {
        Self::require_main(window_label)?;
        if !self.rollout().export {
            return Err(feature_disabled("export"));
        }
        #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
        {
            let suggested = self.suggested_export_name(manifest_id)?;
            let dest = rfd::FileDialog::new()
                .set_file_name(&suggested)
                .save_file();
            let Some(dest) = dest else {
                return Ok(json!({ "status": "cancelled" }));
            };
            return self.save_export_to(manifest_id, &dest);
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            let _ = manifest_id;
            Err(WorkspaceError::new(
                super::error::UNSUPPORTED_PLATFORM,
                "Project export is desktop-only",
            ))
        }
    }

    pub fn save_export_to(&self, manifest_id: &str, dest: &Path) -> Result<Value, WorkspaceError> {
        if !self.rollout().export {
            return Err(feature_disabled("export"));
        }
        let manifest = {
            let suite = self.suite.lock().map_err(|_| {
                WorkspaceError::new(PERMISSION_DENIED, "suite lock poisoned")
            })?;
            suite
                .exports
                .get(manifest_id)
                .cloned()
                .ok_or_else(|| stale_capability())?
        };
        if manifest.expires_at < WorkspaceRuntime::now_ms() {
            return Err(stale_capability());
        }
        if !manifest.capability_id.is_empty() {
            let (_, _, generation, _) = self.lookup_cap(&manifest.capability_id, "main")?;
            if generation != manifest.root_generation {
                return Err(WorkspaceError::new(EXPORT_CONFLICT, "Root generation changed; prepare export again"));
            }
        }
        let existing = if dest.exists() {
            fs::read(dest).ok()
        } else {
            None
        };
        let fail = self
            .suite
            .lock()
            .ok()
            .map(|s| s.fail_next_export)
            .unwrap_or(false);
        if fail {
            if let Ok(mut suite) = self.suite.lock() {
                suite.fail_next_export = false;
            }
            return Err(enospc());
        }
        let tmp = dest.with_file_name(format!(
            ".{}.chaeboxi-export-tmp",
            dest.file_name().and_then(|n| n.to_str()).unwrap_or("export")
        ));
        let write_res = self.stream_export(&manifest, &tmp);
        match write_res {
            Ok(()) => {
                if let Err(err) = fs::rename(&tmp, dest) {
                    let _ = fs::remove_file(&tmp);
                    if existing.is_some() {
                        return Err(WorkspaceError::new(PERMISSION_DENIED, format!("{err}")));
                    }
                    return Err(WorkspaceError::new(PERMISSION_DENIED, format!("{err}")));
                }
                Ok(json!({ "status": "saved" }))
            }
            Err(err) => {
                let _ = fs::remove_file(&tmp);
                if let Some(bytes) = existing {
                    let _ = fs::write(dest, bytes);
                }
                Err(err)
            }
        }
    }

    #[cfg(test)]
    pub fn fail_next_export(&self) {
        if let Ok(mut suite) = self.suite.lock() {
            suite.fail_next_export = true;
        }
    }

    fn suggested_export_name(&self, manifest_id: &str) -> Result<String, WorkspaceError> {
        let suite = self.suite.lock().map_err(|_| {
            WorkspaceError::new(PERMISSION_DENIED, "suite lock poisoned")
        })?;
        let m = suite.exports.get(manifest_id).ok_or_else(stale_capability)?;
        if m.kind == "artifact" {
            Ok(m.files.first().map(|f| f.relative_path.clone()).unwrap_or_else(|| "artifact.bin".into()))
        } else {
            Ok("project-files.zip".into())
        }
    }

    fn collect_one(
        &self,
        root: &Path,
        rel: &str,
        files: &mut Vec<ExportFile>,
        total: &mut u64,
    ) -> Result<(), WorkspaceError> {
        if is_hard_denied(rel) {
            return Err(hard_denied(rel));
        }
        let parsed = RelativePath::parse(rel)?;
        let limited = read_file_limited(root, &parsed, READ_MAX_BYTES)?;
        *total = total.saturating_add(limited.size);
        files.push(ExportFile {
            relative_path: parsed.as_display(),
            size: limited.size,
            revision: content_revision(&limited.bytes),
        });
        Ok(())
    }

    fn walk_export(
        &self,
        root: &Path,
        dir: &RelativePath,
        depth: usize,
        files: &mut Vec<ExportFile>,
        excluded: &mut usize,
        total: &mut u64,
    ) -> Result<(), WorkspaceError> {
        if depth > EXPORT_MAX_DEPTH || files.len() >= EXPORT_MAX_FILES || *total >= EXPORT_MAX_BYTES {
            return Err(limit_exceeded("Export walk exceeded quota"));
        }
        let has_git = root.join(".git").exists();
        let mut stack = IgnoreStack::new(has_git);
        self.load_ignore_chain(root, dir, &mut stack);
        let children = list_children(root, dir)?;
        for (name, is_dir, size) in children {
            let child = dir.join_child(&name)?;
            let rel = child.as_display();
            if stack.is_ignored(&rel, is_dir) || is_hard_denied(&rel) {
                *excluded += 1;
                continue;
            }
            if is_dir {
                self.walk_export(root, &child, depth + 1, files, excluded, total)?;
            } else {
                *total = total.saturating_add(size);
                files.push(ExportFile {
                    relative_path: rel,
                    size,
                    revision: String::new(),
                });
            }
        }
        Ok(())
    }

    fn stream_export(&self, manifest: &ExportManifest, tmp: &Path) -> Result<(), WorkspaceError> {
        if let Some(artifact_id) = &manifest.artifact_id {
            let suite = self.suite.lock().map_err(|_| {
                WorkspaceError::new(PERMISSION_DENIED, "suite lock poisoned")
            })?;
            let artifact = suite
                .artifacts
                .get(artifact_id)
                .ok_or_else(|| super::error::not_found(artifact_id))?;
            fs::write(tmp, &artifact.bytes).map_err(|err| map_export_io(err))?;
            return Ok(());
        }
        let (root, _, generation, _) = self.lookup_cap(&manifest.capability_id, "main")?;
        if generation != manifest.root_generation {
            return Err(WorkspaceError::new(CONFLICT, "Root generation changed during export"));
        }
        let file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(tmp)
            .map_err(map_export_io)?;
        let mut zip = zip::ZipWriter::new(file);
        let opts = zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        let mut used_names = std::collections::HashSet::new();
        for entry in &manifest.files {
            if is_hard_denied(&entry.relative_path) {
                continue;
            }
            let rel = RelativePath::parse(&entry.relative_path)?;
            let limited = read_file_limited(&root, &rel, READ_MAX_BYTES)?;
            if !entry.revision.is_empty() && content_revision(&limited.bytes) != entry.revision {
                return Err(WorkspaceError::new(EXPORT_CONFLICT, "Source changed during export"));
            }
            let name = archive_name(&entry.relative_path);
            if !used_names.insert(name.clone()) {
                return Err(WorkspaceError::new(EXPORT_CONFLICT, "Duplicate archive entry names"));
            }
            zip.start_file(&name, opts)
                .map_err(|e| WorkspaceError::new(PERMISSION_DENIED, format!("{e}")))?;
            zip.write_all(&limited.bytes).map_err(map_export_io)?;
        }
        zip.finish()
            .map_err(|e| WorkspaceError::new(PERMISSION_DENIED, format!("{e}")))?;
        Ok(())
    }
}

fn archive_name(rel: &str) -> String {
    rel.replace('\\', "/")
        .trim_start_matches('/')
        .replace('\0', "")
        .to_string()
}

fn map_export_io(err: io::Error) -> WorkspaceError {
    if err.raw_os_error() == Some(28) || err.kind() == io::ErrorKind::StorageFull {
        return enospc();
    }
    WorkspaceError::new(PERMISSION_DENIED, format!("{err}"))
}
