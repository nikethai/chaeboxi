//! Fsynced apply journal for crash recovery. Not a cross-file atomic commit.

use super::error::{WorkspaceError, PERMISSION_DENIED};
use serde_json::Value;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;

pub fn append_journal(private_root: &Path, change_set_id: &str, state: &str, detail: &Value) -> Result<(), WorkspaceError> {
    if private_root.as_os_str().is_empty() {
        return Ok(());
    }
    let dir = private_root.join("journals");
    fs::create_dir_all(&dir).map_err(|e| WorkspaceError::new(PERMISSION_DENIED, format!("{e}")))?;
    let path = dir.join(format!("{change_set_id}.jsonl"));
    let line = serde_json::json!({
        "at": super::authority::WorkspaceRuntime::now_ms(),
        "state": state,
        "detail": detail,
    });
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| WorkspaceError::new(PERMISSION_DENIED, format!("{e}")))?;
    writeln!(file, "{line}").map_err(|e| WorkspaceError::new(PERMISSION_DENIED, format!("{e}")))?;
    let _ = file.sync_all();
    Ok(())
}

pub fn read_journal(private_root: &Path, change_set_id: &str) -> Vec<Value> {
    let path = private_root.join("journals").join(format!("{change_set_id}.jsonl"));
    let Ok(text) = fs::read_to_string(path) else {
        return Vec::new();
    };
    text.lines()
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn journal_round_trip() {
        let dir = std::env::temp_dir().join(format!("chaeboxi-journal-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        append_journal(&dir, "cs1", "prepare", &json!({ "n": 1 })).unwrap();
        append_journal(&dir, "cs1", "applied", &json!({ "n": 2 })).unwrap();
        let rows = read_journal(&dir, "cs1");
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[1].get("state").and_then(|v| v.as_str()), Some("applied"));
    }
}
