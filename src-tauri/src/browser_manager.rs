//! Isolated browser session manager (Playwright host over stdio JSON-RPC).
#![cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]

use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{oneshot, Mutex};
use tokio::time::timeout;

const DEFAULT_TIMEOUT_MS: u64 = 30_000;

struct Pending {
    tx: oneshot::Sender<Result<Value, String>>,
}

struct HostProcess {
    child: Child,
    stdin: ChildStdin,
    pending: Arc<Mutex<HashMap<u64, Pending>>>,
    next_id: AtomicU64,
}

pub struct BrowserManager {
    hosts: Mutex<HashMap<String, HostProcess>>,
}

impl Default for BrowserManager {
    fn default() -> Self {
        Self {
            hosts: Mutex::new(HashMap::new()),
        }
    }
}

fn host_script_candidates(app: &AppHandle) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        paths.push(cwd.join("src-tauri/sidecars/browser-host/index.mjs"));
        paths.push(cwd.join("sidecars/browser-host/index.mjs"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            paths.push(dir.join("sidecars/browser-host/index.mjs"));
            paths.push(dir.join("../sidecars/browser-host/index.mjs"));
            paths.push(dir.join("../../sidecars/browser-host/index.mjs"));
        }
    }
    if let Ok(resource) = app.path().resource_dir() {
        paths.push(resource.join("sidecars/browser-host/index.mjs"));
    }
    // Dev: relative to crate
    paths.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("sidecars/browser-host/index.mjs"));
    paths
}

fn resolve_host_script(app: &AppHandle) -> Result<PathBuf, String> {
    for p in host_script_candidates(app) {
        if p.exists() {
            return Ok(p);
        }
    }
    Err(
        "Browser host script not found (src-tauri/sidecars/browser-host/index.mjs). Install deps with npm install in that folder."
            .into(),
    )
}

fn profile_dir(app: &AppHandle, session_id: &str) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir: {e}"))?;
    let safe: String = session_id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let dir = base.join("browser-profiles").join(safe);
    std::fs::create_dir_all(&dir).map_err(|e| format!("create profile dir: {e}"))?;
    Ok(dir)
}

impl BrowserManager {
    pub async fn stop_all(&self) {
        let mut hosts = self.hosts.lock().await;
        let keys: Vec<String> = hosts.keys().cloned().collect();
        for k in keys {
            if let Some(mut host) = hosts.remove(&k) {
                let _ = host.rpc("session.stop", json!({})).await;
                let _ = host.child.kill().await;
            }
        }
    }

    pub async fn handle(
        &self,
        app: &AppHandle,
        channel: &str,
        args: &[Value],
    ) -> Option<Result<Value, String>> {
        if !channel.starts_with("browser:") {
            return None;
        }
        Some(self.dispatch(app, channel, args).await)
    }

