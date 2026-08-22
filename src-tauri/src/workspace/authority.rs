//! Private binding registry, runtime capabilities, and privileged operations.

use super::error::{
    already_exists, ambiguous_edit, cancelled, conflict, hard_denied, mutation_disabled, not_found, revoked,
    stale_capability, unauthorized_root, wrong_window, WorkspaceError, PERMISSION_DENIED,
};
use super::ignore::{gitignore_path, is_hard_denied, IgnoreStack};
use super::path::{content_revision, RelativePath};
use super::traverse::{
    create_new_exclusive, delete_file, exists_nofollow, filesystem_identity, list_children,
    read_file_bytes, write_atomic,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const MAIN_WINDOW: &str = "main";
const MAX_READ_BYTES: usize = 1024 * 1024;
const MAX_SEARCH_FILE_BYTES: usize = 5 * 1024 * 1024;
const DEFAULT_LIST_PAGE: usize = 200;
const DEFAULT_SEARCH_LIMIT: usize = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustState {
    pub files: String,
    pub instructions: String,
    pub skills_commands: String,
    pub hooks: String,
}

impl Default for TrustState {
    fn default() -> Self {
        Self {
            files: "unset".into(),
            instructions: "unset".into(),
            skills_commands: "unset".into(),
            hooks: "unset".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectBinding {
    pub project_id: String,
    pub display_path: String,
    pub filesystem_identity: String,
    pub root_generation: String,
    pub status: String,
    pub last_opened_at: i64,
    pub trust: TrustState,
    pub checksum: String,
}

impl ProjectBinding {
    fn compute_checksum(project_id: &str, display_path: &str, identity: &str, generation: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(project_id.as_bytes());
        hasher.update(display_path.as_bytes());
        hasher.update(identity.as_bytes());
        hasher.update(generation.as_bytes());
        hasher.finalize().iter().map(|b| format!("{b:02x}")).collect()
    }

    fn with_checksum(mut self) -> Self {
        self.checksum = Self::compute_checksum(
            &self.project_id,
            &self.display_path,
            &self.filesystem_identity,
            &self.root_generation,
        );
        self
    }

    fn verify(&self) -> bool {
        self.checksum
            == Self::compute_checksum(
                &self.project_id,
                &self.display_path,
                &self.filesystem_identity,
                &self.root_generation,
            )
    }
}

#[derive(Debug, Clone)]
struct RuntimeCapability {
    id: String,
    project_id: String,
    window_label: String,
    root_generation: String,
    root_path: PathBuf,
    revoked: bool,
    cancel_epoch: u64,
}

struct InFlightGuard {
    n: Arc<AtomicU64>,
}

impl Drop for InFlightGuard {
    fn drop(&mut self) {
        self.n.fetch_sub(1, Ordering::SeqCst);
    }
}

struct RequestState {
    cancelled: bool,
}

struct Inner {
    registry_path: PathBuf,
    bindings: HashMap<String, ProjectBinding>,
    capabilities: HashMap<String, RuntimeCapability>,
    requests: HashMap<String, RequestState>,
    in_flight: Arc<AtomicU64>,
}

pub struct WorkspaceRuntime {
    inner: Mutex<Inner>,
    mutation_enabled: AtomicBool,
}

impl Default for WorkspaceRuntime {
    fn default() -> Self {
        Self {
            inner: Mutex::new(Inner {
                registry_path: PathBuf::from("project-bindings.json"),
                bindings: HashMap::new(),
                capabilities: HashMap::new(),
                requests: HashMap::new(),
                in_flight: Arc::new(AtomicU64::new(0)),
            }),
            mutation_enabled: AtomicBool::new(false),
        }
    }
}

impl WorkspaceRuntime {
    #[cfg(test)]
    pub fn for_tests(registry_path: PathBuf, mutation_enabled: bool) -> Self {
        let rt = Self::default();
        if let Ok(mut inner) = rt.inner.lock() {
            inner.registry_path = registry_path;
        }
        rt.mutation_enabled.store(mutation_enabled, Ordering::SeqCst);
        rt
    }

    pub fn set_mutation_enabled(&self, enabled: bool) {
        self.mutation_enabled.store(enabled, Ordering::SeqCst);
    }

    pub fn mutation_enabled(&self) -> bool {
        self.mutation_enabled.load(Ordering::SeqCst)
    }

    pub fn open_desktop(&self, dir: &Path) -> Result<(), WorkspaceError> {
        fs::create_dir_all(dir).map_err(|e| WorkspaceError::new(PERMISSION_DENIED, format!("{e}")))?;
        let path = dir.join("project-bindings.json");
        let mut inner = self.lock()?;
        inner.registry_path = path.clone();
        if let Ok(text) = fs::read_to_string(&path) {
            if let Ok(map) = serde_json::from_str::<HashMap<String, ProjectBinding>>(&text) {
                inner.bindings = map.into_iter().filter(|(_, b)| b.verify()).collect();
            }
        }
        Ok(())
    }

    fn lock(&self) -> Result<std::sync::MutexGuard<'_, Inner>, WorkspaceError> {
        self.inner
            .lock()
            .map_err(|_| WorkspaceError::new(PERMISSION_DENIED, "workspace lock poisoned"))
    }

    fn persist(inner: &Inner) {
        if let Ok(text) = serde_json::to_string_pretty(&inner.bindings) {
            let _ = fs::write(&inner.registry_path, text);
        }
    }

    fn now_ms() -> i64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0)
    }

    fn require_main(window_label: &str) -> Result<(), WorkspaceError> {
        if window_label != MAIN_WINDOW {
            return Err(wrong_window());
        }
        Ok(())
    }

    /// Renderer-supplied path must never mint a binding. Tests call `bind_picker_result`.
    #[cfg(test)]
    pub fn reject_authorize_path(&self, _project_id: &str, _path: &str) -> Result<(), WorkspaceError> {
        Err(unauthorized_root(
            "Directory authorization requires the native folder picker; renderer paths are rejected",
        ))
    }

    /// Native picker (or test fixture) result — the only path that creates a binding.
    pub fn bind_picker_result(
        &self,
        project_id: &str,
        window_label: &str,
        root: &Path,
    ) -> Result<Value, WorkspaceError> {
        Self::require_main(window_label)?;
        if project_id.trim().is_empty() {
            return Err(unauthorized_root("projectId is required"));
        }
        let root = fs::canonicalize(root).map_err(|_| unauthorized_root("Selected folder is not accessible"))?;
        if !root.is_dir() {
            return Err(unauthorized_root("Selected path is not a directory"));
        }
        let identity = filesystem_identity(&root)?;
        let generation = Uuid::new_v4().to_string();
        let display = root.display().to_string();
        let binding = ProjectBinding {
            project_id: project_id.to_string(),
            display_path: display.clone(),
            filesystem_identity: identity,
            root_generation: generation.clone(),
            status: "ready".into(),
            last_opened_at: Self::now_ms(),
            trust: TrustState::default(),
            checksum: String::new(),
        }
        .with_checksum();

        let mut inner = self.lock()?;
        self.revoke_project_locked(&mut inner, project_id);
        inner.bindings.insert(project_id.to_string(), binding.clone());
        Self::persist(&inner);
        let cap = self.issue_capability_locked(&mut inner, project_id, window_label, &root, &generation)?;
        Ok(descriptor_json(
            project_id,
            &cap.id,
            &generation,
            &display,
            "ready",
            &binding.trust,
        ))
    }

    fn issue_capability_locked(
        &self,
        inner: &mut Inner,
        project_id: &str,
        window_label: &str,
        root: &Path,
        generation: &str,
    ) -> Result<RuntimeCapability, WorkspaceError> {
        let cap = RuntimeCapability {
            id: Uuid::new_v4().to_string(),
            project_id: project_id.to_string(),
            window_label: window_label.to_string(),
            root_generation: generation.to_string(),
            root_path: root.to_path_buf(),
            revoked: false,
            cancel_epoch: 0,
        };
        inner.capabilities.insert(cap.id.clone(), cap.clone());
        Ok(cap)
    }

    fn revoke_project_locked(&self, inner: &mut Inner, project_id: &str) {
        for cap in inner.capabilities.values_mut() {
            if cap.project_id == project_id {
                cap.revoked = true;
                cap.cancel_epoch += 1;
            }
        }
        inner.capabilities.retain(|_, cap| cap.project_id != project_id || !cap.revoked);
    }

    pub fn restore(&self, project_id: &str, window_label: &str) -> Result<Value, WorkspaceError> {
        Self::require_main(window_label)?;
        let mut inner = self.lock()?;
        let binding = inner
            .bindings
            .get(project_id)
            .cloned()
            .ok_or_else(|| unauthorized_root("No native binding exists for this project"))?;
        if !binding.verify() {
            return Err(unauthorized_root("Native binding record failed integrity check"));
        }
        let root = PathBuf::from(&binding.display_path);
        if !root.is_dir() {
            return Ok(descriptor_json(
                project_id,
                "",
                &binding.root_generation,
                &binding.display_path,
                "missing",
                &binding.trust,
            ));
        }
        let identity = filesystem_identity(&root).unwrap_or_default();
        if identity != binding.filesystem_identity {
            return Ok(descriptor_json(
                project_id,
                "",
                &binding.root_generation,
                &binding.display_path,
                "relink-required",
                &binding.trust,
            ));
        }
        let cap = self.issue_capability_locked(
            &mut inner,
            project_id,
            window_label,
            &root,
            &binding.root_generation,
        )?;
        Ok(descriptor_json(
            project_id,
            &cap.id,
            &binding.root_generation,
            &binding.display_path,
            "ready",
            &binding.trust,
        ))
    }

    pub fn relink(&self, project_id: &str, window_label: &str, root: &Path) -> Result<Value, WorkspaceError> {
        self.bind_picker_result(project_id, window_label, root)
    }

    pub fn unbind(&self, project_id: &str, window_label: &str) -> Result<(), WorkspaceError> {
        Self::require_main(window_label)?;
        let mut inner = self.lock()?;
        self.revoke_project_locked(&mut inner, project_id);
        inner.bindings.remove(project_id);
        Self::persist(&inner);
        self.wait_in_flight(&inner);
        Ok(())
    }

    pub fn revoke_project(&self, project_id: &str, window_label: &str) -> Result<(), WorkspaceError> {
        Self::require_main(window_label)?;
        let mut inner = self.lock()?;
        self.revoke_project_locked(&mut inner, project_id);
        self.wait_in_flight(&inner);
        Ok(())
    }

    pub fn revoke_window(&self, window_label: &str) {
        if let Ok(mut inner) = self.lock() {
            for cap in inner.capabilities.values_mut() {
                if cap.window_label == window_label {
                    cap.revoked = true;
                    cap.cancel_epoch += 1;
                }
            }
            inner.capabilities.retain(|_, cap| cap.window_label != window_label);
        }
    }

    fn wait_in_flight(&self, inner: &Inner) {
        let start = std::time::Instant::now();
        while inner.in_flight.load(Ordering::SeqCst) > 0 && start.elapsed().as_millis() < 2_000 {
            std::thread::yield_now();
        }
    }

    fn begin_op(&self) -> Result<InFlightGuard, WorkspaceError> {
        let inner = self.lock()?;
        inner.in_flight.fetch_add(1, Ordering::SeqCst);
        Ok(InFlightGuard {
            n: inner.in_flight.clone(),
        })
    }

    fn lookup_cap(
        &self,
        capability_id: &str,
        window_label: &str,
    ) -> Result<(PathBuf, String, String), WorkspaceError> {
        let inner = self.lock()?;
        let cap = inner
            .capabilities
            .get(capability_id)
            .ok_or_else(stale_capability)?;
        if cap.revoked {
            return Err(revoked());
        }
        if cap.window_label != window_label {
            return Err(wrong_window());
        }
        if window_label != MAIN_WINDOW {
            return Err(wrong_window());
        }
        let binding = inner.bindings.get(&cap.project_id);
        if let Some(binding) = binding {
            if binding.root_generation != cap.root_generation {
                return Err(stale_capability());
            }
        } else {
            return Err(stale_capability());
        }
        Ok((cap.root_path.clone(), cap.project_id.clone(), cap.root_generation.clone()))
    }

    pub fn set_trust(
        &self,
        project_id: &str,
        window_label: &str,
        category: &str,
        value: &str,
    ) -> Result<(), WorkspaceError> {
        Self::require_main(window_label)?;
        let mut inner = self.lock()?;
        let binding = inner
            .bindings
            .get_mut(project_id)
            .ok_or_else(|| unauthorized_root("No native binding exists for this project"))?;
        let allowed = matches!(value, "allowed" | "denied" | "unset");
        if !allowed {
            return Err(unauthorized_root("Invalid trust value"));
        }
        match category {
            "files" => binding.trust.files = value.into(),
            "instructions" => binding.trust.instructions = value.into(),
            "skillsCommands" => binding.trust.skills_commands = value.into(),
            "hooks" => binding.trust.hooks = value.into(),
            _ => return Err(unauthorized_root("Invalid trust category")),
        }
        *binding = binding.clone().with_checksum();
        Self::persist(&inner);
        Ok(())
    }

    pub fn get_trust(&self, project_id: &str) -> Option<TrustState> {
        self.lock().ok()?.bindings.get(project_id).map(|b| b.trust.clone())
    }

    pub fn read(
        &self,
        capability_id: &str,
        window_label: &str,
        relative_path: &str,
    ) -> Result<Value, WorkspaceError> {
        let _guard = self.begin_op()?;
        let (root, _, _) = self.lookup_cap(capability_id, window_label)?;
        if is_hard_denied(relative_path) {
            return Err(hard_denied(relative_path));
        }
        let rel = RelativePath::parse(relative_path)?;
        let bytes = read_file_bytes(&root, &rel)?;
        if looks_binary(&bytes) {
            return Ok(json!({
                "content": "",
                "revision": content_revision(&bytes),
                "truncated": false,
                "encoding": "binary",
                "relativePath": rel.as_display(),
                "size": bytes.len(),
            }));
        }
        let truncated = bytes.len() > MAX_READ_BYTES;
        let slice = if truncated { &bytes[..MAX_READ_BYTES] } else { &bytes };
        let content = String::from_utf8_lossy(slice).into_owned();
        Ok(json!({
            "content": content,
            "revision": content_revision(&bytes),
            "truncated": truncated,
            "encoding": "utf-8",
            "relativePath": rel.as_display(),
            "size": bytes.len(),
        }))
    }

    pub fn list(
        &self,
        capability_id: &str,
        window_label: &str,
        relative_path: &str,
        cursor: Option<&str>,
        request_id: Option<&str>,
    ) -> Result<Value, WorkspaceError> {
        let _guard = self.begin_op()?;
        if let Some(id) = request_id {
            if self.is_cancelled(id) {
                return Err(cancelled());
            }
        }
        let (root, _, generation) = self.lookup_cap(capability_id, window_label)?;
        if is_hard_denied(relative_path) {
            return Err(hard_denied(relative_path));
        }
        let rel = RelativePath::parse(relative_path)?;
        let has_git = root.join(".git").exists();
        let mut stack = IgnoreStack::new(has_git);
        self.load_ignore_chain(&root, &rel, &mut stack);
        let mut children = list_children(&root, &rel)?;
        children.sort_by(|a, b| a.0.cmp(&b.0));
        let skip = cursor.and_then(|c| c.parse::<usize>().ok()).unwrap_or(0);
        let mut entries = Vec::new();
        let mut idx = 0usize;
        for (name, is_dir, size) in children {
            let child_rel = if rel.components.is_empty() {
                name.clone()
            } else {
                format!("{}/{}", rel.as_display(), name)
            };
            if stack.is_ignored(&child_rel, is_dir) {
                continue;
            }
            if idx < skip {
                idx += 1;
                continue;
            }
            if entries.len() >= DEFAULT_LIST_PAGE {
                break;
            }
            let revision = if !is_dir {
                read_file_bytes(&root, &RelativePath::parse(&child_rel).unwrap_or(rel.clone()))
                    .ok()
                    .map(|b| content_revision(&b))
            } else {
                None
            };
            entries.push(json!({
                "name": name,
                "relativePath": child_rel,
                "kind": if is_dir { "directory" } else { "file" },
                "size": size,
                "revision": revision,
            }));
            idx += 1;
        }
        let next = if entries.len() == DEFAULT_LIST_PAGE {
            Some((skip + entries.len()).to_string())
        } else {
            None
        };
        Ok(json!({
            "entries": entries,
            "cursor": next,
            "requestId": request_id,
            "rootGeneration": generation,
        }))
    }

    fn load_ignore_chain(&self, root: &Path, rel: &RelativePath, stack: &mut IgnoreStack) {
        let mut acc = RelativePath { components: vec![] };
        if let Ok(gi) = RelativePath::parse(&gitignore_path("")) {
            if let Ok(bytes) = read_file_bytes(root, &gi) {
                if let Ok(text) = String::from_utf8(bytes) {
                    stack.push_gitignore("", &text);
                }
            }
        }
        for component in &rel.components {
            acc.components.push(component.clone());
            if let Ok(gi) = RelativePath::parse(&gitignore_path(&acc.as_display())) {
                if let Ok(bytes) = read_file_bytes(root, &gi) {
                    if let Ok(text) = String::from_utf8(bytes) {
                        stack.push_gitignore(&acc.as_display(), &text);
                    }
                }
            }
        }
    }

    pub fn search(
        &self,
        capability_id: &str,
        window_label: &str,
        query: &str,
        request_id: Option<&str>,
    ) -> Result<Value, WorkspaceError> {
        let _guard = self.begin_op()?;
        if let Some(id) = request_id {
            if self.is_cancelled(id) {
                return Err(cancelled());
            }
        }
        let q = query.trim();
        if q.is_empty() {
            return Ok(json!({ "hits": [], "requestId": request_id }));
        }
        let (root, _, _) = self.lookup_cap(capability_id, window_label)?;
        let has_git = root.join(".git").exists();
        let mut stack = IgnoreStack::new(has_git);
        if let Ok(gi) = RelativePath::parse(&gitignore_path("")) {
            if let Ok(bytes) = read_file_bytes(&root, &gi) {
                if let Ok(text) = String::from_utf8(bytes) {
                    stack.push_gitignore("", &text);
                }
            }
        }
        let mut hits = Vec::new();
        self.search_walk(
            &root,
            &RelativePath { components: vec![] },
            &mut stack,
            q,
            request_id,
            &mut hits,
        )?;
        Ok(json!({ "hits": hits, "requestId": request_id }))
    }

    fn search_walk(
        &self,
        root: &Path,
        dir: &RelativePath,
        stack: &mut IgnoreStack,
        query: &str,
        request_id: Option<&str>,
        hits: &mut Vec<Value>,
    ) -> Result<(), WorkspaceError> {
        if hits.len() >= DEFAULT_SEARCH_LIMIT {
            return Ok(());
        }
        if let Some(id) = request_id {
            if self.is_cancelled(id) {
                return Err(cancelled());
            }
        }
        let children = list_children(root, dir)?;
        for (name, is_dir, _) in children {
            if hits.len() >= DEFAULT_SEARCH_LIMIT {
                break;
            }
            let child = dir.join_child(&name)?;
            let rel = child.as_display();
            if stack.is_ignored(&rel, is_dir) {
                continue;
            }
            if name.to_ascii_lowercase().contains(&query.to_ascii_lowercase()) {
                hits.push(json!({
                    "relativePath": rel,
                    "kind": "filename",
                }));
            }
            if is_dir {
                if let Ok(gi) = RelativePath::parse(&gitignore_path(&rel)) {
                    if let Ok(bytes) = read_file_bytes(root, &gi) {
                        if let Ok(text) = String::from_utf8(bytes) {
                            stack.push_gitignore(&rel, &text);
                        }
                    }
                }
                self.search_walk(root, &child, stack, query, request_id, hits)?;
            } else if let Ok(bytes) = read_file_bytes(root, &child) {
                if bytes.len() <= MAX_SEARCH_FILE_BYTES && !looks_binary(&bytes) {
                    if let Ok(text) = String::from_utf8(bytes) {
                        for (i, line) in text.lines().enumerate() {
                            if line.to_ascii_lowercase().contains(&query.to_ascii_lowercase()) {
                                hits.push(json!({
                                    "relativePath": rel,
                                    "kind": "content",
                                    "line": i + 1,
                                    "excerpt": line.chars().take(200).collect::<String>(),
                                }));
                                break;
                            }
                        }
                    }
                }
            }
        }
        Ok(())
    }

    pub fn cancel_request(&self, request_id: &str) {
        if let Ok(mut inner) = self.lock() {
            inner.requests.insert(request_id.to_string(), RequestState { cancelled: true });
        }
    }

    fn is_cancelled(&self, request_id: &str) -> bool {
        self.lock()
            .ok()
            .and_then(|inner| inner.requests.get(request_id).map(|r| r.cancelled))
            .unwrap_or(false)
    }

    pub fn create_file(
        &self,
        capability_id: &str,
        window_label: &str,
        relative_path: &str,
        content: &str,
        mode: &str,
        expected_revision: Option<&str>,
    ) -> Result<Value, WorkspaceError> {
        self.mutate(capability_id, window_label, |root| {
            if is_hard_denied(relative_path) {
                return Err(hard_denied(relative_path));
            }
            let rel = RelativePath::parse(relative_path)?;
            let exists = exists_nofollow(root, &rel);
            if mode != "overwrite" && exists {
                return Err(already_exists(&rel.as_display()));
            }
            if mode == "overwrite" {
                if !exists {
                    return Err(not_found(&rel.as_display()));
                }
                let expected = expected_revision.filter(|s| !s.is_empty()).ok_or_else(|| {
                    conflict(&rel.as_display())
                })?;
                let current = read_file_bytes(root, &rel)?;
                if content_revision(&current) != expected {
                    return Err(conflict(&rel.as_display()));
                }
                write_atomic(root, &rel, content.as_bytes())?;
            } else {
                create_new_exclusive(root, &rel, content.as_bytes())?;
            }
            let written = read_file_bytes(root, &rel)?;
            Ok(json!({
                "ok": true,
                "revision": content_revision(&written),
                "relativePath": rel.as_display(),
            }))
        })
    }

    pub fn edit_file(
        &self,
        capability_id: &str,
        window_label: &str,
        relative_path: &str,
        old_string: &str,
        new_string: &str,
        expected_revision: &str,
    ) -> Result<Value, WorkspaceError> {
        self.mutate(capability_id, window_label, |root| {
            if is_hard_denied(relative_path) {
                return Err(hard_denied(relative_path));
            }
            if old_string.is_empty() {
                return Err(ambiguous_edit());
            }
            let rel = RelativePath::parse(relative_path)?;
            let bytes = read_file_bytes(root, &rel)?;
            if content_revision(&bytes) != expected_revision {
                return Err(conflict(&rel.as_display()));
            }
            let text = String::from_utf8(bytes).map_err(|_| {
                WorkspaceError::new(super::error::BINARY, "File is not valid UTF-8")
            })?;
            let matches = text.matches(old_string).count();
            if matches != 1 {
                return Err(ambiguous_edit());
            }
            let next = text.replacen(old_string, new_string, 1);
            write_atomic(root, &rel, next.as_bytes())?;
            let written = read_file_bytes(root, &rel)?;
            Ok(json!({
                "ok": true,
                "revision": content_revision(&written),
                "relativePath": rel.as_display(),
            }))
        })
    }

    pub fn delete_file(
        &self,
        capability_id: &str,
        window_label: &str,
        relative_path: &str,
        expected_revision: &str,
    ) -> Result<Value, WorkspaceError> {
        self.mutate(capability_id, window_label, |root| {
            if is_hard_denied(relative_path) {
                return Err(hard_denied(relative_path));
            }
            let rel = RelativePath::parse(relative_path)?;
            let bytes = read_file_bytes(root, &rel)?;
            if content_revision(&bytes) != expected_revision {
                return Err(conflict(&rel.as_display()));
            }
            delete_file(root, &rel)?;
            Ok(json!({
                "ok": true,
                "revision": "",
                "relativePath": rel.as_display(),
            }))
        })
    }

    fn mutate<F>(&self, capability_id: &str, window_label: &str, f: F) -> Result<Value, WorkspaceError>
    where
        F: FnOnce(&Path) -> Result<Value, WorkspaceError>,
    {
        if !self.mutation_enabled() {
            return Err(mutation_disabled());
        }
        let _guard = self.begin_op()?;
        let (root, _, _) = self.lookup_cap(capability_id, window_label)?;
        // Re-check revocation after acquiring lease, before side effects.
        let (root2, _, _) = self.lookup_cap(capability_id, window_label)?;
        if root != root2 {
            return Err(stale_capability());
        }
        f(&root)
    }

    pub fn reveal_path(&self, project_id: &str, window_label: &str) -> Result<String, WorkspaceError> {
        Self::require_main(window_label)?;
        let inner = self.lock()?;
        let binding = inner
            .bindings
            .get(project_id)
            .ok_or_else(|| unauthorized_root("No native binding exists for this project"))?;
        Ok(binding.display_path.clone())
    }
}

fn descriptor_json(
    project_id: &str,
    capability_id: &str,
    generation: &str,
    display: &str,
    status: &str,
    trust: &TrustState,
) -> Value {
    json!({
        "projectId": project_id,
        "capabilityId": capability_id,
        "rootGeneration": generation,
        "displayPath": display,
        "status": status,
        "trust": {
            "files": trust.files,
            "instructions": trust.instructions,
            "skillsCommands": trust.skills_commands,
            "hooks": trust.hooks,
        }
    })
}

fn looks_binary(bytes: &[u8]) -> bool {
    bytes.iter().take(8000).any(|b| *b == 0)
}
