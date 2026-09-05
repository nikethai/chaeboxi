//! Staged change sets: begin/append/seal/preflight/apply with one-use tickets.

use super::authority::WorkspaceRuntime;
use super::budgets::{APPLY_TICKET_TTL_MS, CHANGE_SET_MAX_BYTES, CHANGE_SET_MAX_OPS, CHANGE_SET_TTL_MS};
use super::error::{
    apply_ticket_invalid, change_set_invalid, conflict, feature_disabled, hard_denied, not_found, WorkspaceError,
    CONFLICT, PARTIAL_APPLY, PERMISSION_DENIED,
};
use super::ignore::is_hard_denied;
use super::path::{content_revision, RelativePath};
use super::suite_state::{ApplyTicket, ChangeSet, StagedOp};
use super::traverse::{create_new_exclusive, delete_file, exists_nofollow, read_file_bytes, write_atomic};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use uuid::Uuid;

impl WorkspaceRuntime {
    pub fn begin_change_set(
        &self,
        capability_id: &str,
        window_label: &str,
        session_id: &str,
        turn_id: &str,
    ) -> Result<Value, WorkspaceError> {
        if !self.rollout().staging {
            return Err(feature_disabled("staging"));
        }
        let (_, project_id, generation, _) = self.lookup_cap(capability_id, window_label)?;
        let id = Uuid::new_v4().to_string();
        let now = Self::now_ms();
        let set = ChangeSet {
            id: id.clone(),
            capability_id: capability_id.to_string(),
            project_id,
            session_id: session_id.to_string(),
            turn_id: turn_id.to_string(),
            root_generation: generation,
            sealed: false,
            digest: String::new(),
            ops: Vec::new(),
            normalized: Vec::new(),
            created_at: now,
            expires_at: now + CHANGE_SET_TTL_MS,
        };
        if let Ok(mut suite) = self.suite.lock() {
            suite.change_sets.insert(id.clone(), set);
        }
        Ok(json!({ "changeSetId": id }))
    }

    pub fn append_change(&self, change_set_id: &str, window_label: &str, op: &Value) -> Result<Value, WorkspaceError> {
        if !self.rollout().staging {
            return Err(feature_disabled("staging"));
        }
        Self::require_main(window_label)?;
        let mut suite = self.suite.lock().map_err(|_| {
            WorkspaceError::new(PERMISSION_DENIED, "suite lock poisoned")
        })?;
        let set = suite
            .change_sets
            .get_mut(change_set_id)
            .ok_or_else(|| change_set_invalid("Unknown change set"))?;
        if set.sealed {
            return Err(change_set_invalid("Change set is sealed"));
        }
        if set.expires_at < Self::now_ms() {
            return Err(change_set_invalid("Change set expired"));
        }
        if set.ops.len() >= CHANGE_SET_MAX_OPS {
            return Err(change_set_invalid("Too many staged operations"));
        }
        let kind = op.get("kind").and_then(|v| v.as_str()).unwrap_or("");
        let rel = op.get("relativePath").and_then(|v| v.as_str()).unwrap_or("");
        if !matches!(kind, "create" | "edit" | "delete") {
            return Err(change_set_invalid("Unknown operation kind"));
        }
        if is_hard_denied(rel) {
            return Err(hard_denied(rel));
        }
        RelativePath::parse(rel)?;
        let content = op.get("content").and_then(|v| v.as_str()).map(str::to_string);
        let new_string = op.get("newString").and_then(|v| v.as_str()).map(str::to_string);
        let bytes = content.as_ref().map(String::len).unwrap_or(0)
            + new_string.as_ref().map(String::len).unwrap_or(0);
        let already: usize = set
            .ops
            .iter()
            .map(|o| o.content.as_ref().map(String::len).unwrap_or(0) + o.new_string.as_ref().map(String::len).unwrap_or(0))
            .sum();
        if already + bytes > CHANGE_SET_MAX_BYTES {
            return Err(change_set_invalid("Staged content exceeds quota"));
        }
        let staged = StagedOp {
            id: Uuid::new_v4().to_string(),
            kind: kind.to_string(),
            relative_path: rel.replace('\\', "/"),
            content,
            old_string: op.get("oldString").and_then(|v| v.as_str()).map(str::to_string),
            new_string,
            expected_revision: op.get("expectedRevision").and_then(|v| v.as_str()).map(str::to_string),
            intent: kind.to_string(),
        };
        let op_id = staged.id.clone();
        set.ops.push(staged);
        Ok(json!({ "operationId": op_id, "staged": true }))
    }

