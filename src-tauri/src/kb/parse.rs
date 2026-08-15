//! Honest local document parsing and overlapping chunking.

use std::path::Path;

pub const CHUNK_SIZE: usize = 1200;
pub const CHUNK_OVERLAP: usize = 150;

const SUPPORTED_EXTS: &[&str] = &["txt", "md", "markdown", "csv", "json", "log"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParseError {
    pub message: String,
}

impl ParseError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

fn extension_of(filepath: &str) -> String {
    Path::new(filepath)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
}

fn looks_like_pdf_or_office(filepath: &str, mime_type: &str) -> Option<&'static str> {
    let ext = extension_of(filepath);
    let mime = mime_type.to_ascii_lowercase();
    if ext == "pdf" || mime.contains("pdf") {
        return Some("PDF");
    }
    if matches!(
        ext.as_str(),
        "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "odt" | "ods" | "odp" | "rtf" | "epub"
    ) || mime.contains("word")
        || mime.contains("excel")
        || mime.contains("powerpoint")
        || mime.contains("officedocument")
        || mime.contains("msword")
        || mime.contains("ms-excel")
        || mime.contains("ms-powerpoint")
        || mime.contains("rtf")
        || mime.contains("epub")
    {
        return Some("Office");
    }
    None
}

pub fn is_supported_text(filepath: &str, mime_type: &str) -> bool {
    if looks_like_pdf_or_office(filepath, mime_type).is_some() {
        return false;
    }
    let ext = extension_of(filepath);
    if SUPPORTED_EXTS.contains(&ext.as_str()) {
        return true;
    }
    let mime = mime_type.to_ascii_lowercase();
    mime.starts_with("text/") || mime.contains("json") || mime.contains("csv")
}

/// Load UTF-8 text from a supported file. PDF/Office fail with a real error
/// instead of pretending the file is empty.
pub fn parse_file(filepath: &str, mime_type: &str) -> Result<String, ParseError> {
    if filepath.trim().is_empty() {
        return Err(ParseError::new("File path is empty; cannot read document"));
    }
    if let Some(kind) = looks_like_pdf_or_office(filepath, mime_type) {
        return Err(ParseError::new(format!(
            "{kind} files are not supported in this version. Upload .txt, .md, .csv, .json, or .log instead."
        )));
    }
    if !is_supported_text(filepath, mime_type) {
        return Err(ParseError::new(format!(
            "Unsupported file type ({mime_type}). Only text, Markdown, CSV, JSON, and log files can be indexed."
        )));
    }
    std::fs::read_to_string(filepath).map_err(|err| {
        ParseError::new(format!("Failed to read file as UTF-8 text: {err}"))
    })
}

/// Parse already-loaded UTF-8 text (HTML file picker has no disk path).
pub fn parse_text(filename: &str, mime_type: &str, text: &str) -> Result<String, ParseError> {
    if let Some(kind) = looks_like_pdf_or_office(filename, mime_type) {
        return Err(ParseError::new(format!(
            "{kind} files are not supported in this version. Upload .txt, .md, .csv, .json, or .log instead."
        )));
    }
    if !is_supported_text(filename, mime_type) {
        return Err(ParseError::new(format!(
            "Unsupported file type ({mime_type}). Only text, Markdown, CSV, JSON, and log files can be indexed."
        )));
    }
    if text.trim().is_empty() {
        return Err(ParseError::new("File parsed as empty text; nothing to index."));
    }
    Ok(text.to_string())
}

/// Split `text` into overlapping character windows.
/// `overlap` characters from the end of one chunk start the next.
pub fn chunk_text(text: &str, max_chunk_chars: usize, overlap: usize) -> Vec<String> {
    if text.is_empty() || max_chunk_chars == 0 {
        return Vec::new();
    }

    let chars: Vec<char> = text.chars().collect();
    let mut chunks = Vec::new();
    let mut start = 0;
    let step = max_chunk_chars.saturating_sub(overlap).max(1);

    while start < chars.len() {
        let end = (start + max_chunk_chars).min(chars.len());
        let chunk: String = chars[start..end].iter().collect();
        if !chunk.trim().is_empty() {
            chunks.push(chunk);
        }
        if end >= chars.len() {
            break;
        }
        start += step;
    }

    chunks
}

pub fn chunk_document(text: &str) -> Vec<String> {
    chunk_text(text, CHUNK_SIZE, CHUNK_OVERLAP)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn pdf_fails_honestly() {
        let err = parse_file("/tmp/report.pdf", "application/pdf").unwrap_err();
        assert!(
            err.message.contains("PDF"),
            "expected PDF in error, got {}",
            err.message
        );
    }

    #[test]
    fn office_fails_honestly() {
        let err = parse_file(
            "/tmp/notes.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        .unwrap_err();
        assert!(
            err.message.contains("Office") || err.message.contains("not supported"),
            "unexpected error: {}",
            err.message
        );
    }

    #[test]
    fn empty_path_fails() {
        let err = parse_file("", "text/plain").unwrap_err();
        assert!(err.message.to_ascii_lowercase().contains("empty"));
    }

    #[test]
    fn supported_text_reads() {
        let dir = std::env::temp_dir().join(format!(
            "chaeboxi-parse-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("note.md");
        {
            let mut f = std::fs::File::create(&path).unwrap();
            f.write_all(b"# hello\nworld").unwrap();
        }
        let text = parse_file(path.to_str().unwrap(), "text/markdown").unwrap();
        assert!(text.contains("hello"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn chunk_overlap_is_applied() {
        let text: String = (0..2000).map(|i| char::from(b'a' + (i % 26) as u8)).collect();
        let chunks = chunk_text(&text, 1200, 150);
        assert!(chunks.len() >= 2, "expected at least 2 chunks, got {}", chunks.len());
        assert_eq!(chunks[0].chars().count(), 1200);
        let first_tail: String = chunks[0].chars().skip(1050).collect();
        let second_head: String = chunks[1].chars().take(150).collect();
        assert_eq!(
            first_tail, second_head,
            "second chunk should start with the last 150 chars of the first"
        );
        // step is 1050, so chunk 1 starts at 1050 and has 950 remaining + nothing wait:
        // 2000 - 1050 = 950, so second chunk is 950 chars
        assert_eq!(chunks[1].chars().count(), 950);
    }

    #[test]
    fn tiny_text_is_one_chunk() {
        let chunks = chunk_document("hello");
        assert_eq!(chunks, vec!["hello".to_string()]);
    }

    #[test]
    fn parse_text_accepts_markdown_without_path() {
        let text = parse_text("notes.md", "text/markdown", "# hello\nworld").unwrap();
        assert!(text.contains("hello"));
    }
}
