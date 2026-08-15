//! Knowledge-base persistence.
//!
//! Desktop opens `chaeboxi_kb.db` (bundled SQLite). Mobile and the default
//! runtime keep an in-memory store so iOS/Android still compile without
//! rusqlite / sqlite-vec.

use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub const DB_FILENAME: &str = "chaeboxi_kb.db";

#[derive(Debug, Clone)]
pub struct BaseRecord {
    pub id: i64,
    pub name: String,
    pub embedding_model: String,
    pub rerank_model: String,
    pub vision_model: Option<String>,
    pub provider_mode: Option<String>,
    pub document_parser: Option<Value>,
    pub created_at: i64,
}

#[derive(Debug, Clone)]
pub struct FileRecord {
    pub id: i64,
    pub kb_id: i64,
    pub filename: String,
    pub filepath: String,
    pub mime_type: String,
    pub file_size: i64,
    pub chunk_count: i64,
    pub total_chunks: i64,
    pub status: String,
    pub error: Option<String>,
    pub created_at: i64,
    pub parsed_remotely: i64,
    pub parser_type: String,
}

#[derive(Debug, Clone)]
pub struct ChunkRow {
    pub id: i64,
    pub file_id: i64,
    #[allow(dead_code)]
    pub kb_id: i64,
    pub chunk_index: i64,
    pub text: String,
    pub embedding: Option<Vec<f32>>,
}

