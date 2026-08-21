//! macOS AXUIElement walk + focus/press.

use super::matchers::{
    looks_like_search, matches_role_filter, name_matches, normalize_role_filter, parse_path_id,
    sanitize_app_name,
};
use serde_json::{json, Value};
use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_void};
use tokio::process::Command;

const MAX_WALK_NODES: usize = 400;
const MAX_DEPTH: usize = 14;
const DEFAULT_LIMIT: usize = 20;
const HARD_LIMIT: usize = 32;

type AXUIElementRef = *mut c_void;
type CFTypeRef = *const c_void;
type CFStringRef = *const c_void;
type CFArrayRef = *const c_void;

const K_CF_STRING_ENCODING_UTF8: u32 = 0x0800_0100;
const AX_OK: i32 = 0;

#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXUIElementCreateApplication(pid: i32) -> AXUIElementRef;
    fn AXUIElementCopyAttributeValue(
        element: AXUIElementRef,
        attribute: CFStringRef,
        value: *mut CFTypeRef,
    ) -> i32;
    fn AXUIElementSetAttributeValue(
        element: AXUIElementRef,
        attribute: CFStringRef,
        value: CFTypeRef,
    ) -> i32;
    fn AXUIElementPerformAction(element: AXUIElementRef, action: CFStringRef) -> i32;
    fn AXIsProcessTrusted() -> bool;
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFStringCreateWithCString(
        alloc: *const c_void,
        c_str: *const c_char,
        encoding: u32,
    ) -> CFStringRef;
    fn CFRelease(cf: CFTypeRef);
    fn CFRetain(cf: CFTypeRef) -> CFTypeRef;
    fn CFGetTypeID(cf: CFTypeRef) -> usize;
    fn CFStringGetTypeID() -> usize;
    fn CFArrayGetTypeID() -> usize;
    fn CFArrayGetCount(the_array: CFArrayRef) -> isize;
    fn CFArrayGetValueAtIndex(the_array: CFArrayRef, idx: isize) -> CFTypeRef;
    fn CFStringGetLength(the_string: CFStringRef) -> isize;
    fn CFStringGetCString(
        the_string: CFStringRef,
        buffer: *mut c_char,
        buffer_size: isize,
        encoding: u32,
    ) -> bool;
    static kCFBooleanTrue: CFTypeRef;
}

struct Hit {
    id: String,
    role: String,
    title: String,
    description: String,
    placeholder: String,
    path: Vec<usize>,
}

pub async fn dispatch(kind: &str, params: &Value) -> Result<Value, String> {
    if !unsafe { AXIsProcessTrusted() } {
        return Ok(json!({
            "ok": false,
            "error": "PERMISSION_DENIED",
            "fallback": "vision",
            "note": "Enable Accessibility for this Chaeboxi binary (Settings → Computer Use → Recheck), then retry. Until then use screenshots."
        }));
    }

    let app_hint = params
        .get("app")
        .and_then(|v| v.as_str())
        .map(sanitize_app_name)
        .filter(|s| !s.is_empty());
    let (pid, app_name) = resolve_pid(app_hint.as_deref()).await?;
    let role = normalize_role_filter(params.get("role").and_then(|v| v.as_str()).unwrap_or("any"));
    let limit = params
        .get("limit")
        .and_then(|v| v.as_u64())
        .map(|n| n as usize)
        .unwrap_or(DEFAULT_LIMIT)
        .clamp(1, HARD_LIMIT);

    if kind == "query" {
        return tokio::task::spawn_blocking(move || query_sync(pid, app_name, role, limit))
            .await
            .map_err(|e| format!("ax query join: {e}"))?;
    }

    let action = params
        .get("action")
        .and_then(|v| v.as_str())
        .unwrap_or("focus")
        .to_ascii_lowercase();
    if action != "focus" && action != "press" {
        return Err("action must be focus or press".into());
    }
    let name = params
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .chars()
        .take(80)
        .collect::<String>();
    let id = params
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let index = params.get("index").and_then(|v| v.as_u64()).map(|n| n as usize);
    let role_owned = role.to_string();

    tokio::task::spawn_blocking(move || {
        act_sync(pid, app_name, &action, &role_owned, &name, &id, index, limit)
    })
    .await
    .map_err(|e| format!("ax act join: {e}"))?
}