    async fn dispatch(
        &self,
        app: &AppHandle,
        channel: &str,
        args: &[Value],
    ) -> Result<Value, String> {
        match channel {
            "browser:session:start" => {
                let params = arg_object(args, 0)?;
                let session_id = params
                    .get("sessionId")
                    .and_then(|v| v.as_str())
                    .ok_or("sessionId required")?
                    .to_string();
                self.start_session(app, &session_id, &params).await
            }
            "browser:session:stop" => {
                let params = arg_object(args, 0)?;
                let session_id = params
                    .get("sessionId")
                    .and_then(|v| v.as_str())
                    .ok_or("sessionId required")?;
                self.stop_session(session_id).await
            }
            "browser:session:status" => {
                let params = arg_object(args, 0)?;
                let session_id = params
                    .get("sessionId")
                    .and_then(|v| v.as_str())
                    .ok_or("sessionId required")?;
                self.rpc(session_id, "session.status", json!({})).await
            }
            "browser:navigate" => {
                let params = arg_object(args, 0)?;
                let session_id = require_session(&params)?;
                let url = params
                    .get("url")
                    .and_then(|v| v.as_str())
                    .ok_or("url required")?;
                validate_http_url(url)?;
                self.rpc(session_id, "navigate", json!({ "url": url })).await
            }
            "browser:snapshot" => {
                let params = arg_object(args, 0)?;
                let session_id = require_session(&params)?;
                self.rpc(session_id, "snapshot", params.clone()).await
            }
            "browser:act" => {
                let params = arg_object(args, 0)?;
                let session_id = require_session(&params)?;
                self.rpc(session_id, "act", params.clone()).await
            }
            "browser:tabs" => {
                let params = arg_object(args, 0)?;
                let session_id = require_session(&params)?;
                self.rpc(session_id, "tabs", params.clone()).await
            }
            "browser:screenshot" => {
                let params = arg_object(args, 0)?;
                let session_id = require_session(&params)?;
                self.rpc(session_id, "screenshot", json!({})).await
            }
            "browser:session:wipe" => {
                let params = arg_object(args, 0)?;
                let session_id = params
                    .get("sessionId")
                    .and_then(|v| v.as_str())
                    .ok_or("sessionId required")?;
                let _ = self.stop_session(session_id).await;
                let dir = profile_dir(app, session_id)?;
                if dir.exists() {
                    std::fs::remove_dir_all(&dir)
                        .map_err(|e| format!("wipe profile failed: {e}"))?;
                }
                Ok(json!({ "wiped": true }))
            }
            other => Err(format!("unknown browser channel: {other}")),
        }
    }

    async fn start_session(
        &self,
        app: &AppHandle,
        session_id: &str,
        params: &Value,
    ) -> Result<Value, String> {
        // Replace existing
        let _ = self.stop_session(session_id).await;

        let script = resolve_host_script(app)?;
        let user_data = profile_dir(app, session_id)?;
        let headless = params
            .get("headless")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let downloads_enabled = params
            .get("downloadsEnabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let download_dir = params
            .get("downloadDir")
            .and_then(|v| v.as_str())
            .map(PathBuf::from);
        if downloads_enabled {
            if let Some(ref d) = download_dir {
                std::fs::create_dir_all(d).map_err(|e| format!("download dir: {e}"))?;
            }
        }
        let allowlist = params
            .get("allowlist")
            .cloned()
            .unwrap_or_else(|| json!([]));
        let channel = params.get("channel").and_then(|v| v.as_str());

        let mut child = Command::new("node")
            .arg(&script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| {
                format!(
                    "Failed to spawn browser host (is Node.js installed?): {e}"
                )
            })?;

        let stdin = child.stdin.take().ok_or("browser host stdin missing")?;
        let stdout = child.stdout.take().ok_or("browser host stdout missing")?;
        let pending: Arc<Mutex<HashMap<u64, Pending>>> = Arc::new(Mutex::new(HashMap::new()));
        let pending_reader = pending.clone();

        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let Ok(msg) = serde_json::from_str::<Value>(&line) else {
                    continue;
                };
                if let Some(id) = msg.get("id").and_then(|v| v.as_u64()) {
                    let mut map = pending_reader.lock().await;
                    if let Some(p) = map.remove(&id) {
                        if let Some(err) = msg.get("error") {
                            let message = err
                                .get("message")
                                .and_then(|v| v.as_str())
                                .unwrap_or("browser host error")
                                .to_string();
                            let code = err
                                .get("code")
                                .and_then(|v| v.as_str())
                                .unwrap_or("ACTION_ERROR");
                            let _ = p.tx.send(Err(format!("{code}: {message}")));
                        } else {
                            let result = msg.get("result").cloned().unwrap_or(Value::Null);
                            let _ = p.tx.send(Ok(result));
                        }
                    }
                }
            }
        });

        let host = HostProcess {
            child,
            stdin,
            pending,
            next_id: AtomicU64::new(1),
        };

        let start_params = json!({
            "userDataDir": user_data.to_string_lossy(),
            "headless": headless,
            "downloadsEnabled": downloads_enabled,
            "downloadDir": download_dir.as_ref().map(|p| p.to_string_lossy().to_string()),
            "allowlist": allowlist,
            "channel": channel,
            "viewport": params.get("viewport").cloned().unwrap_or(json!({"width": 1280, "height": 800})),
        });

        // Temporarily insert to use rpc — use direct call
        let result = {
            let mut hosts = self.hosts.lock().await;
            hosts.insert(session_id.to_string(), host);
            // drop lock before await via scope
        };
        let _ = result;

        match self.rpc(session_id, "session.start", start_params).await {
            Ok(v) => Ok(json!({
                "sessionId": session_id,
                "userDataDir": user_data.to_string_lossy(),
                "result": v,
            })),
            Err(e) => {
                let _ = self.stop_session(session_id).await;
                Err(e)
            }
        }
    }

    async fn stop_session(&self, session_id: &str) -> Result<Value, String> {
        let mut hosts = self.hosts.lock().await;
        if let Some(mut host) = hosts.remove(session_id) {
            let _ = timeout(Duration::from_secs(3), host.rpc("session.stop", json!({}))).await;
            let _ = host.child.kill().await;
            Ok(json!({ "stopped": true, "sessionId": session_id }))
        } else {
            Ok(json!({ "stopped": false, "sessionId": session_id, "reason": "not_running" }))
        }
    }

    async fn rpc(&self, session_id: &str, method: &str, params: Value) -> Result<Value, String> {
        let mut hosts = self.hosts.lock().await;
        let host = hosts
            .get_mut(session_id)
            .ok_or_else(|| "SESSION_NOT_FOUND: browser session not started".to_string())?;
        host.rpc(method, params).await
    }
}