pub fn encode_embedding(v: &[f32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(v.len() * 4);
    for f in v {
        out.extend_from_slice(&f.to_le_bytes());
    }
    out
}

pub fn decode_embedding(bytes: &[u8]) -> Option<Vec<f32>> {
    if bytes.is_empty() || bytes.len() % 4 != 0 {
        return None;
    }
    Some(
        bytes
            .chunks_exact(4)
            .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
            .collect(),
    )
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[derive(Default)]
struct MemoryState {
    bases: HashMap<i64, BaseRecord>,
    files: HashMap<i64, FileRecord>,
    chunks: HashMap<i64, Vec<ChunkRow>>,
    next_base_id: i64,
    next_file_id: i64,
    next_chunk_id: i64,
}

enum StoreInner {
    Memory(MemoryState),
    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    Sqlite {
        conn: rusqlite::Connection,
        path: PathBuf,
    },
}

pub struct Store {
    inner: StoreInner,
}

impl Store {
    pub fn memory() -> Self {
        Self {
            inner: StoreInner::Memory(MemoryState::default()),
        }
    }

    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    pub fn open(dir: &Path) -> Result<Self, String> {
        std::fs::create_dir_all(dir).map_err(|e| format!("create kb dir: {e}"))?;
        let path = dir.join(DB_FILENAME);
        let conn = rusqlite::Connection::open(&path).map_err(|e| format!("open {DB_FILENAME}: {e}"))?;
        conn.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS kb_bases (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              embedding_model TEXT NOT NULL,
              rerank_model TEXT NOT NULL DEFAULT '',
              vision_model TEXT,
              provider_mode TEXT,
              document_parser TEXT,
              created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS kb_files (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              kb_id INTEGER NOT NULL REFERENCES kb_bases(id) ON DELETE CASCADE,
              filename TEXT NOT NULL,
              filepath TEXT NOT NULL,
              mime_type TEXT NOT NULL,
              file_size INTEGER NOT NULL DEFAULT 0,
              chunk_count INTEGER NOT NULL DEFAULT 0,
              total_chunks INTEGER NOT NULL DEFAULT 0,
              status TEXT NOT NULL,
              error TEXT,
              created_at INTEGER NOT NULL,
              parsed_remotely INTEGER NOT NULL DEFAULT 0,
              parser_type TEXT NOT NULL DEFAULT 'local'
            );
            CREATE TABLE IF NOT EXISTS kb_chunks (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              file_id INTEGER NOT NULL REFERENCES kb_files(id) ON DELETE CASCADE,
              kb_id INTEGER NOT NULL,
              chunk_index INTEGER NOT NULL,
              text TEXT NOT NULL,
              embedding BLOB,
              UNIQUE(file_id, chunk_index)
            );
            CREATE TABLE IF NOT EXISTS kb_meta (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_kb_files_kb ON kb_files(kb_id);
            CREATE INDEX IF NOT EXISTS idx_kb_files_status ON kb_files(status);
            CREATE INDEX IF NOT EXISTS idx_kb_chunks_kb ON kb_chunks(kb_id);
            CREATE INDEX IF NOT EXISTS idx_kb_chunks_file ON kb_chunks(file_id);
            "#,
        )
        .map_err(|e| format!("init schema: {e}"))?;
        Ok(Self {
            inner: StoreInner::Sqlite { conn, path },
        })
    }

    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    #[allow(dead_code)]
    pub fn path(&self) -> Option<&Path> {
        match &self.inner {
            StoreInner::Sqlite { path, .. } => Some(path),
            StoreInner::Memory(_) => None,
        }
    }

    pub fn list_bases(&self) -> Result<Vec<BaseRecord>, String> {
        match &self.inner {
            StoreInner::Memory(mem) => {
                let mut rows: Vec<_> = mem.bases.values().cloned().collect();
                rows.sort_by(|a, b| a.id.cmp(&b.id));
                Ok(rows)
            }
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => {
                let mut stmt = conn
                    .prepare(
                        "SELECT id, name, embedding_model, rerank_model, vision_model, provider_mode, document_parser, created_at FROM kb_bases ORDER BY id",
                    )
                    .map_err(|e| e.to_string())?;
                let rows = stmt
                    .query_map([], row_to_base)
                    .map_err(|e| e.to_string())?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| e.to_string())?;
                Ok(rows)
            }
        }
    }

    pub fn get_base(&self, id: i64) -> Result<Option<BaseRecord>, String> {
        match &self.inner {
            StoreInner::Memory(mem) => Ok(mem.bases.get(&id).cloned()),
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => {
                let mut stmt = conn
                    .prepare(
                        "SELECT id, name, embedding_model, rerank_model, vision_model, provider_mode, document_parser, created_at FROM kb_bases WHERE id = ?1",
                    )
                    .map_err(|e| e.to_string())?;
                let mut rows = stmt.query_map([id], row_to_base).map_err(|e| e.to_string())?;
                match rows.next() {
                    Some(Ok(row)) => Ok(Some(row)),
                    Some(Err(e)) => Err(e.to_string()),
                    None => Ok(None),
                }
            }
        }
    }

    pub fn create_base(
        &mut self,
        name: String,
        embedding_model: String,
        rerank_model: String,
        vision_model: Option<String>,
        provider_mode: Option<String>,
        document_parser: Option<Value>,
    ) -> Result<BaseRecord, String> {
        let created_at = now_ms();
        match &mut self.inner {
            StoreInner::Memory(mem) => {
                mem.next_base_id += 1;
                let record = BaseRecord {
                    id: mem.next_base_id,
                    name,
                    embedding_model,
                    rerank_model,
                    vision_model,
                    provider_mode,
                    document_parser,
                    created_at,
                };
                mem.bases.insert(record.id, record.clone());
                Ok(record)
            }
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => {
                let parser = document_parser
                    .as_ref()
                    .map(|v| v.to_string());
                conn.execute(
                    "INSERT INTO kb_bases (name, embedding_model, rerank_model, vision_model, provider_mode, document_parser, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    rusqlite::params![
                        name,
                        embedding_model,
                        rerank_model,
                        vision_model,
                        provider_mode,
                        parser,
                        created_at
                    ],
                )
                .map_err(|e| e.to_string())?;
                let id = conn.last_insert_rowid();
                Ok(BaseRecord {
                    id,
                    name,
                    embedding_model,
                    rerank_model,
                    vision_model,
                    provider_mode,
                    document_parser,
                    created_at,
                })
            }
        }
    }

    pub fn update_base(
        &mut self,
        id: i64,
        name: Option<String>,
        rerank_model: Option<String>,
        vision_model: Option<String>,
    ) -> Result<i64, String> {
        match &mut self.inner {
            StoreInner::Memory(mem) => {
                let record = mem
                    .bases
                    .get_mut(&id)
                    .ok_or_else(|| format!("knowledge base {id} not found"))?;
                let mut updated = 0_i64;
                if let Some(name) = name {
                    record.name = name;
                    updated = 1;
                }
                if let Some(model) = rerank_model {
                    record.rerank_model = model;
                    updated = 1;
                }
                if let Some(model) = vision_model {
                    record.vision_model = Some(model);
                    updated = 1;
                }
                Ok(updated)
            }
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => {
                let existing = self_get_base_sqlite(conn, id)?
                    .ok_or_else(|| format!("knowledge base {id} not found"))?;
                let name = name.unwrap_or(existing.name);
                let rerank_model = rerank_model.unwrap_or(existing.rerank_model);
                let vision_model = vision_model.or(existing.vision_model);
                let n = conn
                    .execute(
                        "UPDATE kb_bases SET name = ?1, rerank_model = ?2, vision_model = ?3 WHERE id = ?4",
                        rusqlite::params![name, rerank_model, vision_model, id],
                    )
                    .map_err(|e| e.to_string())?;
                Ok(if n > 0 { 1 } else { 0 })
            }
        }
    }

    pub fn delete_base(&mut self, id: i64) -> Result<(), String> {
        match &mut self.inner {
            StoreInner::Memory(mem) => {
                mem.bases.remove(&id);
                let file_ids: Vec<i64> = mem
                    .files
                    .values()
                    .filter(|f| f.kb_id == id)
                    .map(|f| f.id)
                    .collect();
                for fid in file_ids {
                    mem.files.remove(&fid);
                    mem.chunks.remove(&fid);
                }
                Ok(())
            }
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => {
                conn.execute("DELETE FROM kb_bases WHERE id = ?1", [id])
                    .map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }

    pub fn list_files(&self, kb_id: i64) -> Result<Vec<FileRecord>, String> {
        match &self.inner {
            StoreInner::Memory(mem) => {
                let mut rows: Vec<_> = mem
                    .files
                    .values()
                    .filter(|f| f.kb_id == kb_id)
                    .cloned()
                    .collect();
                rows.sort_by(|a, b| b.created_at.cmp(&a.created_at));
                Ok(rows)
            }
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => query_files(
                conn,
                "SELECT id, kb_id, filename, filepath, mime_type, file_size, chunk_count, total_chunks, status, error, created_at, parsed_remotely, parser_type FROM kb_files WHERE kb_id = ?1 ORDER BY created_at DESC",
                rusqlite::params![kb_id],
            ),
        }
    }

    pub fn count_files(&self, kb_id: i64) -> Result<i64, String> {
        match &self.inner {
            StoreInner::Memory(mem) => Ok(mem.files.values().filter(|f| f.kb_id == kb_id).count() as i64),
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => conn
                .query_row(
                    "SELECT COUNT(*) FROM kb_files WHERE kb_id = ?1",
                    [kb_id],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string()),
        }
    }

    pub fn list_files_paginated(
        &self,
        kb_id: i64,
        offset: i64,
        limit: i64,
    ) -> Result<Vec<FileRecord>, String> {
        match &self.inner {
            StoreInner::Memory(mem) => {
                let mut rows: Vec<_> = mem
                    .files
                    .values()
                    .filter(|f| f.kb_id == kb_id)
                    .cloned()
                    .collect();
                rows.sort_by(|a, b| b.created_at.cmp(&a.created_at));
                Ok(rows
                    .into_iter()
                    .skip(offset.max(0) as usize)
                    .take(limit.max(1) as usize)
                    .collect())
            }
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => query_files(
                conn,
                "SELECT id, kb_id, filename, filepath, mime_type, file_size, chunk_count, total_chunks, status, error, created_at, parsed_remotely, parser_type FROM kb_files WHERE kb_id = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3",
                rusqlite::params![kb_id, limit.max(1), offset.max(0)],
            ),
        }
    }

    pub fn get_file(&self, id: i64) -> Result<Option<FileRecord>, String> {
        match &self.inner {
            StoreInner::Memory(mem) => Ok(mem.files.get(&id).cloned()),
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => {
                let rows = query_files(
                    conn,
                    "SELECT id, kb_id, filename, filepath, mime_type, file_size, chunk_count, total_chunks, status, error, created_at, parsed_remotely, parser_type FROM kb_files WHERE id = ?1",
                    rusqlite::params![id],
                )?;
                Ok(rows.into_iter().next())
            }
        }
    }

    pub fn get_files_by_ids(&self, kb_id: i64, file_ids: &[i64]) -> Result<Vec<FileRecord>, String> {
        let mut out = Vec::new();
        for id in file_ids {
            if let Some(file) = self.get_file(*id)? {
                if file.kb_id == kb_id {
                    out.push(file);
                }
            }
        }
        Ok(out)
    }

    pub fn insert_file(&mut self, mut record: FileRecord) -> Result<FileRecord, String> {
        match &mut self.inner {
            StoreInner::Memory(mem) => {
                if record.id == 0 {
                    mem.next_file_id += 1;
                    record.id = mem.next_file_id;
                } else {
                    mem.next_file_id = mem.next_file_id.max(record.id);
                }
                mem.files.insert(record.id, record.clone());
                Ok(record)
            }
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => {
                conn.execute(
                    "INSERT INTO kb_files (kb_id, filename, filepath, mime_type, file_size, chunk_count, total_chunks, status, error, created_at, parsed_remotely, parser_type) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                    rusqlite::params![
                        record.kb_id,
                        record.filename,
                        record.filepath,
                        record.mime_type,
                        record.file_size,
                        record.chunk_count,
                        record.total_chunks,
                        record.status,
                        record.error,
                        record.created_at,
                        record.parsed_remotely,
                        record.parser_type
                    ],
                )
                .map_err(|e| e.to_string())?;
                record.id = conn.last_insert_rowid();
                Ok(record)
            }
        }
    }

    pub fn update_file(&mut self, record: &FileRecord) -> Result<(), String> {
        match &mut self.inner {
            StoreInner::Memory(mem) => {
                mem.files.insert(record.id, record.clone());
                Ok(())
            }
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => {
                conn.execute(
                    "UPDATE kb_files SET filename = ?1, filepath = ?2, mime_type = ?3, file_size = ?4, chunk_count = ?5, total_chunks = ?6, status = ?7, error = ?8, parsed_remotely = ?9, parser_type = ?10 WHERE id = ?11",
                    rusqlite::params![
                        record.filename,
                        record.filepath,
                        record.mime_type,
                        record.file_size,
                        record.chunk_count,
                        record.total_chunks,
                        record.status,
                        record.error,
                        record.parsed_remotely,
                        record.parser_type,
                        record.id
                    ],
                )
                .map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }

    pub fn delete_file(&mut self, file_id: i64) -> Result<Option<i64>, String> {
        match &mut self.inner {
            StoreInner::Memory(mem) => {
                let kb_id = mem.files.remove(&file_id).map(|f| f.kb_id);
                mem.chunks.remove(&file_id);
                Ok(kb_id)
            }
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => {
                let kb_id: Option<i64> = conn
                    .query_row(
                        "SELECT kb_id FROM kb_files WHERE id = ?1",
                        [file_id],
                        |row| row.get(0),
                    )
                    .ok();
                conn.execute("DELETE FROM kb_files WHERE id = ?1", [file_id])
                    .map_err(|e| e.to_string())?;
                Ok(kb_id)
            }
        }
    }

    pub fn replace_chunks(
        &mut self,
        file_id: i64,
        kb_id: i64,
        chunks: &[String],
    ) -> Result<(), String> {
        match &mut self.inner {
            StoreInner::Memory(mem) => {
                let mut rows = Vec::with_capacity(chunks.len());
                for (idx, text) in chunks.iter().enumerate() {
                    mem.next_chunk_id += 1;
                    rows.push(ChunkRow {
                        id: mem.next_chunk_id,
                        file_id,
                        kb_id,
                        chunk_index: idx as i64,
                        text: text.clone(),
                        embedding: None,
                    });
                }
                mem.chunks.insert(file_id, rows);
                Ok(())
            }
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => {
                let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
                tx.execute("DELETE FROM kb_chunks WHERE file_id = ?1", [file_id])
                    .map_err(|e| e.to_string())?;
                {
                    let mut stmt = tx
                        .prepare(
                            "INSERT INTO kb_chunks (file_id, kb_id, chunk_index, text, embedding) VALUES (?1, ?2, ?3, ?4, NULL)",
                        )
                        .map_err(|e| e.to_string())?;
                    for (idx, text) in chunks.iter().enumerate() {
                        stmt.execute(rusqlite::params![file_id, kb_id, idx as i64, text])
                            .map_err(|e| e.to_string())?;
                    }
                }
                tx.commit().map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }

    pub fn clear_chunks(&mut self, file_id: i64) -> Result<(), String> {
        self.replace_chunks(file_id, 0, &[])
    }

    pub fn list_chunks_for_kb(&self, kb_id: i64) -> Result<Vec<ChunkRow>, String> {
        match &self.inner {
            StoreInner::Memory(mem) => {
                let mut rows = Vec::new();
                for file in mem.files.values().filter(|f| f.kb_id == kb_id) {
                    if let Some(chunks) = mem.chunks.get(&file.id) {
                        rows.extend(chunks.iter().cloned());
                    }
                }
                Ok(rows)
            }
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => query_chunks(
                conn,
                "SELECT id, file_id, kb_id, chunk_index, text, embedding FROM kb_chunks WHERE kb_id = ?1 ORDER BY file_id, chunk_index",
                rusqlite::params![kb_id],
            ),
        }
    }

    pub fn get_chunk(&self, file_id: i64, chunk_index: i64) -> Result<Option<ChunkRow>, String> {
        match &self.inner {
            StoreInner::Memory(mem) => Ok(mem.chunks.get(&file_id).and_then(|rows| {
                rows.iter()
                    .find(|c| c.chunk_index == chunk_index)
                    .cloned()
            })),
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => {
                let rows = query_chunks(
                    conn,
                    "SELECT id, file_id, kb_id, chunk_index, text, embedding FROM kb_chunks WHERE file_id = ?1 AND chunk_index = ?2",
                    rusqlite::params![file_id, chunk_index],
                )?;
                Ok(rows.into_iter().next())
            }
        }
    }

    pub fn pending_files(&self) -> Result<Vec<FileRecord>, String> {
        match &self.inner {
            StoreInner::Memory(mem) => Ok(mem
                .files
                .values()
                .filter(|f| f.status == "pending" || f.status == "processing")
                .cloned()
                .collect()),
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => query_files(
                conn,
                "SELECT id, kb_id, filename, filepath, mime_type, file_size, chunk_count, total_chunks, status, error, created_at, parsed_remotely, parser_type FROM kb_files WHERE status IN ('pending', 'processing') ORDER BY id",
                [],
            ),
        }
    }

    pub fn chunks_missing_embeddings(
        &self,
        file_id: i64,
        limit: usize,
    ) -> Result<Vec<ChunkRow>, String> {
        match &self.inner {
            StoreInner::Memory(mem) => Ok(mem
                .chunks
                .get(&file_id)
                .map(|rows| {
                    rows.iter()
                        .filter(|c| c.embedding.is_none())
                        .take(limit)
                        .cloned()
                        .collect()
                })
                .unwrap_or_default()),
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => query_chunks(
                conn,
                "SELECT id, file_id, kb_id, chunk_index, text, embedding FROM kb_chunks WHERE file_id = ?1 AND embedding IS NULL ORDER BY chunk_index LIMIT ?2",
                rusqlite::params![file_id, limit as i64],
            ),
        }
    }

    pub fn set_chunk_embedding(&mut self, chunk_id: i64, embedding: &[f32]) -> Result<(), String> {
        match &mut self.inner {
            StoreInner::Memory(mem) => {
                for rows in mem.chunks.values_mut() {
                    if let Some(chunk) = rows.iter_mut().find(|c| c.id == chunk_id) {
                        chunk.embedding = Some(embedding.to_vec());
                        return Ok(());
                    }
                }
                Err(format!("chunk {chunk_id} not found"))
            }
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => {
                let blob = encode_embedding(embedding);
                conn.execute(
                    "UPDATE kb_chunks SET embedding = ?1 WHERE id = ?2",
                    rusqlite::params![blob, chunk_id],
                )
                .map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }

    /// Mark files that have chunks but no vectors as `pending` so the embed worker
    /// can write embeddings without a re-upload.
    pub fn requeue_files_missing_embeddings(&mut self) -> Result<usize, String> {
        match &mut self.inner {
            StoreInner::Memory(mem) => {
                let mut updated = 0usize;
                let ids: Vec<i64> = mem.files.keys().copied().collect();
                for id in ids {
                    let total = mem.files.get(&id).map(|f| f.total_chunks).unwrap_or(0);
                    if total <= 0 {
                        continue;
                    }
                    let missing = mem
                        .chunks
                        .get(&id)
                        .map(|rows| rows.iter().any(|c| c.embedding.is_none()))
                        .unwrap_or(false);
                    if !missing {
                        continue;
                    }
                    if let Some(file) = mem.files.get_mut(&id) {
                        file.status = "pending".into();
                        file.error = None;
                        updated += 1;
                    }
                }
                Ok(updated)
            }
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => {
                let n = conn
                    .execute(
                        "UPDATE kb_files SET status = 'pending', error = NULL
                         WHERE total_chunks > 0 AND id IN (
                           SELECT DISTINCT file_id FROM kb_chunks WHERE embedding IS NULL
                         )",
                        [],
                    )
                    .map_err(|e| e.to_string())?;
                Ok(n)
            }
        }
    }

    pub fn count_embedded_chunks(&self, file_id: i64) -> Result<i64, String> {
        match &self.inner {
            StoreInner::Memory(mem) => Ok(mem
                .chunks
                .get(&file_id)
                .map(|rows| rows.iter().filter(|c| c.embedding.is_some()).count() as i64)
                .unwrap_or(0)),
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            StoreInner::Sqlite { conn, .. } => conn
                .query_row(
                    "SELECT COUNT(*) FROM kb_chunks WHERE file_id = ?1 AND embedding IS NOT NULL",
                    [file_id],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string()),
        }
    }
}

#[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
fn row_to_base(row: &rusqlite::Row<'_>) -> rusqlite::Result<BaseRecord> {
    let parser_raw: Option<String> = row.get(6)?;
    let document_parser = parser_raw.and_then(|s| serde_json::from_str(&s).ok());
    Ok(BaseRecord {
        id: row.get(0)?,
        name: row.get(1)?,
        embedding_model: row.get(2)?,
        rerank_model: row.get(3)?,
        vision_model: row.get(4)?,
        provider_mode: row.get(5)?,
        document_parser,
        created_at: row.get(7)?,
    })
}

#[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
fn row_to_file(row: &rusqlite::Row<'_>) -> rusqlite::Result<FileRecord> {
    Ok(FileRecord {
        id: row.get(0)?,
        kb_id: row.get(1)?,
        filename: row.get(2)?,
        filepath: row.get(3)?,
        mime_type: row.get(4)?,
        file_size: row.get(5)?,
        chunk_count: row.get(6)?,
        total_chunks: row.get(7)?,
        status: row.get(8)?,
        error: row.get(9)?,
        created_at: row.get(10)?,
        parsed_remotely: row.get(11)?,
        parser_type: row.get(12)?,
    })
}

#[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
fn row_to_chunk(row: &rusqlite::Row<'_>) -> rusqlite::Result<ChunkRow> {
    let blob: Option<Vec<u8>> = row.get(5)?;
    Ok(ChunkRow {
        id: row.get(0)?,
        file_id: row.get(1)?,
        kb_id: row.get(2)?,
        chunk_index: row.get(3)?,
        text: row.get(4)?,
        embedding: blob.as_deref().and_then(decode_embedding),
    })
}

#[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
fn query_files(
    conn: &rusqlite::Connection,
    sql: &str,
    params: impl rusqlite::Params,
) -> Result<Vec<FileRecord>, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params, row_to_file)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
fn query_chunks(
    conn: &rusqlite::Connection,
    sql: &str,
    params: impl rusqlite::Params,
) -> Result<Vec<ChunkRow>, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params, row_to_chunk)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
fn self_get_base_sqlite(
    conn: &rusqlite::Connection,
    id: i64,
) -> Result<Option<BaseRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, embedding_model, rerank_model, vision_model, provider_mode, document_parser, created_at FROM kb_bases WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query_map([id], row_to_base).map_err(|e| e.to_string())?;
    match rows.next() {
        Some(Ok(row)) => Ok(Some(row)),
        Some(Err(e)) => Err(e.to_string()),
        None => Ok(None),
    }
}

#[cfg(all(
    test,
    any(target_os = "macos", target_os = "windows", target_os = "linux")
))]
mod tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        use std::sync::atomic::{AtomicU64, Ordering};
        static SEQ: AtomicU64 = AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "chaeboxi-kb-persist-{}-{}-{}",
            std::process::id(),
            now_ms(),
            SEQ.fetch_add(1, Ordering::Relaxed)
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn persist_survives_reopen() {
        let dir = temp_dir();
        let (base_id, file_id) = {
            let mut store = Store::open(&dir).unwrap();
            let base = store
                .create_base(
                    "Library".into(),
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
                    filename: "note.md".into(),
                    filepath: "/tmp/note.md".into(),
                    mime_type: "text/markdown".into(),
                    file_size: 12,
                    chunk_count: 1,
                    total_chunks: 1,
                    status: "done".into(),
                    error: None,
                    created_at: now_ms(),
                    parsed_remotely: 0,
                    parser_type: "local".into(),
                })
                .unwrap();
            store
                .replace_chunks(file.id, base.id, &["xin chào thế giới".into()])
                .unwrap();
            let chunks = store.list_chunks_for_kb(base.id).unwrap();
            store
                .set_chunk_embedding(chunks[0].id, &[0.1, 0.2, 0.3])
                .unwrap();
            (base.id, file.id)
        };

        let store = Store::open(&dir).unwrap();
        let bases = store.list_bases().unwrap();
        assert_eq!(bases.len(), 1);
        assert_eq!(bases[0].id, base_id);
        assert_eq!(bases[0].name, "Library");
        assert_eq!(bases[0].embedding_model, "local:multilingual-e5-small");
        let files = store.list_files(base_id).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].id, file_id);
        assert_eq!(files[0].filename, "note.md");
        let chunks = store.list_chunks_for_kb(base_id).unwrap();
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].text, "xin chào thế giới");
        assert_eq!(chunks[0].embedding.as_deref(), Some(&[0.1, 0.2, 0.3][..]));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn requeue_files_missing_embeddings_sets_pending() {
        let dir = temp_dir();
        let mut store = Store::open(&dir).unwrap();
        let base = store
            .create_base(
                "Library".into(),
                "local:multilingual-e5-small".into(),
                "".into(),
                None,
                None,
                None,
            )
            .unwrap();
        let file = store
            .insert_file(FileRecord {
                id: 0,
                kb_id: base.id,
                filename: "note.md".into(),
                filepath: "/tmp/note.md".into(),
                mime_type: "text/markdown".into(),
                file_size: 12,
                chunk_count: 1,
                total_chunks: 1,
                status: "done".into(),
                error: Some("keyword-only settle".into()),
                created_at: now_ms(),
                parsed_remotely: 0,
                parser_type: "local".into(),
            })
            .unwrap();
        store
            .replace_chunks(file.id, base.id, &["the kitten curled up on the sofa".into()])
            .unwrap();
        let n = store.requeue_files_missing_embeddings().unwrap();
        assert_eq!(n, 1, "file with NULL embeddings should be re-queued");
        let file = store.get_file(file.id).unwrap().unwrap();
        assert_eq!(file.status, "pending");
        assert!(file.error.is_none());

        // Already-embedded files stay done.
        let chunks = store.list_chunks_for_kb(base.id).unwrap();
        store
            .set_chunk_embedding(chunks[0].id, &[0.1, 0.2])
            .unwrap();
        let mut file = store.get_file(file.id).unwrap().unwrap();
        file.status = "done".into();
        store.update_file(&file).unwrap();
        let n = store.requeue_files_missing_embeddings().unwrap();
        assert_eq!(n, 0);
        let file = store.get_file(file.id).unwrap().unwrap();
        assert_eq!(file.status, "done");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn requeue_files_missing_embeddings_memory() {
        let mut store = Store::memory();
        let base = store
            .create_base(
                "Mem".into(),
                "local:multilingual-e5-small".into(),
                "".into(),
                None,
                None,
                None,
            )
            .unwrap();
        let file = store
            .insert_file(FileRecord {
                id: 0,
                kb_id: base.id,
                filename: "note.md".into(),
                filepath: "/tmp/note.md".into(),
                mime_type: "text/markdown".into(),
                file_size: 4,
                chunk_count: 1,
                total_chunks: 1,
                status: "done".into(),
                error: Some("stale".into()),
                created_at: now_ms(),
                parsed_remotely: 0,
                parser_type: "local".into(),
            })
            .unwrap();
        store
            .replace_chunks(file.id, base.id, &["hello".into()])
            .unwrap();
        let n = store.requeue_files_missing_embeddings().unwrap();
        assert_eq!(n, 1);
        let file = store.get_file(file.id).unwrap().unwrap();
        assert_eq!(file.status, "pending");
        assert!(file.error.is_none());
    }

    #[test]
    fn ids_do_not_reset_after_reopen() {
        let dir = temp_dir();
        let first_id = {
            let mut store = Store::open(&dir).unwrap();
            store
                .create_base("A".into(), "local:multilingual-e5-small".into(), "".into(), None, None, None)
                .unwrap()
                .id
        };
        let second_id = {
            let mut store = Store::open(&dir).unwrap();
            store
                .create_base("B".into(), "local:multilingual-e5-small".into(), "".into(), None, None, None)
                .unwrap()
                .id
        };
        assert!(second_id > first_id, "AUTOINCREMENT must survive reopen");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
