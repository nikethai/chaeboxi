//! Embedding backends for desktop RAG.
//!
//! Default model id: `local:multilingual-e5-small` (intfloat E5, 384-d).
//! Documents are prefixed with `passage:` and queries with `query:`.
//!
//! The local ONNX weights (~180MB) download once into app data
//! `models/multilingual-e5-small/` and then work offline (airplane mode).
//! They are not bundled in the installer.
//!
//! Inference uses fastembed/ONNX when the `local-embed` feature is enabled.
//! Without that runtime, search falls back to keyword scoring — no error toast.

use serde_json::{json, Value};
use std::path::{Path, PathBuf};

pub const LOCAL_E5_SMALL: &str = "local:multilingual-e5-small";
#[allow(dead_code)]
pub const E5_DIMS: usize = 384;
pub const EMBED_BATCH_SIZE: usize = 8;

const MODEL_ONNX_URL: &str =
    "https://huggingface.co/intfloat/multilingual-e5-small/resolve/main/onnx/model.onnx";
const TOKENIZER_URL: &str =
    "https://huggingface.co/intfloat/multilingual-e5-small/resolve/main/tokenizer.json";
const TOKENIZER_CONFIG_URL: &str =
    "https://huggingface.co/intfloat/multilingual-e5-small/resolve/main/tokenizer_config.json";

#[derive(Debug, Clone)]
pub enum ModelKind {
    LocalE5,
    Ollama { model: String },
    Remote { provider: String, model: String },
}

#[derive(Debug, Clone)]
pub struct EmbedStatus {
    pub ready: bool,
    pub model_id: String,
    pub model_path: Option<String>,
    pub downloading: bool,
    pub progress: f32,
    pub reason: Option<String>,
    pub active_file_id: Option<i64>,
    pub active_filename: Option<String>,
    pub embedded_chunks: i64,
    pub total_chunks: i64,
}

impl EmbedStatus {
    pub fn idle(model_id: &str) -> Self {
        Self {
            ready: false,
            model_id: model_id.to_string(),
            model_path: None,
            downloading: false,
            progress: 0.0,
            reason: None,
            active_file_id: None,
            active_filename: None,
            embedded_chunks: 0,
            total_chunks: 0,
        }
    }

    pub fn to_json(&self) -> Value {
        json!({
            "ready": self.ready,
            "modelId": self.model_id,
            "modelPath": self.model_path,
            "downloading": self.downloading,
            "progress": self.progress,
            "reason": self.reason,
            "activeFileId": self.active_file_id,
            "activeFilename": self.active_filename,
            "embeddedChunks": self.embedded_chunks,
            "totalChunks": self.total_chunks,
        })
    }
}

pub fn parse_model_id(model_id: &str) -> ModelKind {
    let trimmed = model_id.trim();
    if trimmed.is_empty() || trimmed == LOCAL_E5_SMALL || trimmed.starts_with("local:") {
        return ModelKind::LocalE5;
    }
    let (provider, model) = match trimmed.split_once(':') {
        Some((p, m)) if !p.is_empty() && !m.is_empty() => (p, m),
        _ => return ModelKind::LocalE5,
    };
    if provider.eq_ignore_ascii_case("ollama") {
        ModelKind::Ollama {
            model: model.to_string(),
        }
    } else {
        ModelKind::Remote {
            provider: provider.to_string(),
            model: model.to_string(),
        }
    }
}

pub fn passage_prefix(text: &str) -> String {
    if text.starts_with("passage:") {
        text.to_string()
    } else {
        format!("passage: {text}")
    }
}

pub fn query_prefix(text: &str) -> String {
    if text.starts_with("query:") {
        text.to_string()
    } else {
        format!("query: {text}")
    }
}

pub fn local_model_dir(models_root: &Path) -> PathBuf {
    models_root.join("multilingual-e5-small")
}

pub fn model_files_present(dir: &Path) -> bool {
    dir.join("model.onnx").is_file() && dir.join("tokenizer.json").is_file()
}

