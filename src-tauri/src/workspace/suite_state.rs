//! Ephemeral native state for export manifests, artifacts, change sets, and tickets.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportManifest {
    pub id: String,
    pub capability_id: String,
    pub project_id: String,
    pub root_generation: String,
    pub kind: String,
    pub files: Vec<ExportFile>,
    pub excluded: usize,
    pub total_bytes: u64,
    pub expires_at: i64,
    pub artifact_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportFile {
    pub relative_path: String,
    pub size: u64,
    pub revision: String,
}

#[derive(Debug, Clone)]
pub struct ArtifactRecord {
    pub id: String,
    pub owner_project: String,
    pub filename: String,
    pub mime: String,
    pub bytes: Vec<u8>,
    pub hash: String,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StagedOp {
    pub id: String,
    pub kind: String,
    pub relative_path: String,
    pub content: Option<String>,
    pub old_string: Option<String>,
    pub new_string: Option<String>,
    pub expected_revision: Option<String>,
    pub intent: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeSet {
    pub id: String,
    pub capability_id: String,
    pub project_id: String,
    pub session_id: String,
    pub turn_id: String,
    pub root_generation: String,
    pub sealed: bool,
    pub digest: String,
    pub ops: Vec<StagedOp>,
    pub normalized: Vec<StagedOp>,
    pub created_at: i64,
    pub expires_at: i64,
}

#[derive(Debug, Clone)]
pub struct ApplyTicket {
    pub id: String,
    pub change_set_id: String,
    pub digest: String,
    pub selected_ids: Vec<String>,
    pub used: bool,
    pub expires_at: i64,
}

#[derive(Debug, Default)]
#[allow(dead_code)]
pub struct SuiteState {
    pub exports: HashMap<String, ExportManifest>,
    pub artifacts: HashMap<String, ArtifactRecord>,
    pub change_sets: HashMap<String, ChangeSet>,
    pub apply_tickets: HashMap<String, ApplyTicket>,
    pub fail_next_export: bool,
    pub journal_dir: PathBuf,
}

impl SuiteState {
    pub fn new(private_root: PathBuf) -> Self {
        Self {
            journal_dir: private_root.join("journals"),
            ..Self::default()
        }
    }
}