    pub fn seal_change_set(&self, change_set_id: &str, window_label: &str) -> Result<Value, WorkspaceError> {
        Self::require_main(window_label)?;
        let mut suite = self.suite.lock().map_err(|_| {
            WorkspaceError::new(PERMISSION_DENIED, "suite lock poisoned")
        })?;
        let set = suite
            .change_sets
            .get_mut(change_set_id)
            .ok_or_else(|| change_set_invalid("Unknown change set"))?;
        let normalized = normalize_ops(&set.ops);
        let digest = digest_set(set, &normalized);
        set.normalized = normalized.clone();
        set.digest = digest.clone();
        set.sealed = true;
        Ok(json!({
            "changeSetId": change_set_id,
            "digest": digest,
            "operations": review_dto(&normalized),
        }))
    }

    pub fn get_change_set(&self, change_set_id: &str, window_label: &str) -> Result<Value, WorkspaceError> {
        Self::require_main(window_label)?;
        let suite = self.suite.lock().map_err(|_| {
            WorkspaceError::new(PERMISSION_DENIED, "suite lock poisoned")
        })?;
        let set = suite
            .change_sets
            .get(change_set_id)
            .ok_or_else(|| change_set_invalid("Unknown change set"))?;
        Ok(json!({
            "changeSetId": set.id,
            "sealed": set.sealed,
            "digest": set.digest,
            "rootGeneration": set.root_generation,
            "expiresAt": set.expires_at,
            "operations": review_dto(if set.sealed { &set.normalized } else { &set.ops }),
        }))
    }

    pub fn discard_change_set(&self, change_set_id: &str, window_label: &str) -> Result<Value, WorkspaceError> {
        Self::require_main(window_label)?;
        if let Ok(mut suite) = self.suite.lock() {
            suite.change_sets.remove(change_set_id);
            suite.apply_tickets.retain(|_, t| t.change_set_id != change_set_id);
        }
        Ok(json!({ "ok": true }))
    }

    pub fn preflight_change_set(
        &self,
        change_set_id: &str,
        window_label: &str,
        digest: &str,
        selected_ids: &[String],
    ) -> Result<Value, WorkspaceError> {
        let (set, selected) = self.select_ops(change_set_id, digest, selected_ids)?;
        let (root, _, generation, _) = self.lookup_cap(&set.capability_id, window_label)?;
        if generation != set.root_generation {
            return Err(stale_or_conflict("Root generation changed"));
        }
        let mut conflicts = Vec::new();
        for op in &selected {
            if let Err(err) = preflight_one(&root, op) {
                conflicts.push(json!({
                    "operationId": op.id,
                    "relativePath": op.relative_path,
                    "code": err.code,
                }));
            }
        }
        Ok(json!({
            "ok": conflicts.is_empty(),
            "conflicts": conflicts,
            "selected": selected.iter().map(|o| o.id.clone()).collect::<Vec<_>>(),
        }))
    }

