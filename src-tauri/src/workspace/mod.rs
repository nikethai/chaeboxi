//! Native project workspace authority: picker-owned bindings, capabilities, and handle-relative ops.

mod authority;
mod error;
mod global_roots;
mod ignore;
mod path;
mod traverse;

pub use global_roots::is_native_known_global_root;

#[cfg(test)]
mod tests;

pub use authority::WorkspaceRuntime;
pub use error::WorkspaceError;

use serde_json::{json, Value};
use std::path::PathBuf;
use tauri::{AppHandle, Manager, WebviewWindow};

type CommandResult<T> = Result<T, String>;

fn arg_str(args: &[Value], idx: usize) -> Result<String, String> {
    args.get(idx)
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .ok_or_else(|| format!("workspace: missing string argument {idx}"))
}

fn arg_obj(args: &[Value], idx: usize) -> Result<&Value, String> {
    args.get(idx).ok_or_else(|| format!("workspace: missing argument {idx}"))
}

fn map_err(err: WorkspaceError) -> String {
    err.to_ipc_err()
}

fn window_label(window: &WebviewWindow) -> String {
    window.label().to_string()
}

/// Dispatch workspace:* plus narrow brokers. Returns None for unrelated channels.
pub fn handle(
    app: &AppHandle,
    window: &WebviewWindow,
    runtime: &WorkspaceRuntime,
    channel: &str,
    args: &[Value],
) -> Option<CommandResult<Value>> {
    if channel == "workspace:authorize-path" || channel == "workspace:bind-path" {
        return Some(Err(error::unauthorized_root(
            "Directory authorization requires the native folder picker; renderer paths are rejected",
        )
        .to_ipc_err()));
    }

    if !channel.starts_with("workspace:") && channel != "codex:read-auth-config" && channel != "video:yt-dlp" {
        return None;
    }

    Some(handle_inner(app, window, runtime, channel, args))
}

fn handle_inner(
    app: &AppHandle,
    window: &WebviewWindow,
    runtime: &WorkspaceRuntime,
    channel: &str,
    args: &[Value],
) -> CommandResult<Value> {
    let label = window_label(window);

    match channel {
        "workspace:pick-and-bind" => {
            let project_id = arg_str(args, 0)?;
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            {
                let folder = rfd::FileDialog::new()
                    .set_title("Open Project Folder")
                    .pick_folder();
                let Some(folder) = folder else {
                    return Ok(Value::Null);
                };
                runtime
                    .bind_picker_result(&project_id, &label, &folder)
                    .map_err(map_err)
            }
            #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
            {
                let _ = project_id;
                Err(error::WorkspaceError::new(
                    error::UNSUPPORTED_PLATFORM,
                    "Project folders are only available on desktop",
                )
                .to_ipc_err())
            }
        }
        "workspace:relink" => {
            let project_id = arg_str(args, 0)?;
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            {
                let folder = rfd::FileDialog::new()
                    .set_title("Locate Project Folder")
                    .pick_folder();
                let Some(folder) = folder else {
                    return Ok(Value::Null);
                };
                runtime.relink(&project_id, &label, &folder).map_err(map_err)
            }
            #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
            {
                let _ = project_id;
                Err(error::WorkspaceError::new(
                    error::UNSUPPORTED_PLATFORM,
                    "Project folders are only available on desktop",
                )
                .to_ipc_err())
            }
        }
        "workspace:restore" => {
            let project_id = arg_str(args, 0)?;
            runtime.restore(&project_id, &label).map_err(map_err)
        }
        "workspace:revoke" => {
            let project_id = arg_str(args, 0)?;
            runtime.revoke_project(&project_id, &label).map_err(map_err)?;
            Ok(Value::Null)
        }
        "workspace:unbind" => {
            let project_id = arg_str(args, 0)?;
            runtime.unbind(&project_id, &label).map_err(map_err)?;
            Ok(Value::Null)
        }
        "workspace:reveal" => {
            let project_id = arg_str(args, 0)?;
            let path = runtime.reveal_path(&project_id, &label).map_err(map_err)?;
            reveal_in_os(&path);
            Ok(json!({ "ok": true }))
        }
        "workspace:read" => {
            let opts = arg_obj(args, 0)?;
            let cap = opts.get("capabilityId").and_then(|v| v.as_str()).unwrap_or("");
            let rel = opts.get("relativePath").and_then(|v| v.as_str()).unwrap_or("");
            runtime.read(cap, &label, rel).map_err(map_err)
        }
        "workspace:list" => {
            let opts = arg_obj(args, 0)?;
            let cap = opts.get("capabilityId").and_then(|v| v.as_str()).unwrap_or("");
            let rel = opts.get("relativePath").and_then(|v| v.as_str()).unwrap_or("");
            let cursor = opts.get("cursor").and_then(|v| v.as_str());
            let request_id = opts.get("requestId").and_then(|v| v.as_str());
            runtime.list(cap, &label, rel, cursor, request_id).map_err(map_err)
        }
        "workspace:search" => {
            let opts = arg_obj(args, 0)?;
            let cap = opts.get("capabilityId").and_then(|v| v.as_str()).unwrap_or("");
            let query = opts.get("query").and_then(|v| v.as_str()).unwrap_or("");
            let request_id = opts.get("requestId").and_then(|v| v.as_str());
            runtime.search(cap, &label, query, request_id).map_err(map_err)
        }
        "workspace:cancel" => {
            let request_id = arg_str(args, 0)?;
            runtime.cancel_request(&request_id);
            Ok(Value::Null)
        }
        "workspace:create" => {
            let opts = arg_obj(args, 0)?;
            let cap = opts.get("capabilityId").and_then(|v| v.as_str()).unwrap_or("");
            let rel = opts.get("relativePath").and_then(|v| v.as_str()).unwrap_or("");
            let content = opts.get("content").and_then(|v| v.as_str()).unwrap_or("");
            let mode = opts.get("mode").and_then(|v| v.as_str()).unwrap_or("create");
            let expected = opts.get("expectedRevision").and_then(|v| v.as_str());
            runtime
                .create_file(cap, &label, rel, content, mode, expected)
                .map_err(map_err)
        }
        "workspace:edit" => {
            let opts = arg_obj(args, 0)?;
            let cap = opts.get("capabilityId").and_then(|v| v.as_str()).unwrap_or("");
            let rel = opts.get("relativePath").and_then(|v| v.as_str()).unwrap_or("");
            let old = opts.get("oldString").and_then(|v| v.as_str()).unwrap_or("");
            let new = opts.get("newString").and_then(|v| v.as_str()).unwrap_or("");
            let expected = opts.get("expectedRevision").and_then(|v| v.as_str()).unwrap_or("");
            runtime
                .edit_file(cap, &label, rel, old, new, expected)
                .map_err(map_err)
        }
        "workspace:delete" => {
            let opts = arg_obj(args, 0)?;
            let cap = opts.get("capabilityId").and_then(|v| v.as_str()).unwrap_or("");
            let rel = opts.get("relativePath").and_then(|v| v.as_str()).unwrap_or("");
            let expected = opts.get("expectedRevision").and_then(|v| v.as_str()).unwrap_or("");
            runtime
                .delete_file(cap, &label, rel, expected)
                .map_err(map_err)
        }
        "workspace:set-trust" => {
            let project_id = arg_str(args, 0)?;
            let category = arg_str(args, 1)?;
            let value = arg_str(args, 2)?;
            runtime.set_trust(&project_id, &label, &category, &value).map_err(map_err)?;
            Ok(Value::Null)
        }
        "workspace:get-trust" => {
            let project_id = arg_str(args, 0)?;
            match runtime.get_trust(&project_id) {
                Some(trust) => Ok(json!({
                    "files": trust.files,
                    "instructions": trust.instructions,
                    "skillsCommands": trust.skills_commands,
                    "hooks": trust.hooks,
                })),
                None => Ok(json!({
                    "files": "unset",
                    "instructions": "unset",
                    "skillsCommands": "unset",
                    "hooks": "unset",
                })),
            }
        }
        "workspace:set-mutation" => {
            if label != "main" {
                return Err(error::wrong_window().to_ipc_err());
            }
            let enabled = args
                .first()
                .and_then(|v| v.as_bool())
                .ok_or_else(|| "workspace:set-mutation requires boolean".to_string())?;
            runtime.set_mutation_enabled(enabled);
            Ok(json!({ "mutationEnabled": enabled }))
        }
        "codex:read-auth-config" => read_codex_auth(),
        "video:yt-dlp" => video_yt_dlp(args),
        _ => {
            let _ = app;
            Err(format!("unknown workspace channel: {channel}"))
        }
    }
}

