//! Desktop local semantic RAG (v1).
//!
//! `lib.rs` only `mod kb;` and dispatches `kb:*` here. JSON field names match
//! the existing TypeScript controller (mixed camelCase / snake_case).

pub mod embed;
pub mod parse;
pub mod persist;
pub mod search;

use embed::{
    describe_local_status, embed_texts, ensure_local_model, lookup_provider_creds, parse_model_id,
    passage_prefix, query_prefix, EmbedStatus, ModelKind, EMBED_BATCH_SIZE,
    LOCAL_E5_SMALL,
};
use parse::{chunk_document, parse_file, parse_text};
use persist::{now_ms, FileRecord, Store};
use search::{hybrid_search, SearchCandidate};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

type CommandResult<T> = Result<T, String>;

#[derive(Clone)]
pub struct KbRuntime {
    inner: Arc<KbInner>,
}

struct KbInner {
    store: Mutex<Store>,
    worker: Mutex<WorkerState>,
    models_dir: Mutex<PathBuf>,
}

struct WorkerState {
    busy: bool,
    paused: HashSet<i64>,
    status: EmbedStatus,
}

impl Default for KbRuntime {
    fn default() -> Self {
        Self {
            inner: Arc::new(KbInner {
                store: Mutex::new(Store::memory()),
                worker: Mutex::new(WorkerState {
                    busy: false,
                    paused: HashSet::new(),
                    status: EmbedStatus::idle(LOCAL_E5_SMALL),
                }),
                models_dir: Mutex::new(PathBuf::from(".")),
            }),
        }
    }
}

impl KbRuntime {
    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    pub fn open_desktop(&self, app: &AppHandle) -> CommandResult<()> {
        let dir = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        std::fs::create_dir_all(&dir).map_err(|e| format!("app data dir: {e}"))?;
        let models = dir.join("models");
        std::fs::create_dir_all(&models).ok();
        *self
            .inner
            .models_dir
            .lock()
            .map_err(|_| "kb models lock poisoned".to_string())? = models.clone();
        let store = Store::open(&dir)?;
        *self
            .inner
            .store
            .lock()
            .map_err(|_| "kb store lock poisoned".to_string())? = store;
        if let Ok(mut worker) = self.inner.worker.lock() {
            worker.status = describe_local_status(&models);
        }
        self.settle_keyword_only()?;
        Ok(())
    }

    /// When the ONNX runtime is not linked, chunks are still searchable by keyword.
    /// Mark those files done so the UI does not spin forever.
    fn settle_keyword_only(&self) -> CommandResult<()> {
        #[cfg(feature = "local-embed")]
        {
            return Ok(());
        }
        #[cfg(not(feature = "local-embed"))]
        {
            let mut store = self.store()?;
            for mut file in store.pending_files().unwrap_or_default() {
                if file.total_chunks <= 0 {
                    continue;
                }
                file.status = "done".into();
                file.error = None;
                file.chunk_count = file.total_chunks;
                store.update_file(&file)?;
            }
            Ok(())
        }
    }

    fn mark_keyword_ready(&self, file: &mut FileRecord) -> CommandResult<()> {
        file.status = "done".into();
        file.error = None;
        file.chunk_count = file.total_chunks;
        let mut store = self.store()?;
        store.update_file(file)?;
        Ok(())
    }