    pub fn prepare_apply(
        &self,
        change_set_id: &str,
        window_label: &str,
        digest: &str,
        selected_ids: &[String],
    ) -> Result<Value, WorkspaceError> {
        if !self.rollout().apply {
            return Err(feature_disabled("apply"));
        }
        Self::require_main(window_label)?;
        let (set, selected) = self.select_ops(change_set_id, digest, selected_ids)?;
        let pre = self.preflight_change_set(change_set_id, window_label, digest, selected_ids)?;
        if pre.get("ok").and_then(|v| v.as_bool()) != Some(true) {
            return Ok(json!({ "ok": false, "preflight": pre }));
        }
        let ticket_id = Uuid::new_v4().to_string();
        let ticket = ApplyTicket {
            id: ticket_id.clone(),
            change_set_id: set.id.clone(),
            digest: set.digest.clone(),
            selected_ids: selected.iter().map(|o| o.id.clone()).collect(),
            used: false,
            expires_at: Self::now_ms() + APPLY_TICKET_TTL_MS,
        };
        if let Ok(mut suite) = self.suite.lock() {
            suite.apply_tickets.insert(ticket_id.clone(), ticket);
        }
        let _ = super::apply_journal::append_journal(
            &self.private_root().unwrap_or_default(),
            change_set_id,
            "prepare",
            &json!({ "ticketId": ticket_id }),
        );
        Ok(json!({ "applyTicket": ticket_id, "expiresAt": Self::now_ms() + APPLY_TICKET_TTL_MS }))
    }

    pub fn apply_change_set(&self, ticket_id: &str, window_label: &str) -> Result<Value, WorkspaceError> {
        if !self.rollout().apply {
            return Err(feature_disabled("apply"));
        }
        Self::require_main(window_label)?;
        let ticket = {
            let mut suite = self.suite.lock().map_err(|_| {
                WorkspaceError::new(PERMISSION_DENIED, "suite lock poisoned")
            })?;
            let t = suite
                .apply_tickets
                .get_mut(ticket_id)
                .ok_or_else(apply_ticket_invalid)?;
            if t.used || t.expires_at < Self::now_ms() {
                return Err(apply_ticket_invalid());
            }
            t.used = true;
            t.clone()
        };
        let (set, selected) = self.select_ops(&ticket.change_set_id, &ticket.digest, &ticket.selected_ids)?;
        let (root, _, generation, _) = self.lookup_cap(&set.capability_id, window_label)?;
        if generation != set.root_generation {
            return Err(stale_or_conflict("Root generation changed"));
        }
        let mut applied = Vec::new();
        let mut unapplied = Vec::new();
        let mut conflicted = Vec::new();
        let journal_root = self.private_root().unwrap_or_default();
        let _ = super::apply_journal::append_journal(&journal_root, &set.id, "applying", &json!({}));
        for op in selected {
            let result = self.mutate_with_apply_permit(&set.capability_id, window_label, |root| {
                apply_one(root, &op)
            });
            match result {
                Ok(_) => {
                    applied.push(op.id.clone());
                    let _ = super::apply_journal::append_journal(
                        &journal_root,
                        &set.id,
                        "op-applied",
                        &json!({ "operationId": op.id, "path": op.relative_path }),
                    );
                }
                Err(err) if err.code == super::error::CONFLICT => {
                    conflicted.push(json!({ "operationId": op.id, "code": err.code }));
                }
                Err(err) => {
                    unapplied.push(json!({ "operationId": op.id, "code": err.code, "message": err.message }));
                }
            }
        }
        let status = if conflicted.is_empty() && unapplied.is_empty() {
            "applied"
        } else if applied.is_empty() {
            "conflict"
        } else {
            "partial"
        };
        let _ = super::apply_journal::append_journal(
            &journal_root,
            &set.id,
            status,
            &json!({ "applied": applied, "unapplied": unapplied, "conflicted": conflicted }),
        );
        let _ = root;
        if status == "partial" {
            return Ok(json!({
                "status": status,
                "code": PARTIAL_APPLY,
                "applied": applied,
                "unapplied": unapplied,
                "conflicted": conflicted,
            }));
        }
        Ok(json!({
            "status": status,
            "applied": applied,
            "unapplied": unapplied,
            "conflicted": conflicted,
        }))
    }