fn reveal_in_os(path: &str) {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(path).spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer").arg(path).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(path).spawn();
    }
}

fn read_codex_auth() -> CommandResult<Value> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "HOME is not set".to_string())?;
    let path = PathBuf::from(home).join(".codex").join("auth.json");
    let content = std::fs::read_to_string(&path)
        .map_err(|err| format!("failed to read Codex auth.json: {err}"))?;
    Ok(Value::String(content))
}

fn video_yt_dlp(args: &[Value]) -> CommandResult<Value> {
    let op = arg_str(args, 0)?;
    match op.as_str() {
        "detect" => {
            let output = std::process::Command::new("yt-dlp")
                .arg("--version")
                .output();
            match output {
                Ok(out) if out.status.success() => {
                    let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    Ok(json!({ "installed": true, "version": version, "installer": "path" }))
                }
                _ => Ok(json!({ "installed": false, "installer": "none" })),
            }
        }
        "install" => {
            #[cfg(target_os = "macos")]
            {
                let output = std::process::Command::new("brew")
                    .args(["install", "yt-dlp"])
                    .output()
                    .map_err(|err| format!("brew failed: {err}"))?;
                let log = format!(
                    "{}{}",
                    String::from_utf8_lossy(&output.stdout),
                    String::from_utf8_lossy(&output.stderr)
                );
                return Ok(json!({ "ok": output.status.success(), "log": log }));
            }
            #[cfg(not(target_os = "macos"))]
            {
                Ok(json!({ "ok": false, "log": "", "error": "Use the OS package manager to install yt-dlp." }))
            }
        }
        _ => Err("video:yt-dlp unknown operation".into()),
    }
}

pub fn open_desktop(app: &AppHandle, runtime: &WorkspaceRuntime) {
    if let Ok(dir) = app.path().app_data_dir() {
        let _ = runtime.open_desktop(&dir);
        // Mutation stays off until the main window enables it from the product flag.
        runtime.set_mutation_enabled(false);
    }
}