    fn store(&self) -> CommandResult<std::sync::MutexGuard<'_, Store>> {
        self.inner
            .store
            .lock()
            .map_err(|_| "kb store lock poisoned".to_string())
    }

    fn models_dir(&self) -> PathBuf {
        self.inner
            .models_dir
            .lock()
            .map(|d| d.clone())
            .unwrap_or_else(|_| PathBuf::from("."))
    }

    fn snapshot_status(&self) -> EmbedStatus {
        self.inner
            .worker
            .lock()
            .map(|w| w.status.clone())
            .unwrap_or_else(|_| EmbedStatus::idle(LOCAL_E5_SMALL))
    }

    fn set_status(&self, status: EmbedStatus, app: Option<&AppHandle>) {
        if let Ok(mut worker) = self.inner.worker.lock() {
            worker.status = status.clone();
        }
        if let Some(app) = app {
            let _ = app.emit("kb:embed:status", status.to_json());
        }
    }

    fn kick_worker(&self, app: &AppHandle, settings: Option<Value>) {
        {
            let mut worker = match self.inner.worker.lock() {
                Ok(w) => w,
                Err(_) => return,
            };
            if worker.busy {
                return;
            }
            worker.busy = true;
        }
        let runtime = self.clone();
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            let result = tokio::task::spawn_blocking(move || runtime.run_worker_blocking(&app, settings)).await;
            if let Err(err) = result {
                eprintln!("[kb] embed worker join failed: {err}");
            }
        });
    }

    fn run_worker_blocking(&self, app: &AppHandle, settings: Option<Value>) {
        loop {
            let next = {
                let store = match self.store() {
                    Ok(s) => s,
                    Err(err) => {
                        eprintln!("[kb] worker store: {err}");
                        break;
                    }
                };
                let paused = self
                    .inner
                    .worker
                    .lock()
                    .map(|w| w.paused.clone())
                    .unwrap_or_default();
                store
                    .pending_files()
                    .unwrap_or_default()
                    .into_iter()
                    .find(|f| !paused.contains(&f.id) && f.status != "paused")
            };
            let Some(mut file) = next else {
                break;
            };

            match self.embed_one_file(app, &mut file, settings.as_ref()) {
                Ok(WorkerProgress::Deferred) => break,
                Ok(_) => {}
                Err(err) => {
                    file.status = "failed".into();
                    file.error = Some(err);
                    if let Ok(mut store) = self.store() {
                        let _ = store.update_file(&file);
                    }
                }
            }
        }

        let models = self.models_dir();
        let mut status = describe_local_status(&models);
        status.active_file_id = None;
        status.active_filename = None;
        self.set_status(status, Some(app));
        if let Ok(mut worker) = self.inner.worker.lock() {
            worker.busy = false;
        }
    }

    fn embed_one_file(
        &self,
        app: &AppHandle,
        file: &mut FileRecord,
        settings: Option<&Value>,
    ) -> Result<WorkerProgress, String> {
        let base = {
            let store = self.store()?;
            store
                .get_base(file.kb_id)?
                .ok_or_else(|| format!("knowledge base {} not found", file.kb_id))?
        };
        let kind = parse_model_id(&base.embedding_model);
        let models_dir = self.models_dir();

        if matches!(kind, ModelKind::LocalE5) {
            let mut status = describe_local_status(&models_dir);
            status.downloading = !embed::model_files_present(&embed::local_model_dir(&models_dir));
            status.active_file_id = Some(file.id);
            status.active_filename = Some(file.filename.clone());
            self.set_status(status, Some(app));
            if let Err(err) = ensure_local_model(&models_dir) {
                // Stay pending so a later retry / resume can pick this up.
                // Search still works via keywords on existing chunks.
                let mut status = describe_local_status(&models_dir);
                status.reason = Some(err);
                self.set_status(status, Some(app));
                if file.total_chunks > 0 {
                    self.mark_keyword_ready(file)?;
                }
                return Ok(WorkerProgress::Deferred);
            }
        }

        let creds = match &kind {
            ModelKind::Remote { provider, .. } => settings.and_then(|s| lookup_provider_creds(s, provider)),
            _ => None,
        };

        file.status = "processing".into();
        file.error = None;
        {
            let mut store = self.store()?;
            store.update_file(file)?;
        }

        loop {
            if self
                .inner
                .worker
                .lock()
                .map(|w| w.paused.contains(&file.id))
                .unwrap_or(false)
            {
                file.status = "paused".into();
                let mut store = self.store()?;
                store.update_file(file)?;
                return Ok(WorkerProgress::Paused);
            }

            let batch = {
                let store = self.store()?;
                store.chunks_missing_embeddings(file.id, EMBED_BATCH_SIZE)?
            };
            if batch.is_empty() {
                break;
            }

            let texts: Vec<String> = batch.iter().map(|c| passage_prefix(&c.text)).collect();
            let vectors = match embed_texts(&kind, &texts, &models_dir, creds.as_ref()) {
                Ok(v) => v,
                Err(err) => {
                    // Model not ready: leave file pending, keyword search still works.
                    let mut status = describe_local_status(&models_dir);
                    status.ready = false;
                    status.reason = Some(err);
                    status.active_file_id = Some(file.id);
                    status.active_filename = Some(file.filename.clone());
                    self.set_status(status, Some(app));
                    if file.total_chunks > 0 {
                        self.mark_keyword_ready(file)?;
                    } else {
                        file.status = "pending".into();
                        let mut store = self.store()?;
                        store.update_file(file)?;
                    }
                    return Ok(WorkerProgress::Deferred);
                }
            };
            if vectors.len() != batch.len() {
                return Err(format!(
                    "embedder returned {} vectors for {} chunks",
                    vectors.len(),
                    batch.len()
                ));
            }

            {
                let mut store = self.store()?;
                for (chunk, vector) in batch.iter().zip(vectors.iter()) {
                    store.set_chunk_embedding(chunk.id, vector)?;
                }
                let embedded = store.count_embedded_chunks(file.id)?;
                file.chunk_count = embedded;
                store.update_file(file)?;
            }

            let mut status = describe_local_status(&models_dir);
            status.ready = true;
            status.active_file_id = Some(file.id);
            status.active_filename = Some(file.filename.clone());
            status.embedded_chunks = file.chunk_count;
            status.total_chunks = file.total_chunks;
            self.set_status(status, Some(app));
        }

        file.status = "done".into();
        file.error = None;
        file.chunk_count = file.total_chunks;
        let mut store = self.store()?;
        store.update_file(file)?;
        Ok(WorkerProgress::Done)
    }
}