    fn select_ops(
        &self,
        change_set_id: &str,
        digest: &str,
        selected_ids: &[String],
    ) -> Result<(ChangeSet, Vec<StagedOp>), WorkspaceError> {
        let suite = self.suite.lock().map_err(|_| {
            WorkspaceError::new(PERMISSION_DENIED, "suite lock poisoned")
        })?;
        let set = suite
            .change_sets
            .get(change_set_id)
            .cloned()
            .ok_or_else(|| change_set_invalid("Unknown change set"))?;
        if !set.sealed {
            return Err(change_set_invalid("Change set is not sealed"));
        }
        if set.digest != digest {
            return Err(apply_ticket_invalid());
        }
        let wanted: HashSet<&String> = selected_ids.iter().collect();
        let selected: Vec<StagedOp> = set
            .normalized
            .iter()
            .filter(|o| wanted.is_empty() || wanted.contains(&o.id))
            .cloned()
            .collect();
        if !selected_ids.is_empty() && selected.len() != selected_ids.len() {
            return Err(apply_ticket_invalid());
        }
        Ok((set, selected))
    }
}

fn stale_or_conflict(msg: &str) -> WorkspaceError {
    WorkspaceError::new(CONFLICT, msg)
}

fn review_dto(ops: &[StagedOp]) -> Vec<Value> {
    ops.iter()
        .map(|o| {
            json!({
                "id": o.id,
                "kind": o.kind,
                "relativePath": o.relative_path,
                "intent": o.intent,
                "contentBytes": o.content.as_ref().map(String::len).unwrap_or(0)
                    + o.new_string.as_ref().map(String::len).unwrap_or(0),
            })
        })
        .collect()
}

fn digest_set(set: &ChangeSet, normalized: &[StagedOp]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(set.project_id.as_bytes());
    hasher.update(set.root_generation.as_bytes());
    hasher.update(set.capability_id.as_bytes());
    if let Ok(text) = serde_json::to_string(normalized) {
        hasher.update(text.as_bytes());
    }
    hasher.finalize().iter().map(|b| format!("{b:02x}")).collect()
}

#[derive(Clone)]
enum Overlay {
    Content(String),
    Deleted,
    Patch {
        old: String,
        new: String,
        expected: Option<String>,
    },
}

fn apply_patch(current: &str, old: &str, new: &str) -> String {
    if old.is_empty() {
        new.to_string()
    } else {
        current.replacen(old, new, 1)
    }
}