async fn resolve_pid(app: Option<&str>) -> Result<(i32, String), String> {
    let script = match app {
        Some(name) => format!(
            r#"tell application "System Events"
  try
set proc to first application process whose name contains "{name}"
return (unix id of proc as text) & tab & (name of proc)
  on error
return ""
  end try
end tell"#
        ),
        None => r#"tell application "System Events"
  try
set proc to first application process whose frontmost is true
return (unix id of proc as text) & tab & (name of proc)
  on error
return ""
  end try
end tell"#
            .to_string(),
    };
    let output = Command::new("osascript")
        .args(["-e", &script])
        .output()
        .await
        .map_err(|e| format!("AX pid query failed: {e}"))?;
    let line = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if line.is_empty() {
        return Err(format!(
            "AX_APP_NOT_FOUND: could not resolve process{}. Open the app first.",
            app.map(|n| format!(" for “{n}”")).unwrap_or_default()
        ));
    }
    let mut parts = line.split('\t');
    let pid = parts
        .next()
        .and_then(|s| s.trim().parse::<i32>().ok())
        .ok_or_else(|| format!("AX_APP_NOT_FOUND: bad pid line {line:?}"))?;
    let name = parts.next().unwrap_or("").trim().to_string();
    Ok((pid, name))
}

fn query_sync(pid: i32, app_name: String, role: &'static str, limit: usize) -> Result<Value, String> {
    let hits = collect_hits(pid, role, "", limit)?;
    if hits.is_empty() {
        return Ok(json!({
            "ok": false,
            "error": "AX_EMPTY",
            "fallback": "vision",
            "app": app_name,
            "pid": pid,
            "elements": [],
            "note": "No matching AX nodes (common for some Electron apps). Use the screenshot playbook."
        }));
    }
    Ok(json!({
        "ok": true,
        "app": app_name,
        "pid": pid,
        "elements": hits.iter().map(hit_json).collect::<Vec<_>>(),
        "note": "Prefer computer_focus_search / computer_ax_press with id or name. Vision if this list is wrong."
    }))
}

fn act_sync(
    pid: i32,
    app_name: String,
    action: &str,
    role: &str,
    name: &str,
    id: &str,
    index: Option<usize>,
    limit: usize,
) -> Result<Value, String> {
    let path = if let Some(p) = parse_path_id(id) {
        Some(p)
    } else {
        let hits = collect_hits(pid, role, name, limit)?;
        if hits.is_empty() {
            return Ok(json!({
                "ok": false,
                "error": "AX_EMPTY",
                "fallback": "vision",
                "app": app_name,
                "pid": pid,
                "acted": false,
                "note": "No AX match. Click/type from the verification screenshot."
            }));
        }
        let pick = index.unwrap_or(0);
        hits.get(pick).map(|h| h.path.clone())
    };
    let Some(path) = path else {
        return Ok(json!({
            "ok": false,
            "error": "AX_EMPTY",
            "fallback": "vision",
            "acted": false,
            "note": "index out of range. Call computer_ax_query first."
        }));
    };

    unsafe {
        let app = AXUIElementCreateApplication(pid);
        if app.is_null() {
            return Err("AX_CREATE_FAILED".into());
        }
        let target = match follow_path(app, &path) {
            Some(el) => el,
            None => {
                CFRelease(app as CFTypeRef);
                return Ok(json!({
                    "ok": false,
                    "error": "AX_STALE",
                    "fallback": "vision",
                    "acted": false,
                    "note": "AX path went stale. Query again or use vision."
                }));
            }
        };

        let mut focused = false;
        let attr = cf_string("AXFocused");
        if !attr.is_null() {
            focused = AXUIElementSetAttributeValue(target, attr, kCFBooleanTrue) == AX_OK;
            CFRelease(attr);
        }

        let mut pressed = false;
        if action == "press" {
            let act = cf_string("AXPress");
            if !act.is_null() {
                pressed = AXUIElementPerformAction(target, act) == AX_OK;
                CFRelease(act);
            }
        }

        CFRelease(target as CFTypeRef);
        CFRelease(app as CFTypeRef);

        if action == "press" && !pressed && !focused {
            return Ok(json!({
                "ok": false,
                "error": "AX_ACT_FAILED",
                "fallback": "vision",
                "acted": false,
                "app": app_name,
                "note": "AX press/focus failed. Use computer_click on the verification image."
            }));
        }
        if action == "focus" && !focused {
            return Ok(json!({
                "ok": false,
                "error": "AX_ACT_FAILED",
                "fallback": "vision",
                "acted": false,
                "app": app_name,
                "note": "Could not focus AX node. Click the control from the screenshot."
            }));
        }

        Ok(json!({
            "ok": true,
            "acted": true,
            "action": action,
            "app": app_name,
            "pid": pid,
            "focused": focused,
            "pressed": pressed,
            "note": "Host attaches a verification screenshot. Continue the playbook (type / next button)."
        }))
    }
}

fn collect_hits(pid: i32, role: &str, name: &str, limit: usize) -> Result<Vec<Hit>, String> {
    unsafe {
        let app = AXUIElementCreateApplication(pid);
        if app.is_null() {
            return Err("AX_CREATE_FAILED".into());
        }
        let mut hits = Vec::new();
        let mut walked = 0usize;
        walk(app, &[], 0, role, name, limit, &mut walked, &mut hits);
        CFRelease(app as CFTypeRef);
        hits.sort_by_key(|h| {
            let search_first = if looks_like_search(&h.role, &h.title, &h.description, &h.placeholder) {
                0
            } else {
                1
            };
            (search_first, h.path.len())
        });
        if hits.len() > limit {
            hits.truncate(limit);
        }
        Ok(hits)
    }
}