enum WorkerProgress {
    Done,
    Paused,
    Deferred,
}


pub fn handle(
    app: &AppHandle,
    runtime: &KbRuntime,
    settings_store: &Mutex<HashMap<String, Value>>,
    channel: &str,
    args: &[Value],
) -> Option<CommandResult<Value>> {
    if !channel.starts_with("kb:") {
        return None;
    }
    Some(handle_inner(app, runtime, settings_store, channel, args))
}

fn handle_inner(
    app: &AppHandle,
    runtime: &KbRuntime,
    settings_store: &Mutex<HashMap<String, Value>>,
    channel: &str,
    args: &[Value],
) -> CommandResult<Value> {
    match channel {
        "kb:list" => {
            let store = runtime.store()?;
            let mut result = Vec::new();
            for record in store.list_bases()? {
                result.push(json!({
                    "id": record.id,
                    "name": record.name,
                    "embeddingModel": record.embedding_model,
                    "rerankModel": record.rerank_model,
                    "visionModel": record.vision_model,
                    "providerMode": record.provider_mode,
                    "documentParser": record.document_parser,
                    "createdAt": record.created_at,
                }));
            }
            Ok(Value::Array(result))
        }
        "kb:create" => {
            let params = arg(args, 0)?;
            let name = params
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("New Knowledge Base")
                .to_string();
            let embedding_model = params
                .get("embeddingModel")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .unwrap_or(LOCAL_E5_SMALL)
                .to_string();
            let rerank_model = params
                .get("rerankModel")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let vision_model = params
                .get("visionModel")
                .and_then(Value::as_str)
                .map(std::string::ToString::to_string);
            let provider_mode = params
                .get("providerMode")
                .and_then(Value::as_str)
                .map(std::string::ToString::to_string);
            let document_parser = params.get("documentParser").cloned();
            let mut store = runtime.store()?;
            let record = store.create_base(
                name,
                embedding_model,
                rerank_model,
                vision_model,
                provider_mode,
                document_parser,
            )?;
            Ok(json!({ "id": record.id, "name": record.name }))
        }
        "kb:update" => {
            let params = arg(args, 0)?;
            let id = params
                .get("id")
                .and_then(Value::as_i64)
                .ok_or_else(|| "missing kb id".to_string())?;
            let name = params
                .get("name")
                .and_then(Value::as_str)
                .map(std::string::ToString::to_string);
            let rerank_model = params
                .get("rerankModel")
                .and_then(Value::as_str)
                .map(std::string::ToString::to_string);
            let vision_model = params
                .get("visionModel")
                .and_then(Value::as_str)
                .map(std::string::ToString::to_string);
            let mut store = runtime.store()?;
            let updated = store.update_base(id, name, rerank_model, vision_model)?;
            Ok(Value::Number(updated.into()))
        }
        "kb:delete" => {
            let kb_id = arg(args, 0)?
                .as_i64()
                .ok_or_else(|| "invalid kb id".to_string())?;
            let mut store = runtime.store()?;
            store.delete_base(kb_id)?;
            Ok(json!({ "success": true }))
        }
        "kb:file:list" => {
            let kb_id = arg_i64(args, 0)?;
            let store = runtime.store()?;
            let files = store
                .list_files(kb_id)?
                .into_iter()
                .map(file_list_json)
                .collect();
            Ok(Value::Array(files))
        }
        "kb:file:count" => {
            let kb_id = arg_i64(args, 0)?;
            let store = runtime.store()?;
            Ok(Value::Number(store.count_files(kb_id)?.into()))
        }
        "kb:file:list-paginated" => {
            let kb_id = arg_i64(args, 0)?;
            let offset = arg(args, 1).ok().and_then(Value::as_i64).unwrap_or(0);
            let limit = arg(args, 2).ok().and_then(Value::as_i64).unwrap_or(20);
            let store = runtime.store()?;
            let rows = store
                .list_files_paginated(kb_id, offset, limit)?
                .into_iter()
                .map(file_list_json)
                .collect();
            Ok(Value::Array(rows))
        }
        "kb:file:get-metas" => {
            let kb_id = arg_i64(args, 0)?;
            let file_ids = arg(args, 1)?
                .as_array()
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .filter_map(|value| value.as_i64())
                .collect::<Vec<_>>();
            let store = runtime.store()?;
            let mut rows = Vec::new();
            for file in store.get_files_by_ids(kb_id, &file_ids)? {
                rows.push(json!({
                    "id": file.id,
                    "kbId": file.kb_id,
                    "filename": file.filename,
                    "mimeType": file.mime_type,
                    "fileSize": file.file_size,
                    "chunkCount": file.chunk_count,
                    "totalChunks": file.total_chunks,
                    "status": file.status,
                    "createdAt": file.created_at,
                }));
            }
            Ok(Value::Array(rows))
        }
        "kb:file:read-chunks" => {
            let kb_id = arg_i64(args, 0)?;
            let chunks = arg(args, 1)?
                .as_array()
                .ok_or_else(|| "invalid chunks parameter".to_string())?;
            let store = runtime.store()?;
            let mut rows = Vec::new();
            for chunk in chunks {
                let file_id = chunk
                    .get("fileId")
                    .and_then(Value::as_i64)
                    .ok_or_else(|| "invalid chunk.fileId".to_string())?;
                let chunk_index = chunk
                    .get("chunkIndex")
                    .and_then(Value::as_i64)
                    .ok_or_else(|| "invalid chunk.chunkIndex".to_string())?;
                if chunk_index < 0 {
                    continue;
                }
                let Some(file) = store.get_file(file_id)? else {
                    continue;
                };
                if file.kb_id != kb_id {
                    continue;
                }
                let Some(row) = store.get_chunk(file_id, chunk_index)? else {
                    continue;
                };
                rows.push(json!({
                    "fileId": file_id,
                    "filename": file.filename,
                    "chunkIndex": chunk_index,
                    "text": row.text,
                }));
            }
            Ok(Value::Array(rows))
        }
        "kb:file:upload" => {
            let kb_id = arg_i64(args, 0)?;
            {
                let store = runtime.store()?;
                if store.get_base(kb_id)?.is_none() {
                    return Err(format!("knowledge base {kb_id} not found"));
                }
            }
            let file = arg(args, 1)?;
            let filename = file
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("unknown")
                .to_string();
            let mut filepath = file
                .get("path")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let mime_type = file
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or("application/octet-stream")
                .to_string();
            let file_size = file.get("size").and_then(Value::as_i64).unwrap_or(0);
            let inline = file.get("content").and_then(Value::as_str);

            let parsed = if !filepath.trim().is_empty() {
                parse_file(&filepath, &mime_type)
            } else if let Some(text) = inline {
                match parse_text(&filename, &mime_type, text) {
                    Ok(parsed_text) => {
                        if let Ok(saved) = save_inbox_copy(runtime, &filename, &parsed_text) {
                            filepath = saved;
                        }
                        Ok(parsed_text)
                    }
                    Err(err) => Err(err),
                }
            } else {
                parse_file(&filepath, &mime_type)
            };
            let mut record = FileRecord {
                id: 0,
                kb_id,
                filename,
                filepath,
                mime_type,
                file_size,
                chunk_count: 0,
                total_chunks: 0,
                status: "pending".into(),
                error: None,
                created_at: now_ms(),
                parsed_remotely: 0,
                parser_type: "local".into(),
            };

            match parsed {
                Ok(text) => {
                    let chunks = chunk_document(&text);
                    if chunks.is_empty() {
                        record.status = "failed".into();
                        record.error = Some("File parsed as empty text; nothing to index.".into());
                    } else {
                        record.total_chunks = chunks.len() as i64;
                        record.chunk_count = 0;
                        record.status = "pending".into();
                        #[cfg(not(feature = "local-embed"))]
                        {
                            record.status = "done".into();
                            record.chunk_count = record.total_chunks;
                        }
                        let mut store = runtime.store()?;
                        let inserted = store.insert_file(record)?;
                        store.replace_chunks(inserted.id, kb_id, &chunks)?;
                        drop(store);
                        #[cfg(feature = "local-embed")]
                        runtime.kick_worker(app, snapshot_settings(settings_store));
                        #[cfg(not(feature = "local-embed"))]
                        let _ = (app, settings_store);
                        return Ok(json!({ "id": inserted.id }));
                    }
                }
                Err(err) => {
                    record.status = "failed".into();
                    record.error = Some(err.message);
                }
            }

            let mut store = runtime.store()?;
            let inserted = store.insert_file(record)?;
            Ok(json!({ "id": inserted.id }))
        }
        "kb:search" => {
            let kb_id = arg_i64(args, 0)?;
            let query = arg_string(args, 1)?.trim().to_string();
            if query.is_empty() {
                return Err("Search query is required".to_string());
            }
            let (base, chunks, files) = {
                let store = runtime.store()?;
                let base = store
                    .get_base(kb_id)?
                    .ok_or_else(|| format!("knowledge base {kb_id} not found"))?;
                let chunks = store.list_chunks_for_kb(kb_id)?;
                let files = store.list_files(kb_id)?;
                (base, chunks, files)
            };
            let file_map: HashMap<i64, FileRecord> = files.into_iter().map(|f| (f.id, f)).collect();
            let candidates: Vec<SearchCandidate> = chunks
                .into_iter()
                .filter_map(|chunk| {
                    let file = file_map.get(&chunk.file_id)?;
                    Some(SearchCandidate {
                        file_id: chunk.file_id,
                        filename: file.filename.clone(),
                        mime_type: file.mime_type.clone(),
                        chunk_index: chunk.chunk_index,
                        text: chunk.text,
                        embedding: chunk.embedding,
                    })
                })
                .collect();

            let models_dir = runtime.models_dir();
            let kind = parse_model_id(&base.embedding_model);
            let creds = match &kind {
                ModelKind::Remote { provider, .. } => snapshot_settings(settings_store)
                    .as_ref()
                    .and_then(|s| lookup_provider_creds(s, provider)),
                _ => None,
            };
            let query_vec = embed_texts(
                &kind,
                &[query_prefix(&query)],
                &models_dir,
                creds.as_ref(),
            )
            .ok()
            .and_then(|mut rows| rows.pop());

            let rows = hybrid_search(&query, query_vec.as_deref(), &candidates);
            Ok(Value::Array(rows))
        }
        "kb:file:retry" => {
            let file_id = arg_i64(args, 0)?;
            let use_remote_parsing = arg(args, 1).ok().and_then(Value::as_bool).unwrap_or(false);
            let mut file = {
                let store = runtime.store()?;
                store
                    .get_file(file_id)?
                    .ok_or_else(|| format!("file {file_id} not found"))?
            };
            file.parsed_remotely = if use_remote_parsing { 1 } else { 0 };
            file.parser_type = if use_remote_parsing {
                "chatbox-ai".into()
            } else {
                "local".into()
            };
            file.error = None;
            file.chunk_count = 0;
            match parse_file(&file.filepath, &file.mime_type) {
                Ok(text) => {
                    let chunks = chunk_document(&text);
                    if chunks.is_empty() {
                        file.status = "failed".into();
                        file.total_chunks = 0;
                        file.error = Some("File parsed as empty text; nothing to index.".into());
                        let mut store = runtime.store()?;
                        store.clear_chunks(file.id)?;
                        store.update_file(&file)?;
                    } else {
                        file.total_chunks = chunks.len() as i64;
                        file.status = "pending".into();
                        let mut store = runtime.store()?;
                        store.replace_chunks(file.id, file.kb_id, &chunks)?;
                        store.update_file(&file)?;
                        drop(store);
                        if let Ok(mut worker) = runtime.inner.worker.lock() {
                            worker.paused.remove(&file_id);
                        }
                        runtime.kick_worker(app, snapshot_settings(settings_store));
                    }
                }
                Err(err) => {
                    file.status = "failed".into();
                    file.total_chunks = 0;
                    file.error = Some(err.message);
                    let mut store = runtime.store()?;
                    store.clear_chunks(file.id)?;
                    store.update_file(&file)?;
                }
            }
            Ok(json!({ "success": true }))
        }
        "kb:file:pause" => {
            let file_id = arg_i64(args, 0)?;
            if let Ok(mut worker) = runtime.inner.worker.lock() {
                worker.paused.insert(file_id);
            }
            let mut store = runtime.store()?;
            if let Some(mut file) = store.get_file(file_id)? {
                file.status = "paused".into();
                store.update_file(&file)?;
            }
            Ok(json!({ "success": true }))
        }
        "kb:file:resume" => {
            let file_id = arg_i64(args, 0)?;
            if let Ok(mut worker) = runtime.inner.worker.lock() {
                worker.paused.remove(&file_id);
            }
            let mut store = runtime.store()?;
            let mut file = store
                .get_file(file_id)?
                .ok_or_else(|| format!("file {file_id} not found"))?;
            file.status = "pending".into();
            file.error = None;
            store.update_file(&file)?;
            drop(store);
            runtime.kick_worker(app, snapshot_settings(settings_store));
            Ok(json!({ "success": true }))
        }
        "kb:file:delete" => {
            let file_id = arg_i64(args, 0)?;
            if let Ok(mut worker) = runtime.inner.worker.lock() {
                worker.paused.remove(&file_id);
            }
            let mut store = runtime.store()?;
            store.delete_file(file_id)?;
            Ok(json!({ "success": true }))
        }
        "kb:embed:status" => {
            let mut status = runtime.snapshot_status();
            let described = describe_local_status(&runtime.models_dir());
            if status.model_id.is_empty() {
                status.model_id = described.model_id;
            }
            if status.model_path.is_none() {
                status.model_path = described.model_path;
            }
            if status.reason.is_none() {
                status.reason = described.reason;
                status.ready = described.ready;
            }
            Ok(status.to_json())
        }
        other => Err(format!("unknown kb channel: {other}")),
    }
}

