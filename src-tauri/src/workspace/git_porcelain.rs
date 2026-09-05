//! NUL-safe Git porcelain v2 parser. Path bytes stay native; renderer gets labels.

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StatusEntry {
    pub change_id: String,
    pub status: String,
    pub path_label: String,
    pub orig_label: Option<String>,
    pub path_bytes: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StatusSnapshot {
    pub branch: String,
    pub oid: String,
    pub detached: bool,
    pub unborn: bool,
    pub entries: Vec<StatusEntry>,
}

fn display_label(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).replace('\0', "").to_string()
}

fn opaque_id(prefix: &str, bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(prefix.as_bytes());
    hasher.update(bytes);
    hasher
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .take(16)
        .collect::<String>()
        .chars()
        .take(32)
        .collect()
}

/// Parse `git status --porcelain=v2 -z --branch` stdout.
pub fn parse_status_v2(bytes: &[u8]) -> StatusSnapshot {
    let mut branch = "HEAD".to_string();
    let mut oid = String::new();
    let mut detached = false;
    let mut unborn = false;
    let mut entries = Vec::new();
    for chunk in bytes.split(|b| *b == 0) {
        if chunk.is_empty() {
            continue;
        }
        if chunk.starts_with(b"# branch.head ") {
            let rest = &chunk["# branch.head ".len()..];
            let name = display_label(rest);
            if name == "(detached)" {
                detached = true;
            } else if name == "(unnamed)" {
                unborn = true;
            } else {
                branch = name;
            }
            continue;
        }
        if chunk.starts_with(b"# branch.oid ") {
            oid = display_label(&chunk["# branch.oid ".len()..]);
            if oid == "(initial)" {
                unborn = true;
            }
            continue;
        }
        if chunk[0] == b'#' {
            continue;
        }
        let kind = chunk[0];
        match kind {
            b'1' | b'2' | b'u' | b'?' | b'!' => {
                let path = extract_path(chunk);
                let status = match kind {
                    b'?' => "untracked".into(),
                    b'!' => "ignored".into(),
                    b'u' => "unmerged".into(),
                    b'2' => "renamed".into(),
                    _ => ordinary_status(chunk),
                };
                entries.push(StatusEntry {
                    change_id: opaque_id("chg", &path),
                    status,
                    path_label: display_label(&path),
                    orig_label: None,
                    path_bytes: path,
                });
            }
            _ => {}
        }
    }
    StatusSnapshot {
        branch,
        oid,
        detached,
        unborn,
        entries,
    }
}

fn ordinary_status(chunk: &[u8]) -> String {
    // "1 XY ..."
    if chunk.len() >= 4 {
        let xy = display_label(&chunk[2..4]);
        if xy.contains('A') {
            return "added".into();
        }
        if xy.contains('D') {
            return "deleted".into();
        }
        if xy.contains('M') {
            return "modified".into();
        }
    }
    "modified".into()
}

fn extract_path(chunk: &[u8]) -> Vec<u8> {
    if chunk.starts_with(b"? ") || chunk.starts_with(b"! ") {
        return chunk[2..].to_vec();
    }
    // porcelain v2 ordinary: 8 header tokens then the remainder is the path (may contain spaces).
    skip_tokens(chunk, 8).to_vec()
}

fn skip_tokens(chunk: &[u8], n: usize) -> &[u8] {
    let mut seen = 0usize;
    let mut i = 0usize;
    while i < chunk.len() {
        if chunk[i] == b' ' {
            seen += 1;
            i += 1;
            if seen == n {
                return &chunk[i..];
            }
        } else {
            i += 1;
        }
    }
    &[]
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LogEntry {
    pub commit_id: String,
    pub author: String,
    pub timestamp: String,
    pub subject: String,
}

/// Parse `git log -z --pretty=format:%H%x00%an%x00%at%x00%s` records of 4 NULs per commit.
pub fn parse_log(bytes: &[u8]) -> Vec<LogEntry> {
    let parts: Vec<&[u8]> = bytes.split(|b| *b == 0).filter(|p| !p.is_empty()).collect();
    let mut out = Vec::new();
    let mut i = 0;
    while i + 3 < parts.len() {
        out.push(LogEntry {
            commit_id: display_label(parts[i]),
            author: display_label(parts[i + 1]),
            timestamp: display_label(parts[i + 2]),
            subject: display_label(parts[i + 3]),
        });
        i += 4;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_branch_and_nul_paths() {
        let mut raw = b"# branch.head main\0# branch.oid abcdef\01 M. N... 100644 100644 100644 h1 h2 ".to_vec();
        raw.extend_from_slice(b"src/a file.txt");
        raw.push(0);
        raw.extend_from_slice(b"? untracked.txt");
        raw.push(0);
        let snap = parse_status_v2(&raw);
        assert_eq!(snap.branch, "main");
        assert_eq!(snap.oid, "abcdef");
        assert_eq!(snap.entries.len(), 2);
        assert_eq!(snap.entries[0].path_label, "src/a file.txt");
        assert_eq!(snap.entries[1].status, "untracked");
        assert!(!snap.entries[0].change_id.contains('/'));
    }

    #[test]
    fn parses_log_records() {
        let raw = b"abc\0Ada\01600000000\0hello\0def\0Bob\01600000001\0world\0";
        let log = parse_log(raw);
        assert_eq!(log.len(), 2);
        assert_eq!(log[0].subject, "hello");
        assert_eq!(log[1].author, "Bob");
    }
}