fn normalize_ops(ops: &[StagedOp]) -> Vec<StagedOp> {
    let mut order: Vec<String> = Vec::new();
    let mut overlay: HashMap<String, Overlay> = HashMap::new();
    let mut base_rev: HashMap<String, Option<String>> = HashMap::new();
    for op in ops {
        if !order.iter().any(|p| p == &op.relative_path) {
            order.push(op.relative_path.clone());
        }
        base_rev.entry(op.relative_path.clone()).or_insert(op.expected_revision.clone());
        match op.kind.as_str() {
            "create" => {
                overlay.insert(op.relative_path.clone(), Overlay::Content(op.content.clone().unwrap_or_default()));
            }
            "edit" => {
                let old = op.old_string.clone().unwrap_or_default();
                let new = op.new_string.clone().unwrap_or_else(|| op.content.clone().unwrap_or_default());
                // Overwrite / full-file replace: content with no oldString is the final body.
                if old.is_empty() && op.content.is_some() {
                    overlay.insert(
                        op.relative_path.clone(),
                        Overlay::Content(op.content.clone().unwrap_or_default()),
                    );
                    continue;
                }
                let next = match overlay.get(&op.relative_path) {
                    Some(Overlay::Content(s)) => Overlay::Content(apply_patch(s, &old, &new)),
                    Some(Overlay::Deleted) => Overlay::Content(new),
                    Some(Overlay::Patch { old: prev_old, new: prev_new, expected }) => Overlay::Patch {
                        old: prev_old.clone(),
                        new: apply_patch(prev_new, &old, &new),
                        expected: expected.clone(),
                    },
                    None => Overlay::Patch {
                        old,
                        new,
                        expected: op.expected_revision.clone(),
                    },
                };
                overlay.insert(op.relative_path.clone(), next);
            }
            "delete" => {
                overlay.insert(op.relative_path.clone(), Overlay::Deleted);
            }
            _ => {}
        }
    }
    order
        .into_iter()
        .filter_map(|path| {
            let state = overlay.get(&path)?;
            let id = Uuid::new_v4().to_string();
            match state {
                Overlay::Deleted => Some(StagedOp {
                    id,
                    kind: "delete".into(),
                    relative_path: path.clone(),
                    content: None,
                    old_string: None,
                    new_string: None,
                    expected_revision: base_rev.get(&path).cloned().flatten(),
                    intent: "delete".into(),
                }),
                Overlay::Content(text) => {
                    let created = ops.iter().any(|o| o.relative_path == path && o.kind == "create");
                    Some(StagedOp {
                        id,
                        kind: if created { "create".into() } else { "edit".into() },
                        relative_path: path.clone(),
                        content: Some(text.clone()),
                        old_string: None,
                        new_string: None,
                        expected_revision: base_rev.get(&path).cloned().flatten(),
                        intent: if created { "create".into() } else { "replace".into() },
                    })
                }
                Overlay::Patch { old, new, expected } => Some(StagedOp {
                    id,
                    kind: "edit".into(),
                    relative_path: path.clone(),
                    content: None,
                    old_string: Some(old.clone()),
                    new_string: Some(new.clone()),
                    expected_revision: expected.clone().or_else(|| base_rev.get(&path).cloned().flatten()),
                    intent: "edit".into(),
                }),
            }
        })
        .collect()
}

fn preflight_one(root: &Path, op: &StagedOp) -> Result<(), WorkspaceError> {
    let rel = RelativePath::parse(&op.relative_path)?;
    match op.kind.as_str() {
        "create" => {
            if exists_nofollow(root, &rel) {
                return Err(super::error::already_exists(&rel.as_display()));
            }
        }
        "edit" | "delete" => {
            if !exists_nofollow(root, &rel) {
                return Err(not_found(&rel.as_display()));
            }
            if let Some(expected) = &op.expected_revision {
                let bytes = read_file_bytes(root, &rel)?;
                if content_revision(&bytes) != *expected {
                    return Err(conflict(&rel.as_display()));
                }
            }
        }
        _ => {}
    }
    Ok(())
}

fn apply_one(root: &Path, op: &StagedOp) -> Result<Value, WorkspaceError> {
    preflight_one(root, op)?;
    let rel = RelativePath::parse(&op.relative_path)?;
    match op.kind.as_str() {
        "create" => {
            create_new_exclusive(root, &rel, op.content.as_deref().unwrap_or("").as_bytes())?;
        }
        "edit" => {
            if let Some(content) = &op.content {
                write_atomic(root, &rel, content.as_bytes())?;
            } else {
                let bytes = read_file_bytes(root, &rel)?;
                let text = String::from_utf8(bytes)
                    .map_err(|_| WorkspaceError::new(super::error::BINARY, "File is not valid UTF-8"))?;
                let old = op.old_string.as_deref().unwrap_or("");
                let new = op.new_string.as_deref().unwrap_or("");
                if old.is_empty() || text.matches(old).count() != 1 {
                    return Err(super::error::ambiguous_edit());
                }
                let next = text.replacen(old, new, 1);
                write_atomic(root, &rel, next.as_bytes())?;
            }
        }
        "delete" => {
            delete_file(root, &rel)?;
        }
        _ => return Err(change_set_invalid("Unknown operation")),
    }
    Ok(json!({ "ok": true, "relativePath": rel.as_display() }))
}