fn walk(
    el: AXUIElementRef,
    path: &[usize],
    depth: usize,
    role_filter: &str,
    name: &str,
    limit: usize,
    walked: &mut usize,
    hits: &mut Vec<Hit>,
) {
    if el.is_null() || depth > MAX_DEPTH || *walked >= MAX_WALK_NODES || hits.len() >= limit {
        return;
    }
    *walked += 1;

    let role = string_attr(el, "AXRole");
    let title = string_attr(el, "AXTitle");
    let description = string_attr(el, "AXDescription");
    let placeholder = string_attr(el, "AXPlaceholderValue");

    if !role.is_empty()
        && matches_role_filter(role_filter, &role, &title, &description, &placeholder)
        && name_matches(name, &title, &description, &placeholder)
    {
        hits.push(Hit {
            id: path.iter().map(|n| n.to_string()).collect::<Vec<_>>().join("."),
            role,
            title,
            description,
            placeholder,
            path: path.to_vec(),
        });
    }

    let Some(children) = copy_attr(el, "AXChildren") else {
        return;
    };
    unsafe {
        if CFGetTypeID(children) != CFArrayGetTypeID() {
            CFRelease(children);
            return;
        }
        let count = CFArrayGetCount(children as CFArrayRef);
        for i in 0..count {
            if hits.len() >= limit || *walked >= MAX_WALK_NODES {
                break;
            }
            let child = CFArrayGetValueAtIndex(children as CFArrayRef, i) as AXUIElementRef;
            let mut next = path.to_vec();
            next.push(i as usize);
            walk(
                child,
                &next,
                depth + 1,
                role_filter,
                name,
                limit,
                walked,
                hits,
            );
        }
        CFRelease(children);
    }
}

fn follow_path(app: AXUIElementRef, path: &[usize]) -> Option<AXUIElementRef> {
    unsafe {
        let mut current = CFRetain(app as CFTypeRef) as AXUIElementRef;
        for idx in path {
            let Some(children) = copy_attr(current, "AXChildren") else {
                CFRelease(current as CFTypeRef);
                return None;
            };
            if CFGetTypeID(children) != CFArrayGetTypeID() {
                CFRelease(children);
                CFRelease(current as CFTypeRef);
                return None;
            }
            let count = CFArrayGetCount(children as CFArrayRef);
            if *idx >= count as usize {
                CFRelease(children);
                CFRelease(current as CFTypeRef);
                return None;
            }
            let child = CFArrayGetValueAtIndex(children as CFArrayRef, *idx as isize);
            if child.is_null() {
                CFRelease(children);
                CFRelease(current as CFTypeRef);
                return None;
            }
            let retained = CFRetain(child) as AXUIElementRef;
            CFRelease(children);
            CFRelease(current as CFTypeRef);
            current = retained;
        }
        Some(current)
    }
}

fn hit_json(hit: &Hit) -> Value {
    json!({
        "id": hit.id,
        "role": hit.role,
        "title": hit.title,
        "description": hit.description,
        "placeholder": hit.placeholder,
    })
}

fn cf_string(s: &str) -> CFStringRef {
    let c = CString::new(s).unwrap_or_else(|_| CString::new("").expect("empty cstring"));
    unsafe { CFStringCreateWithCString(std::ptr::null(), c.as_ptr(), K_CF_STRING_ENCODING_UTF8) }
}

fn cf_string_to_rust(s: CFStringRef) -> String {
    if s.is_null() {
        return String::new();
    }
    unsafe {
        let len = CFStringGetLength(s);
        if len <= 0 {
            return String::new();
        }
        let mut buf = vec![0i8; (len as usize) * 4 + 8];
        if CFStringGetCString(s, buf.as_mut_ptr(), buf.len() as isize, K_CF_STRING_ENCODING_UTF8) {
            CStr::from_ptr(buf.as_ptr()).to_string_lossy().chars().take(120).collect()
        } else {
            String::new()
        }
    }
}

fn copy_attr(el: AXUIElementRef, name: &str) -> Option<CFTypeRef> {
    unsafe {
        let attr = cf_string(name);
        if attr.is_null() {
            return None;
        }
        let mut val: CFTypeRef = std::ptr::null();
        let err = AXUIElementCopyAttributeValue(el, attr, &mut val);
        CFRelease(attr);
        if err != AX_OK || val.is_null() {
            None
        } else {
            Some(val)
        }
    }
}

fn string_attr(el: AXUIElementRef, name: &str) -> String {
    let Some(val) = copy_attr(el, name) else {
        return String::new();
    };
    unsafe {
        let out = if CFGetTypeID(val) == CFStringGetTypeID() {
            cf_string_to_rust(val)
        } else {
            String::new()
        };
        CFRelease(val);
        out
    }
}