fn save_inbox_copy(runtime: &KbRuntime, filename: &str, text: &str) -> Result<String, String> {
    let root = runtime.models_dir();
    let inbox = root.parent().unwrap_or(&root).join("kb_inbox");
    std::fs::create_dir_all(&inbox).map_err(|e| format!("kb inbox: {e}"))?;
    let safe = filename.replace(['/', '\\'], "_");
    let path = inbox.join(format!("{}-{safe}", now_ms()));
    std::fs::write(&path, text).map_err(|e| format!("write inbox: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

fn file_list_json(file: FileRecord) -> Value {
    json!({
        "id": file.id,
        "kb_id": file.kb_id,
        "filename": file.filename,
        "filepath": file.filepath,
        "mime_type": file.mime_type,
        "file_size": file.file_size,
        "chunk_count": file.chunk_count,
        "total_chunks": file.total_chunks,
        "status": file.status,
        "error": file.error,
        "createdAt": file.created_at,
        "parsed_remotely": file.parsed_remotely,
        "parser_type": file.parser_type,
    })
}

fn snapshot_settings(settings_store: &Mutex<HashMap<String, Value>>) -> Option<Value> {
    let guard = settings_store.lock().ok()?;
    guard.get("settings").cloned()
}

fn arg<'a>(args: &'a [Value], idx: usize) -> CommandResult<&'a Value> {
    args.get(idx)
        .ok_or_else(|| format!("missing argument at index {idx}"))
}

fn arg_string(args: &[Value], idx: usize) -> CommandResult<String> {
    arg(args, idx)?
        .as_str()
        .map(std::string::ToString::to_string)
        .ok_or_else(|| format!("argument {idx} is not a string"))
}

fn arg_i64(args: &[Value], idx: usize) -> CommandResult<i64> {
    arg(args, idx)?
        .as_i64()
        .ok_or_else(|| format!("argument {idx} is not an integer"))
}