pub fn describe_local_status(models_root: &Path) -> EmbedStatus {
    let dir = local_model_dir(models_root);
    let mut status = EmbedStatus::idle(LOCAL_E5_SMALL);
    status.model_path = Some(dir.display().to_string());
    if model_files_present(&dir) {
        #[cfg(feature = "local-embed")]
        {
            status.ready = true;
            status.reason = None;
        }
        #[cfg(not(feature = "local-embed"))]
        {
            status.ready = false;
            status.reason = Some(
                "Model files are cached on disk (airplane mode OK) but the local ONNX runtime is not linked in this build. Search uses keywords until embeddings are written."
                    .into(),
            );
        }
    } else {
        status.ready = false;
        status.reason = Some(
            "On-device model not downloaded yet (~180MB, once). Search uses keywords until then."
                .into(),
        );
    }
    status
}

/// Download E5 ONNX + tokenizer into `models/multilingual-e5-small/`.
/// Safe to call repeatedly; skips files that already exist.
pub fn ensure_local_model(models_root: &Path) -> Result<PathBuf, String> {
    let dir = local_model_dir(models_root);
    std::fs::create_dir_all(&dir).map_err(|e| format!("create model dir: {e}"))?;
    download_if_missing(&dir.join("model.onnx"), MODEL_ONNX_URL)?;
    download_if_missing(&dir.join("tokenizer.json"), TOKENIZER_URL)?;
    download_if_missing(&dir.join("tokenizer_config.json"), TOKENIZER_CONFIG_URL)?;
    Ok(dir)
}

fn download_if_missing(path: &Path, url: &str) -> Result<(), String> {
    if path.is_file() {
        return Ok(());
    }
    let tmp = path.with_extension("part");
    let bytes = download_bytes(url)?;
    std::fs::write(&tmp, bytes).map_err(|e| format!("write {}: {e}", tmp.display()))?;
    std::fs::rename(&tmp, path).map_err(|e| format!("rename {}: {e}", path.display()))?;
    Ok(())
}

fn download_bytes(url: &str) -> Result<Vec<u8>, String> {
    // Blocking reqwest keeps the embed worker simple (one batch at a time).
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| format!("http client: {e}"))?;
    let response = client
        .get(url)
        .header("user-agent", "chaeboxi-kb/1.0")
        .send()
        .map_err(|e| format!("download {url}: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("download {url}: HTTP {}", response.status()));
    }
    response
        .bytes()
        .map(|b| b.to_vec())
        .map_err(|e| format!("read {url}: {e}"))
}

#[derive(Debug, Clone)]
pub struct ProviderCreds {
    pub api_host: String,
    pub api_key: String,
}

/// Embed a batch of already-prefixed texts.
pub fn embed_texts(
    kind: &ModelKind,
    texts: &[String],
    models_root: &Path,
    creds: Option<&ProviderCreds>,
) -> Result<Vec<Vec<f32>>, String> {
    if texts.is_empty() {
        return Ok(Vec::new());
    }
    match kind {
        ModelKind::LocalE5 => embed_local(texts, models_root),
        ModelKind::Ollama { model } => embed_ollama(model, texts),
        ModelKind::Remote { provider, model } => {
            let creds = creds.ok_or_else(|| {
                format!("Provider '{provider}' has no API key on this device; text would leave the machine")
            })?;
            embed_openai_compatible(model, texts, creds)
        }
    }
}

fn embed_local(texts: &[String], models_root: &Path) -> Result<Vec<Vec<f32>>, String> {
    let dir = local_model_dir(models_root);
    if !model_files_present(&dir) {
        return Err("local model files are not downloaded yet".into());
    }
    #[cfg(feature = "local-embed")]
    {
        return onnx_embed(&dir, texts);
    }
    #[cfg(not(feature = "local-embed"))]
    {
        let _ = texts;
        Err(
            "local ONNX runtime is not linked in this build; keyword search is active"
                .into(),
        )
    }
}

#[cfg(feature = "local-embed")]
fn onnx_embed(model_dir: &Path, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
    use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};
    let cache = model_dir
        .parent()
        .unwrap_or(model_dir)
        .to_path_buf();
    let mut model = TextEmbedding::try_new(
        InitOptions::new(EmbeddingModel::MultilingualE5Small).with_cache_dir(cache),
    )
    .map_err(|e| format!("init local e5: {e}"))?;
    // Prefixes are already applied by the caller; disable library prefixes if possible.
    model
        .embed(texts.to_vec(), None)
        .map_err(|e| format!("local e5 embed: {e}"))
}

