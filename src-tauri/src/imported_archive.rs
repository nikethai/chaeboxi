//! Privileged ChatGPT ZIP inspect: allowlisted JSON only, no extract-to-disk.

use serde_json::{json, Value};
use std::fs::File;
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;

const MAX_COMPRESSED_BYTES: u64 = 200 * 1024 * 1024;
const MAX_UNCOMPRESSED_ENTRY_BYTES: u64 = 32 * 1024 * 1024;
const MAX_ENTRIES: usize = 50_000;
const MAX_AMPLIFICATION: u64 = 20;

fn basename(name: &str) -> &str {
    name.rsplit(['/', '\\']).next().unwrap_or(name)
}

fn is_zip_slip(name: &str) -> bool {
    let replaced = name.replace('\\', "/");
    if replaced.starts_with('/') || (name.len() >= 2 && name.as_bytes()[1] == b':') {
        return true;
    }
    replaced.split('/').any(|part| part == "..")
}

fn is_nested_archive(name: &str) -> bool {
    let lower = basename(name).to_ascii_lowercase();
    [".zip", ".tar", ".gz", ".tgz", ".7z", ".rar", ".bz2", ".xz"]
        .iter()
        .any(|ext| lower.ends_with(ext))
}

fn is_allowlisted_json(name: &str) -> bool {
    let base = basename(name).to_ascii_lowercase();
    base == "conversations.json" || (base.ends_with(".json") && base.chars().next().is_some_and(|c| c.is_ascii_digit()))
}

pub fn inspect_zip_path(path: &str) -> Result<Value, String> {
    let metadata = std::fs::metadata(path).map_err(|err| format!("stat failed: {err}"))?;
    if metadata.len() > MAX_COMPRESSED_BYTES {
        return Ok(json!({ "ok": false, "code": "oversize", "message": "compressed archive exceeds limit" }));
    }
    let file = File::open(path).map_err(|err| format!("open failed: {err}"))?;
    let mut archive = ZipArchive::new(file).map_err(|_| "not_zip".to_string())?;
    if archive.len() > MAX_ENTRIES {
        return Ok(json!({ "ok": false, "code": "too_many_entries", "message": "too many zip entries" }));
    }
    let mut json_entries = Vec::new();
    let mut skipped = Vec::new();
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|err| format!("zip entry: {err}"))?;
        let name = entry.name().to_string();
        let is_symlink = entry
            .unix_mode()
            .map(|mode| mode & 0o170000 == 0o120000)
            .unwrap_or(false);
        if is_symlink || is_zip_slip(&name) {
            return Ok(json!({ "ok": false, "code": "zip_slip", "message": format!("zip_slip:{name}") }));
        }
        if is_nested_archive(&name) {
            return Ok(json!({ "ok": false, "code": "nested_archive", "message": format!("nested_archive:{name}") }));
        }
        let uncompressed = entry.size();
        let compressed = entry.compressed_size();
        if uncompressed > MAX_UNCOMPRESSED_ENTRY_BYTES
            || (compressed > 0 && uncompressed / compressed.max(1) > MAX_AMPLIFICATION)
        {
            return Ok(json!({ "ok": false, "code": "oversize", "message": format!("oversize:{name}") }));
        }
        if !is_allowlisted_json(&name) {
            skipped.push(format!("skip:{name}"));
            continue;
        }
        let mut buf = Vec::new();
        entry
            .read_to_end(&mut buf)
            .map_err(|err| format!("read entry: {err}"))?;
        let text = String::from_utf8_lossy(&buf).to_string();
        json_entries.push(json!({ "name": basename(&name), "text": text }));
    }
    Ok(json!({ "ok": true, "jsonEntries": json_entries, "skipped": skipped }))
}

#[allow(dead_code)]
pub fn inspect_arg_path(path: &str) -> Result<Value, String> {
    let normalized = Path::new(path);
    if !normalized.is_file() {
        return Err("archive path is not a file".into());
    }
    inspect_zip_path(path)
}
