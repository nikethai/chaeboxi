//! Re-exports kb logic modules so tests run without Tauri/GTK.
#[path = "../../src/kb/parse.rs"]
pub mod parse;
#[path = "../../src/kb/search.rs"]
pub mod search;
#[path = "../../src/kb/persist.rs"]
pub mod persist;

#[cfg(test)]
mod session {
    use crate::parse::{chunk_document, parse_file};
    use crate::persist::{now_ms, FileRecord, Store};
    use crate::search::{hybrid_search, SearchCandidate};
    use std::sync::atomic::{AtomicU64, Ordering};

    fn temp_dir() -> std::path::PathBuf {
        static SEQ: AtomicU64 = AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "chaeboxi-kb-session-{}-{}-{}",
            std::process::id(),
            now_ms(),
            SEQ.fetch_add(1, Ordering::Relaxed)
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn user_session_create_upload_reopen_search() {
        let dir = temp_dir();
        let notes = dir.join("notes.md");
        std::fs::write(
            &notes,
            "Chaeboxi stores private docs on this machine.\n\nMèo ngồi trên tấm thảm trong phòng khách.\n",
        )
        .unwrap();
        let pdf = dir.join("scan.pdf");
        std::fs::write(&pdf, b"%PDF-1.4 fake").unwrap();

        let parsed = parse_file(notes.to_str().unwrap(), "text/markdown").expect("md should parse");
        let chunks = chunk_document(&parsed);
        assert!(!chunks.is_empty(), "markdown should produce chunks");

        let pdf_err = parse_file(pdf.to_str().unwrap(), "application/pdf").expect_err("pdf must fail");
        assert!(pdf_err.message.contains("PDF"), "{}", pdf_err.message);

        let (kb_id, file_id) = {
            let mut store = Store::open(&dir).unwrap();
            let base = store
                .create_base(
                    "Home".into(),
                    "local:multilingual-e5-small".into(),
                    "".into(),
                    None,
                    Some("custom".into()),
                    None,
                )
                .unwrap();
            let file = store
                .insert_file(FileRecord {
                    id: 0,
                    kb_id: base.id,
                    filename: "notes.md".into(),
                    filepath: notes.to_string_lossy().into(),
                    mime_type: "text/markdown".into(),
                    file_size: parsed.len() as i64,
                    chunk_count: 0,
                    total_chunks: chunks.len() as i64,
                    status: "pending".into(),
                    error: None,
                    created_at: now_ms(),
                    parsed_remotely: 0,
                    parser_type: "local".into(),
                })
                .unwrap();
            store.replace_chunks(file.id, base.id, &chunks).unwrap();
            (base.id, file.id)
        };

        let store = Store::open(&dir).unwrap();
        assert_eq!(store.list_bases().unwrap()[0].name, "Home");
        assert_eq!(store.list_files(kb_id).unwrap()[0].id, file_id);
        let persisted = store.list_chunks_for_kb(kb_id).unwrap();
        let candidates: Vec<SearchCandidate> = persisted
            .into_iter()
            .map(|c| SearchCandidate {
                file_id: c.file_id,
                filename: "notes.md".into(),
                mime_type: "text/markdown".into(),
                chunk_index: c.chunk_index,
                text: c.text,
                embedding: c.embedding,
            })
            .collect();
        let rows = hybrid_search("private docs", None, &candidates);
        assert!(!rows.is_empty(), "keyword search should hit the markdown file");
        let hay = rows
            .iter()
            .filter_map(|r| r["text"].as_str())
            .collect::<Vec<_>>()
            .join(" ");
        assert!(
            hay.to_ascii_lowercase().contains("private") || hay.contains("Chaeboxi"),
            "expected keyword hit, got {rows:?}"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