impl HostProcess {
    async fn rpc(&mut self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = oneshot::channel();
        {
            let mut pending = self.pending.lock().await;
            pending.insert(id, Pending { tx });
        }
        let msg = json!({ "id": id, "method": method, "params": params });
        let line = format!("{msg}\n");
        self.stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| format!("write to browser host failed: {e}"))?;
        self.stdin
            .flush()
            .await
            .map_err(|e| format!("flush browser host failed: {e}"))?;

        match timeout(Duration::from_millis(DEFAULT_TIMEOUT_MS + 5_000), rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err("ACTION_TIMEOUT: browser host closed".into()),
            Err(_) => {
                let mut pending = self.pending.lock().await;
                pending.remove(&id);
                Err("ACTION_TIMEOUT: browser action timed out".into())
            }
        }
    }
}

fn arg_object(args: &[Value], idx: usize) -> Result<Value, String> {
    let v = args
        .get(idx)
        .cloned()
        .ok_or_else(|| format!("missing arg {idx}"))?;
    if let Some(s) = v.as_str() {
        serde_json::from_str(s).map_err(|e| format!("invalid json arg: {e}"))
    } else if v.is_object() {
        Ok(v)
    } else {
        Err("expected object arg".into())
    }
}

fn require_session(params: &Value) -> Result<&str, String> {
    params
        .get("sessionId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "sessionId required".to_string())
}

fn validate_http_url(url: &str) -> Result<(), String> {
    let parsed = url::Url::parse(url).map_err(|_| "SECURITY_BLOCKED: invalid URL".to_string())?;
    match parsed.scheme() {
        "http" | "https" => Ok(()),
        _ => Err("SECURITY_BLOCKED: only http(s) URLs allowed".into()),
    }
}

/// Best-effort wipe helper for tests / external callers.
#[allow(dead_code)]
pub fn wipe_profile_path(path: &Path) -> std::io::Result<()> {
    if path.exists() {
        std::fs::remove_dir_all(path)?;
    }
    Ok(())
}