fn embed_ollama(model: &str, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;
    let body = json!({ "model": model, "input": texts });
    let response = client
        .post("http://127.0.0.1:11434/api/embed")
        .json(&body)
        .send()
        .map_err(|e| format!("ollama embed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("ollama embed: HTTP {}", response.status()));
    }
    let value: Value = response.json().map_err(|e| format!("ollama json: {e}"))?;
    parse_embedding_matrix(&value, &["embeddings", "embedding"])
}

fn embed_openai_compatible(
    model: &str,
    texts: &[String],
    creds: &ProviderCreds,
) -> Result<Vec<Vec<f32>>, String> {
    let host = creds.api_host.trim().trim_end_matches('/');
    let url = if host.is_empty() {
        "https://api.openai.com/v1/embeddings".to_string()
    } else if host.ends_with("/embeddings") {
        host.to_string()
    } else if host.ends_with("/v1") {
        format!("{host}/embeddings")
    } else {
        format!("{host}/v1/embeddings")
    };
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;
    let body = json!({ "model": model, "input": texts });
    let response = client
        .post(&url)
        .bearer_auth(&creds.api_key)
        .json(&body)
        .send()
        .map_err(|e| format!("remote embed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("remote embed: HTTP {}", response.status()));
    }
    let value: Value = response.json().map_err(|e| format!("remote embed json: {e}"))?;
    if let Some(data) = value.get("data").and_then(|v| v.as_array()) {
        let mut out = Vec::new();
        for item in data {
            if let Some(arr) = item.get("embedding").and_then(|v| v.as_array()) {
                out.push(json_f32_array(arr)?);
            }
        }
        if out.len() == texts.len() {
            return Ok(out);
        }
    }
    parse_embedding_matrix(&value, &["embeddings", "embedding"])
}

fn parse_embedding_matrix(value: &Value, keys: &[&str]) -> Result<Vec<Vec<f32>>, String> {
    for key in keys {
        if let Some(arr) = value.get(*key) {
            if let Some(rows) = arr.as_array() {
                if rows.first().and_then(|v| v.as_array()).is_some() {
                    let mut out = Vec::new();
                    for row in rows {
                        out.push(json_f32_array(row.as_array().unwrap())?);
                    }
                    return Ok(out);
                }
                if rows.first().and_then(|v| v.as_f64()).is_some() {
                    return Ok(vec![json_f32_array(rows)?]);
                }
            }
        }
    }
    Err("embedding response did not contain a numeric matrix".into())
}

fn json_f32_array(arr: &[Value]) -> Result<Vec<f32>, String> {
    arr.iter()
        .map(|v| {
            v.as_f64()
                .map(|f| f as f32)
                .ok_or_else(|| "non-numeric embedding value".to_string())
        })
        .collect()
}

pub fn lookup_provider_creds(
    settings: &Value,
    provider_id: &str,
) -> Option<ProviderCreds> {
    let providers = settings.get("providers")?;
    let entry = providers.get(provider_id)?;
    let api_key = entry
        .get("apiKey")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())?
        .to_string();
    let api_host = entry
        .get("apiHost")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    Some(ProviderCreds { api_host, api_key })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefixes_are_stable() {
        assert_eq!(passage_prefix("hello"), "passage: hello");
        assert_eq!(query_prefix("hello"), "query: hello");
        assert_eq!(passage_prefix("passage: hello"), "passage: hello");
    }

    #[test]
    fn model_id_parses() {
        match parse_model_id("local:multilingual-e5-small") {
            ModelKind::LocalE5 => {}
            other => panic!("expected local, got {other:?}"),
        }
        match parse_model_id("ollama:nomic-embed-text") {
            ModelKind::Ollama { model } => assert_eq!(model, "nomic-embed-text"),
            other => panic!("expected ollama, got {other:?}"),
        }
        match parse_model_id("openai:text-embedding-3-small") {
            ModelKind::Remote { provider, model } => {
                assert_eq!(provider, "openai");
                assert_eq!(model, "text-embedding-3-small");
            }
            other => panic!("expected remote, got {other:?}"),
        }
        match parse_model_id("") {
            ModelKind::LocalE5 => {}
            other => panic!("empty should default local, got {other:?}"),
        }
    }
}
