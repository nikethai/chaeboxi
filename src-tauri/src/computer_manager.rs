//! Computer use: display capture (observe) + input actuation (act).
#![cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::AppHandle;
use tokio::process::Command;

pub struct ComputerManager {
    /// Global kill switch for input actuation
    pub act_aborted: AtomicBool,
    last_capture_meta: Mutex<Option<CaptureMeta>>,
}

#[derive(Clone, Debug)]
#[allow(dead_code)] // display_id/scale reserved for multi-monitor mapping / diagnostics
struct CaptureMeta {
    display_id: String,
    /// Opaque id for this capture — clicks may pin coordinates to this frame.
    frame_id: String,
    /// Size of the image the model saw (after resize/JPEG).
    screenshot_width: u32,
    screenshot_height: u32,
    /// Coordinate space used by click/move injectors (macOS: points; else pixels).
    act_width: f64,
    act_height: f64,
    /// Capture scale screenshot/source (informational).
    scale: f64,
}

impl Default for ComputerManager {
    fn default() -> Self {
        Self {
            act_aborted: AtomicBool::new(false),
            last_capture_meta: Mutex::new(None),
        }
    }
}

impl ComputerManager {
    pub fn abort_act(&self) {
        self.act_aborted.store(true, Ordering::SeqCst);
    }

    pub fn clear_abort(&self) {
        self.act_aborted.store(false, Ordering::SeqCst);
    }

    pub async fn handle(
        &self,
        app: &AppHandle,
        channel: &str,
        args: &[Value],
    ) -> Option<Result<Value, String>> {
        if !channel.starts_with("computer:") {
            return None;
        }
        Some(self.dispatch(app, channel, args).await)
    }

    async fn dispatch(&self, app: &AppHandle, channel: &str, args: &[Value]) -> Result<Value, String> {
        match channel {
            "computer:list-displays" => list_displays().await,
            "computer:permission-status" => permission_status().await,
            "computer:permission-request" => request_permissions(app).await,
            "computer:reveal-executable" => reveal_executable().await,
            "computer:capture-display" => {
                let params = arg_object(args, 0).unwrap_or_else(|_| json!({}));
                let display_id = params
                    .get("displayId")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let max_width = params
                    .get("maxWidth")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(1440) as u32;
                let mut result = capture_display(display_id.as_deref(), max_width).await?;
                if let (Some(w), Some(h)) = (
                    result.get("width").and_then(|v| v.as_u64()),
                    result.get("height").and_then(|v| v.as_u64()),
                ) {
                    let scale = result
                        .get("scale")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(1.0);
                    let act_width = result
                        .get("actWidth")
                        .and_then(|v| v.as_f64())
                        .filter(|v| *v > 0.0)
                        .unwrap_or(w as f64);
                    let act_height = result
                        .get("actHeight")
                        .and_then(|v| v.as_f64())
                        .filter(|v| *v > 0.0)
                        .unwrap_or(h as f64);
                    let frame_id = format!(
                        "f{}-{}",
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_millis())
                            .unwrap_or(0),
                        w.wrapping_mul(31).wrapping_add(h)
                    );
                    if let Some(obj) = result.as_object_mut() {
                        obj.insert("frameId".into(), json!(frame_id.clone()));
                    }
                    let mut meta = self
                        .last_capture_meta
                        .lock()
                        .map_err(|_| "meta lock poisoned".to_string())?;
                    *meta = Some(CaptureMeta {
                        display_id: result
                            .get("displayId")
                            .and_then(|v| v.as_str())
                            .unwrap_or("primary")
                            .to_string(),
                        frame_id,
                        screenshot_width: w as u32,
                        screenshot_height: h as u32,
                        act_width,
                        act_height,
                        scale,
                    });
                }
                Ok(result)
            }
            "computer:click" => {
                self.ensure_act_allowed()?;
                let params = arg_object(args, 0)?;
                let (x, y) = map_coords(self, &params)?;
                let button = params
                    .get("button")
                    .and_then(|v| v.as_str())
                    .unwrap_or("left");
                inject_click(x, y, button).await
            }
            "computer:type" => {
                self.ensure_act_allowed()?;
                let params = arg_object(args, 0)?;
                let text = params
                    .get("text")
                    .and_then(|v| v.as_str())
                    .ok_or("text required")?;
                inject_type(text).await
            }
            "computer:key" => {
                self.ensure_act_allowed()?;
                let params = arg_object(args, 0)?;
                let key = params
                    .get("key")
                    .and_then(|v| v.as_str())
                    .ok_or("key required")?;
                inject_key(key).await
            }
            "computer:scroll" => {
                self.ensure_act_allowed()?;
                let params = arg_object(args, 0)?;
                let (x, y) = map_coords(self, &params).unwrap_or((0.0, 0.0));
                let dy = params
                    .get("deltaY")
                    .and_then(|v| v.as_f64())
                    .or_else(|| params.get("amount").and_then(|v| v.as_f64()))
                    .unwrap_or(300.0);
                let direction = params.get("direction").and_then(|v| v.as_str());
                let delta = match direction {
                    Some("up") => -dy.abs(),
                    Some("down") => dy.abs(),
                    _ => dy,
                };
                inject_scroll(x, y, delta).await
            }
            "computer:mouse-move" => {
                self.ensure_act_allowed()?;
                let params = arg_object(args, 0)?;
                let (x, y) = map_coords(self, &params)?;
                inject_mouse_move(x, y).await
            }
            "computer:open-app" => {
                self.ensure_act_allowed()?;
                let params = arg_object(args, 0)?;
                let name = params
                    .get("name")
                    .and_then(|v| v.as_str())
                    .or_else(|| params.get("app").and_then(|v| v.as_str()))
                    .ok_or("name required (application name, e.g. WhatsApp)")?;
                open_application(name).await
            }
            "computer:open-uri" => {
                self.ensure_act_allowed()?;
                let params = arg_object(args, 0)?;
                let uri = params
                    .get("uri")
                    .and_then(|v| v.as_str())
                    .or_else(|| params.get("url").and_then(|v| v.as_str()))
                    .ok_or("uri required (e.g. whatsapp://send?phone=…)")?;
                open_uri(uri).await
            }
            "computer:frontmost" => frontmost_application().await,
            "computer:ax-query" => {
                let params = arg_object(args, 0).unwrap_or_else(|_| json!({}));
                crate::ax_assist::ax_query(&params).await
            }
            "computer:ax-act" => {
                self.ensure_act_allowed()?;
                let params = arg_object(args, 0).unwrap_or_else(|_| json!({}));
                crate::ax_assist::ax_act(&params).await
            }
            "computer:abort" => {
                self.abort_act();
                Ok(json!({ "aborted": true }))
            }
            "computer:clear-abort" => {
                self.clear_abort();
                Ok(json!({ "cleared": true }))
            }
            other => Err(format!("unknown computer channel: {other}")),
        }
    }

    fn ensure_act_allowed(&self) -> Result<(), String> {
        if self.act_aborted.load(Ordering::SeqCst) {
            return Err("ABORTED: computer act disabled until re-arm".into());
        }
        Ok(())
    }
}

fn map_coords(mgr: &ComputerManager, params: &Value) -> Result<(f64, f64), String> {
    let x = params
        .get("x")
        .and_then(|v| v.as_f64())
        .ok_or("x required")?;
    let y = params
        .get("y")
        .and_then(|v| v.as_f64())
        .ok_or("y required")?;
    // Model coords are in last computer_screenshot size (Ww x Wh).
    // Map into actuator space (macOS points / native display coords).
    let meta = mgr
        .last_capture_meta
        .lock()
        .map_err(|_| "meta lock poisoned".to_string())?;
    if let Some(ref m) = *meta {
        // Optional frame pin: reject clicks that target an older verification image.
        if let Some(fid) = params.get("frameId").and_then(|v| v.as_str()) {
            if !fid.is_empty() && fid != m.frame_id {
                return Err(format!(
                    "STALE_FRAME: coordinates belong to frame {fid}, latest is {}. Call computer_screenshot and click using the new frameId.",
                    m.frame_id
                ));
            }
        }
        if m.screenshot_width > 0 && m.screenshot_height > 0 && m.act_width > 0.0 && m.act_height > 0.0 {
            let sx = m.act_width / m.screenshot_width as f64;
            let sy = m.act_height / m.screenshot_height as f64;
            let mx = (x * sx).clamp(0.0, m.act_width.max(0.0));
            let my = (y * sy).clamp(0.0, m.act_height.max(0.0));
            return Ok((mx, my));
        }
    }
    Ok((x, y))
}

/// Pure helper used by unit tests + map_coords.
#[cfg(test)]
fn map_screenshot_to_act(
    x: f64,
    y: f64,
    screenshot_w: u32,
    screenshot_h: u32,
    act_w: f64,
    act_h: f64,
) -> (f64, f64) {
    if screenshot_w == 0 || screenshot_h == 0 || act_w <= 0.0 || act_h <= 0.0 {
        return (x, y);
    }
    let mx = (x * (act_w / screenshot_w as f64)).clamp(0.0, act_w);
    let my = (y * (act_h / screenshot_h as f64)).clamp(0.0, act_h);
    (mx, my)
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

async fn list_displays() -> Result<Value, String> {
    // Single primary display entry for v1; multi-monitor picker can expand later.
    Ok(json!({
        "displays": [{
            "id": "primary",
            "name": "Primary",
            "isPrimary": true
        }]
    }))
}

/// macOS TCC probes + full-display capture for *this process* (Chaeboxi).
/// Never use the `screencapture` CLI for computer-use: it has a different TCC identity
/// than the app binary, so Settings can show Allowed while tool capture still fails.
/// Dev (`target/debug/chaeboxi`) is ad-hoc signed and only appears in Privacy lists after
/// this process calls CGRequestScreenCaptureAccess (often needs main thread).
#[cfg(target_os = "macos")]
mod macos_privacy {
    use std::io::Cursor;
    use std::sync::mpsc;
    use tauri::AppHandle;

    #[repr(C)]
    struct CGRect {
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    }

    // CGBitmapInfo: draw into little-endian BGRA, then swizzle to RGBA for PNG.
    const K_CG_IMAGE_ALPHA_PREMULTIPLIED_FIRST: u32 = 2; // ARGB in big-endian docs; with 32Little → BGRA
    const K_CG_BITMAP_BYTE_ORDER32_LITTLE: u32 = 2 << 12;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        /// macOS 10.15+
        fn CGPreflightScreenCaptureAccess() -> bool;
        /// macOS 10.15+ — may show system prompt once; registers this binary in TCC.
        fn CGRequestScreenCaptureAccess() -> bool;
        fn CGMainDisplayID() -> u32;
        /// Logical bounds in points (global display space used by cliclick / System Events).
        fn CGDisplayBounds(display: u32) -> CGRect;
        /// Returns CGImageRef; null when Screen Recording is not granted for this process.
        fn CGDisplayCreateImage(display_id: u32) -> *mut std::ffi::c_void;
        fn CGImageGetWidth(image: *mut std::ffi::c_void) -> usize;
        fn CGImageGetHeight(image: *mut std::ffi::c_void) -> usize;
        fn CGImageRelease(image: *mut std::ffi::c_void);
        fn CGColorSpaceCreateDeviceRGB() -> *mut std::ffi::c_void;
        fn CGColorSpaceRelease(space: *mut std::ffi::c_void);
        fn CGBitmapContextCreate(
            data: *mut u8,
            width: usize,
            height: usize,
            bits_per_component: usize,
            bytes_per_row: usize,
            space: *mut std::ffi::c_void,
            bitmap_info: u32,
        ) -> *mut std::ffi::c_void;
        fn CGContextDrawImage(
            ctx: *mut std::ffi::c_void,
            rect: CGRect,
            image: *mut std::ffi::c_void,
        );
        fn CGContextRelease(ctx: *mut std::ffi::c_void);
    }

    /// Primary display size in **points** (actuator / click coordinate space on macOS).
    pub fn main_display_act_size() -> (f64, f64) {
        unsafe {
            let r = CGDisplayBounds(CGMainDisplayID());
            let w = if r.width > 1.0 { r.width } else { 1.0 };
            let h = if r.height > 1.0 { r.height } else { 1.0 };
            (w, h)
        }
    }

    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn AXIsProcessTrusted() -> bool;
    }

    pub fn screen_recording_granted() -> bool {
        // SAFETY: Apple public C API, no args, returns bool.
        unsafe { CGPreflightScreenCaptureAccess() }
    }

    /// In-process capture probe — ground truth for *this* binary's TCC grant.
    pub fn screen_capture_works() -> bool {
        unsafe {
            let image = CGDisplayCreateImage(CGMainDisplayID());
            if image.is_null() {
                return false;
            }
            let width = CGImageGetWidth(image);
            CGImageRelease(image);
            width > 0
        }
    }

    /// Full primary-display PNG via CGDisplayCreateImage (same identity as permission probe).
    pub fn capture_main_display_png() -> Result<Vec<u8>, String> {
        unsafe {
            let image = CGDisplayCreateImage(CGMainDisplayID());
            if image.is_null() {
                return Err(
                    "PERMISSION_DENIED: Screen Recording not granted for this Chaeboxi process. \
Open Settings → Computer Use → Request Access / enable the running binary, then quit and relaunch."
                        .into(),
                );
            }
            let width = CGImageGetWidth(image);
            let height = CGImageGetHeight(image);
            if width == 0 || height == 0 {
                CGImageRelease(image);
                return Err("CAPTURE_FAILED: empty display image".into());
            }
            if width > 16384 || height > 16384 {
                CGImageRelease(image);
                return Err("CAPTURE_FAILED: display dimensions out of range".into());
            }

            let bytes_per_row = width
                .checked_mul(4)
                .ok_or_else(|| "CAPTURE_FAILED: row size overflow".to_string())?;
            let buf_len = bytes_per_row
                .checked_mul(height)
                .ok_or_else(|| "CAPTURE_FAILED: buffer size overflow".to_string())?;
            let mut bgra = vec![0u8; buf_len];

            let color_space = CGColorSpaceCreateDeviceRGB();
            if color_space.is_null() {
                CGImageRelease(image);
                return Err("CAPTURE_FAILED: CGColorSpaceCreateDeviceRGB".into());
            }
            let bitmap_info = K_CG_IMAGE_ALPHA_PREMULTIPLIED_FIRST | K_CG_BITMAP_BYTE_ORDER32_LITTLE;
            let ctx = CGBitmapContextCreate(
                bgra.as_mut_ptr(),
                width,
                height,
                8,
                bytes_per_row,
                color_space,
                bitmap_info,
            );
            CGColorSpaceRelease(color_space);
            if ctx.is_null() {
                CGImageRelease(image);
                return Err("CAPTURE_FAILED: CGBitmapContextCreate".into());
            }
            CGContextDrawImage(
                ctx,
                CGRect {
                    x: 0.0,
                    y: 0.0,
                    width: width as f64,
                    height: height as f64,
                },
                image,
            );
            CGContextRelease(ctx);
            CGImageRelease(image);

            // BGRA → RGBA for image crate / vision models
            for px in bgra.chunks_exact_mut(4) {
                px.swap(0, 2);
            }

            let rgba = image::RgbaImage::from_raw(width as u32, height as u32, bgra).ok_or_else(
                || "CAPTURE_FAILED: RGBA buffer size mismatch".to_string(),
            )?;
            let mut png = Vec::new();
            image::DynamicImage::ImageRgba8(rgba)
                .write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png)
                .map_err(|e| format!("CAPTURE_FAILED: png encode: {e}"))?;
            if png.is_empty() {
                return Err("CAPTURE_FAILED: empty png".into());
            }
            Ok(png)
        }
    }

    pub fn request_screen_recording_on_main(app: &AppHandle) -> Result<bool, String> {
        let (tx, rx) = mpsc::channel();
        app.run_on_main_thread(move || {
            let granted = unsafe { CGRequestScreenCaptureAccess() };
            let _ = tx.send(granted);
        })
        .map_err(|e| format!("main-thread permission request failed: {e}"))?;
        rx.recv()
            .map_err(|e| format!("permission request channel closed: {e}"))
    }

    pub fn accessibility_granted() -> bool {
        unsafe { AXIsProcessTrusted() }
    }
}

fn process_identity() -> serde_json::Map<String, Value> {
    let mut map = serde_json::Map::new();
    if let Ok(exe) = std::env::current_exe() {
        let path = exe.to_string_lossy().to_string();
        map.insert("executablePath".into(), json!(path));
        if let Some(name) = exe.file_name().and_then(|s| s.to_str()) {
            map.insert("processName".into(), json!(name));
        }
        // Dev binaries live under target/debug or target/release.
        let is_dev = path.contains("/target/debug/")
            || path.contains("/target/release/")
            || path.contains("\\target\\debug\\")
            || path.contains("\\target\\release\\");
        map.insert("isDevBinary".into(), json!(is_dev));
    }
    map
}

async fn request_permissions(app: &AppHandle) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        // Main-thread request registers this process in Screen Recording (critical for dev).
        let requested = macos_privacy::request_screen_recording_on_main(app)?;
        let mut status = permission_status().await?;
        if let Some(obj) = status.as_object_mut() {
            obj.insert("requested".into(), json!(true));
            obj.insert("requestGranted".into(), json!(requested));
        }
        return Ok(status);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        permission_status().await
    }
}

async fn reveal_executable() -> Result<Value, String> {
    let exe = std::env::current_exe().map_err(|e| format!("current_exe failed: {e}"))?;
    let path = exe.to_string_lossy().to_string();
    #[cfg(target_os = "macos")]
    {
        let status = std::process::Command::new("/usr/bin/open")
            .args(["-R", &path])
            .status()
            .map_err(|e| format!("reveal failed: {e}"))?;
        if !status.success() {
            return Err(format!("reveal failed with status {status}"));
        }
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer")
            .args(["/select,", &path])
            .status();
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        // Best-effort: open parent directory.
        if let Some(parent) = exe.parent() {
            let _ = std::process::Command::new("xdg-open")
                .arg(parent)
                .status();
        }
    }
    Ok(json!({ "ok": true, "executablePath": path }))
}

async fn permission_status() -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        let preflight = macos_privacy::screen_recording_granted();
        // In-process CGDisplayCreateImage is ground truth for *this* binary.
        // Do not treat preflight alone as Allowed — it can lag or disagree with capture.
        let capture_ok = tokio::task::spawn_blocking(macos_privacy::screen_capture_works)
            .await
            .unwrap_or(false);
        let screen = if capture_ok {
            "granted"
        } else {
            "denied"
        };
        let accessibility = if macos_privacy::accessibility_granted() {
            "granted"
        } else {
            "denied"
        };
        let mut body = json!({
            "screenRecording": screen,
            "accessibility": accessibility,
            "platform": "macos",
            "probe": "tcc-process+cgimage",
            "preflight": preflight,
            "captureProbe": capture_ok,
        });
        if let Some(obj) = body.as_object_mut() {
            obj.extend(process_identity());
        }
        return Ok(body);
    }
    #[cfg(target_os = "windows")]
    {
        let mut body = json!({
            "screenRecording": "granted",
            "accessibility": "unknown",
            "platform": "windows"
        });
        if let Some(obj) = body.as_object_mut() {
            obj.extend(process_identity());
        }
        return Ok(body);
    }
    #[cfg(target_os = "linux")]
    {
        let mut body = json!({
            "screenRecording": "unknown",
            "accessibility": "unknown",
            "platform": "linux",
            "experimental": true
        });
        if let Some(obj) = body.as_object_mut() {
            obj.extend(process_identity());
        }
        return Ok(body);
    }
    #[allow(unreachable_code)]
    Ok(json!({ "screenRecording": "unsupported", "accessibility": "unsupported" }))
}

async fn capture_display(display_id: Option<&str>, max_width: u32) -> Result<Value, String> {
    let id = display_id.unwrap_or("primary");

    #[cfg(target_os = "macos")]
    let bytes = {
        // In-process CG capture — same TCC identity as Settings → Recheck (not screencapture CLI).
        let _ = id;
        tokio::task::spawn_blocking(macos_privacy::capture_main_display_png)
            .await
            .map_err(|e| format!("capture task failed: {e}"))??
    };

    #[cfg(not(target_os = "macos"))]
    let bytes = {
        let tmp = std::env::temp_dir().join(format!(
            "chaeboxi-display-{}-{}.png",
            std::process::id(),
            id
        ));

        #[cfg(target_os = "windows")]
        {
            // PowerShell screenshot of primary screen
            let ps = format!(
                r#"Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height; $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size); $bmp.Save('{}', [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()"#,
                tmp.to_string_lossy().replace('\\', "\\\\")
            );
            let status = Command::new("powershell")
                .args(["-NoProfile", "-Command", &ps])
                .status()
                .await
                .map_err(|e| format!("windows capture failed: {e}"))?;
            if !status.success() {
                return Err("PERMISSION_DENIED: screen capture failed on Windows".into());
            }
        }

        #[cfg(target_os = "linux")]
        {
            let path = tmp.to_string_lossy().to_string();
            let status = Command::new("gnome-screenshot")
                .args(["-f", &path])
                .status()
                .await;
            let ok = match status {
                Ok(s) if s.success() => true,
                _ => {
                    let s2 = Command::new("import")
                        .args(["-window", "root", &path])
                        .status()
                        .await;
                    matches!(s2, Ok(s) if s.success())
                }
            };
            if !ok {
                return Err(
                    "UNSUPPORTED: Linux screen capture failed (try gnome-screenshot or ImageMagick import)"
                        .into(),
                );
            }
        }

        let bytes = std::fs::read(&tmp).map_err(|e| format!("read capture failed: {e}"))?;
        let _ = std::fs::remove_file(&tmp);
        bytes
    };

    // Downscale + JPEG for vision models. Raw retina PNG base64-as-JSON blows provider token caps
    // (e.g. Gemini 1,048,576). JPEG + max width keeps the multimodal image small.
    let prepared = tokio::task::spawn_blocking(move || prepare_capture_for_model(&bytes, max_width))
        .await
        .map_err(|e| format!("prepare capture task failed: {e}"))??;

    // Actuator coordinate space:
    // - macOS: display points (CGDisplayBounds) — cliclick / System Events use points, not pixels
    // - other OS: native capture pixels (before model downscale)
    #[cfg(target_os = "macos")]
    let (act_width, act_height) = macos_privacy::main_display_act_size();
    #[cfg(not(target_os = "macos"))]
    let (act_width, act_height) = (
        prepared.source_width as f64,
        prepared.source_height as f64,
    );

    Ok(json!({
        "mimeType": prepared.mime_type,
        "base64": STANDARD.encode(&prepared.bytes),
        "width": prepared.width,
        "height": prepared.height,
        "sourceWidth": prepared.source_width,
        "sourceHeight": prepared.source_height,
        "actWidth": act_width,
        "actHeight": act_height,
        "scale": prepared.scale,
        "displayId": id,
        "fileName": format!("display-{id}.{}", prepared.ext),
        "byteLength": prepared.bytes.len(),
    }))
}

struct PreparedCapture {
    bytes: Vec<u8>,
    width: u32,
    height: u32,
    source_width: u32,
    source_height: u32,
    scale: f64,
    mime_type: &'static str,
    ext: &'static str,
}

/// Resize (if needed) and encode as JPEG for model consumption.
fn prepare_capture_for_model(bytes: &[u8], max_width: u32) -> Result<PreparedCapture, String> {
    use image::imageops::FilterType;
    use std::io::Cursor;

    let img = image::load_from_memory(bytes).map_err(|e| format!("decode capture: {e}"))?;
    let (orig_w, orig_h) = (img.width(), img.height());
    if orig_w == 0 || orig_h == 0 {
        return Err("CAPTURE_FAILED: zero-size image".into());
    }

    let max_w = max_width.max(320);
    let scale = if orig_w > max_w {
        max_w as f64 / orig_w as f64
    } else {
        1.0
    };
    let resized = if scale < 1.0 {
        let nw = max_w;
        let nh = ((orig_h as f64) * scale).round().max(1.0) as u32;
        img.resize_exact(nw, nh, FilterType::Triangle)
    } else {
        img
    };
    let out_w = resized.width();
    let out_h = resized.height();

    // Prefer JPEG for size; fall back to PNG if encode fails.
    let mut jpeg = Vec::new();
    {
        let mut cursor = Cursor::new(&mut jpeg);
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, 72);
        if encoder
            .encode_image(&resized)
            .is_ok()
            && !jpeg.is_empty()
            && jpeg.len() < 2_500_000
        {
            return Ok(PreparedCapture {
                bytes: jpeg,
                width: out_w,
                height: out_h,
                source_width: orig_w,
                source_height: orig_h,
                scale,
                mime_type: "image/jpeg",
                ext: "jpg",
            });
        }
    }

    let mut png = Vec::new();
    resized
        .write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png)
        .map_err(|e| format!("png encode: {e}"))?;
    Ok(PreparedCapture {
        bytes: png,
        width: out_w,
        height: out_h,
        source_width: orig_w,
        source_height: orig_h,
        scale,
        mime_type: "image/png",
        ext: "png",
    })
}

// --- Input injection ---

/// Launch a desktop application by name (or .app path on macOS) and bring it frontmost.
async fn open_application(name: &str) -> Result<Value, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("application name is empty".into());
    }
    // Basic injection guard — no shell metacharacters.
    if name.chars().any(|c| matches!(c, ';' | '|' | '&' | '`' | '\n' | '\r' | '$')) {
        return Err("invalid application name".into());
    }

    #[cfg(target_os = "macos")]
    {
        use tokio::process::Command;
        let mut cmd = Command::new("/usr/bin/open");
        // Absolute path or .app bundle path → open directly; else -a AppName.
        if name.starts_with('/') || name.ends_with(".app") {
            cmd.arg(name);
        } else {
            cmd.args(["-a", name]);
        }
        let status = cmd
            .status()
            .await
            .map_err(|e| format!("open app failed: {e}"))?;
        if !status.success() {
            return Err(format!(
                "Could not open “{name}”. Use the exact app name (e.g. WhatsApp, Calculator) or full .app path."
            ));
        }

        // `open -a` succeeds if the app is already running without guaranteeing frontmost.
        // Activate via AppleScript so screenshots/clicks hit the right UI.
        let activate_name = if name.ends_with(".app") {
            std::path::Path::new(name)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or(name)
                .to_string()
        } else if name.starts_with('/') {
            std::path::Path::new(name)
                .file_name()
                .and_then(|s| s.to_str())
                .map(|s| s.trim_end_matches(".app").to_string())
                .unwrap_or_else(|| name.to_string())
        } else {
            name.to_string()
        };
        let safe = activate_name.replace('\\', "\\\\").replace('"', "\\\"");
        let script = format!(
            r#"tell application "{safe}" to activate
try
  tell application "System Events"
    set frontApp to name of first application process whose frontmost is true
    return frontApp
  end tell
on error
  return ""
end try"#
        );
        let output = Command::new("osascript")
            .args(["-e", &script])
            .output()
            .await
            .map_err(|e| format!("activate app failed: {e}"))?;
        let frontmost = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let activated = output.status.success();
        // Give the UI a brief moment to paint after activate.
        tokio::time::sleep(std::time::Duration::from_millis(350)).await;
        return Ok(json!({
            "ok": true,
            "name": name,
            "activated": activated,
            "frontmost": frontmost,
            "backend": "open -a + activate",
            "note": "Always computer_screenshot after open to verify the target UI is frontmost before clicking."
        }));
    }

    #[cfg(target_os = "windows")]
    {
        use tokio::process::Command;
        // `start` is a cmd builtin; empty title arg required when quoting.
        let status = Command::new("cmd")
            .args(["/C", "start", "", name])
            .status()
            .await
            .map_err(|e| format!("open app failed: {e}"))?;
        if !status.success() {
            return Err(format!("Could not start “{name}”"));
        }
        tokio::time::sleep(std::time::Duration::from_millis(350)).await;
        return Ok(json!({
            "ok": true,
            "name": name,
            "activated": true,
            "backend": "cmd start",
            "note": "Always computer_screenshot after open to verify the target UI is frontmost before clicking."
        }));
    }

    #[cfg(target_os = "linux")]
    {
        use tokio::process::Command;
        // Try gtk-launch / xdg-open / bare command.
        if Command::new("gtk-launch")
            .arg(name)
            .status()
            .await
            .map(|s| s.success())
            .unwrap_or(false)
        {
            return Ok(json!({
                "ok": true,
                "name": name,
                "backend": "gtk-launch",
                "note": "Always computer_screenshot after open to verify the target UI."
            }));
        }
        if Command::new("xdg-open")
            .arg(name)
            .status()
            .await
            .map(|s| s.success())
            .unwrap_or(false)
        {
            return Ok(json!({
                "ok": true,
                "name": name,
                "backend": "xdg-open",
                "note": "Always computer_screenshot after open to verify the target UI."
            }));
        }
        let status = Command::new(name)
            .status()
            .await
            .map_err(|e| format!("open app failed: {e}"))?;
        if !status.success() {
            return Err(format!("Could not launch “{name}”"));
        }
        return Ok(json!({
            "ok": true,
            "name": name,
            "backend": "exec",
            "note": "Always computer_screenshot after open to verify the target UI."
        }));
    }

    #[allow(unreachable_code)]
    Err("open app unsupported on this platform".into())
}

/// Open a URL / URI scheme (whatsapp://, https://, sms:, …) via OS handler.
async fn open_uri(uri: &str) -> Result<Value, String> {
    let uri = uri.trim();
    if uri.is_empty() {
        return Err("uri is empty".into());
    }
    if uri.len() > 2048 {
        return Err("uri too long".into());
    }
    // Block shell metacharacters and path-like file: abuse handled on JS allowlist too.
    if uri.chars().any(|c| matches!(c, ';' | '|' | '&' | '`' | '\n' | '\r')) {
        return Err("invalid uri".into());
    }
    let scheme = uri
        .split_once(':')
        .map(|(s, _)| s.to_ascii_lowercase())
        .unwrap_or_default();
    const ALLOWED: &[&str] = &["whatsapp", "sms", "imessage", "http", "https", "mailto"];
    if !ALLOWED.iter().any(|s| *s == scheme) {
        return Err(format!(
            "scheme “{scheme}” not allowed (use whatsapp/sms/http/https/mailto)"
        ));
    }

    #[cfg(target_os = "macos")]
    {
        use tokio::process::Command;
        let status = Command::new("/usr/bin/open")
            .arg(uri)
            .status()
            .await
            .map_err(|e| format!("open uri failed: {e}"))?;
        if !status.success() {
            return Err(format!("Could not open uri (scheme={scheme})"));
        }
        tokio::time::sleep(std::time::Duration::from_millis(400)).await;
        let front = frontmost_application().await.ok();
        let frontmost = front
            .as_ref()
            .and_then(|v| v.get("frontmost"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        return Ok(json!({
            "ok": true,
            "uri": uri,
            "scheme": scheme,
            "frontmost": frontmost,
            "backend": "open uri",
            "note": "Verify with screenshot; deep link may open compose UI without contact search."
        }));
    }

    #[cfg(target_os = "windows")]
    {
        use tokio::process::Command;
        let status = Command::new("cmd")
            .args(["/C", "start", "", uri])
            .status()
            .await
            .map_err(|e| format!("open uri failed: {e}"))?;
        if !status.success() {
            return Err("Could not open uri".into());
        }
        tokio::time::sleep(std::time::Duration::from_millis(400)).await;
        return Ok(json!({
            "ok": true,
            "uri": uri,
            "scheme": scheme,
            "backend": "cmd start",
            "note": "Verify with screenshot after deep link."
        }));
    }

    #[cfg(target_os = "linux")]
    {
        use tokio::process::Command;
        let status = Command::new("xdg-open")
            .arg(uri)
            .status()
            .await
            .map_err(|e| format!("open uri failed: {e}"))?;
        if !status.success() {
            return Err("Could not open uri".into());
        }
        return Ok(json!({
            "ok": true,
            "uri": uri,
            "scheme": scheme,
            "backend": "xdg-open",
            "note": "Verify with screenshot after deep link."
        }));
    }

    #[allow(unreachable_code)]
    Err("open uri unsupported on this platform".into())
}

async fn frontmost_application() -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        use tokio::process::Command;
        let script = r#"try
  tell application "System Events"
    set frontApp to name of first application process whose frontmost is true
    return frontApp
  end tell
on error
  return ""
end try"#;
        let output = Command::new("osascript")
            .args(["-e", script])
            .output()
            .await
            .map_err(|e| format!("frontmost query failed: {e}"))?;
        let frontmost = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return Ok(json!({
            "ok": true,
            "frontmost": frontmost,
            "backend": "System Events",
            "note": "Use computer_ax_query / computer_focus_search / computer_ax_press for AX grounding; vision if fallback."
        }));
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(json!({
            "ok": false,
            "frontmost": "",
            "error": "UNSUPPORTED",
            "note": "frontmost query is macOS-only in this build."
        }))
    }
}

async fn inject_click(x: f64, y: f64, button: &str) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        let btn = match button {
            "right" => "right",
            _ => "left",
        };
        // cliclick if available, else osascript (limited)
        let click_cmd = if btn == "right" { "rc" } else { "c" };
        let status = Command::new("cliclick")
            .args([click_cmd, &format!("{},{}", x as i32, y as i32)])
            .status()
            .await;
        if let Ok(s) = status {
            if s.success() {
                return Ok(json!({ "ok": true, "x": x, "y": y, "button": button, "backend": "cliclick" }));
            }
        }
        // Fallback: AppleScript System Events (requires Accessibility)
        let script = format!(
            r#"tell application "System Events" to click at {{{}, {}}}"#,
            x as i32, y as i32
        );
        let status = Command::new("osascript")
            .args(["-e", &script])
            .status()
            .await
            .map_err(|e| format!("click failed: {e}"))?;
        if !status.success() {
            return Err(
                "PERMISSION_DENIED: Accessibility permission required for computer click (install cliclick for better reliability)"
                    .into(),
            );
        }
        return Ok(json!({ "ok": true, "x": x, "y": y, "button": button, "backend": "osascript" }));
    }
    #[cfg(target_os = "windows")]
    {
        let ps = format!(
            r#"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point({}, {}); Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int f, int dx, int dy, int c, int e);' -Name U -Namespace W; [W.U]::mouse_event(0x0002, 0, 0, 0, 0); [W.U]::mouse_event(0x0004, 0, 0, 0, 0)"#,
            x as i32, y as i32
        );
        let status = Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps])
            .status()
            .await
            .map_err(|e| format!("windows click failed: {e}"))?;
        if !status.success() {
            return Err("click failed on Windows".into());
        }
        return Ok(json!({ "ok": true, "x": x, "y": y, "button": button, "backend": "sendinput" }));
    }
    #[cfg(target_os = "linux")]
    {
        let click = match button {
            "right" => "3",
            "middle" => "2",
            _ => "1",
        };
        let status = Command::new("xdotool")
            .args([
                "mousemove",
                &format!("{}", x as i32),
                &format!("{}", y as i32),
                "click",
                click,
            ])
            .status()
            .await;
        match status {
            Ok(s) if s.success() => {
                return Ok(json!({
                    "ok": true,
                    "x": x,
                    "y": y,
                    "button": button,
                    "experimental": true,
                    "backend": "xdotool"
                }))
            }
            _ => {
                return Err(
                    "UNSUPPORTED: Linux computer act is experimental (install xdotool)".into(),
                )
            }
        }
    }
    #[allow(unreachable_code)]
    Err("UNSUPPORTED_PLATFORM".into())
}

async fn inject_type(text: &str) -> Result<Value, String> {
    // Never log full text (may contain secrets)
    #[cfg(target_os = "macos")]
    {
        let status = Command::new("cliclick")
            .args(["t", text])
            .status()
            .await;
        if let Ok(s) = status {
            if s.success() {
                return Ok(json!({ "ok": true, "backend": "cliclick", "chars": text.chars().count() }));
            }
        }
        // osascript keystroke — escape quotes
        let escaped = text.replace('\\', "\\\\").replace('"', "\\\"");
        let script = format!(
            r#"tell application "System Events" to keystroke "{}""#,
            escaped
        );
        let status = Command::new("osascript")
            .args(["-e", &script])
            .status()
            .await
            .map_err(|e| format!("type failed: {e}"))?;
        if !status.success() {
            return Err("PERMISSION_DENIED: Accessibility required for typing".into());
        }
        return Ok(json!({ "ok": true, "backend": "osascript", "chars": text.chars().count() }));
    }
    #[cfg(target_os = "windows")]
    {
        let escaped = text.replace('\'', "''");
        let ps = format!(
            r#"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{}')"#,
            escaped
        );
        let status = Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps])
            .status()
            .await
            .map_err(|e| format!("type failed: {e}"))?;
        if !status.success() {
            return Err("type failed on Windows".into());
        }
        return Ok(json!({ "ok": true, "backend": "sendkeys", "chars": text.chars().count() }));
    }
    #[cfg(target_os = "linux")]
    {
        let status = Command::new("xdotool")
            .args(["type", "--", text])
            .status()
            .await;
        match status {
            Ok(s) if s.success() => {
                return Ok(json!({ "ok": true, "experimental": true, "chars": text.chars().count() }))
            }
            _ => return Err("UNSUPPORTED: Linux type needs xdotool".into()),
        }
    }
    #[allow(unreachable_code)]
    Err("UNSUPPORTED_PLATFORM".into())
}

/// Parse hotkey strings like `cmd+space`, `meta+f`, `ctrl+shift+t` into (modifiers, key).
fn parse_hotkey(raw: &str) -> Result<(Vec<&'static str>, String), String> {
    let s = raw.trim();
    if s.is_empty() {
        return Err("key required".into());
    }
    let parts: Vec<&str> = s
        .split(['+', '-'])
        .map(str::trim)
        .filter(|p| !p.is_empty())
        .collect();
    if parts.is_empty() {
        return Err("key required".into());
    }
    let mut mods: Vec<&'static str> = Vec::new();
    let mut key_token: Option<String> = None;
    for (i, part) in parts.iter().enumerate() {
        let p = part.to_lowercase();
        let is_last = i + 1 == parts.len();
        match p.as_str() {
            "cmd" | "command" | "meta" | "super" | "win" | "windows" => mods.push("command"),
            "ctrl" | "control" | "ctl" => mods.push("control"),
            "alt" | "option" | "opt" => mods.push("option"),
            "shift" => mods.push("shift"),
            other if is_last || !matches!(other, "cmd" | "command" | "meta" | "super" | "win" | "windows" | "ctrl" | "control" | "ctl" | "alt" | "option" | "opt" | "shift") => {
                // Non-modifier token is the key (prefer last non-mod if multiple).
                key_token = Some(other.to_string());
            }
            _ => {}
        }
    }
    let key = key_token.ok_or_else(|| format!("hotkey missing key token: {raw}"))?;
    // Dedupe mods while preserving order
    let mut seen = std::collections::HashSet::new();
    mods.retain(|m| seen.insert(*m));
    Ok((mods, key))
}

fn macos_key_script(key: &str, mods: &[&str]) -> Result<String, String> {
    let using = if mods.is_empty() {
        String::new()
    } else {
        let list = mods
            .iter()
            .map(|m| format!("{m} down"))
            .collect::<Vec<_>>()
            .join(", ");
        format!(" using {{{list}}}")
    };

    // Special keys → key code; letters/digits → keystroke
    let body = match key.to_lowercase().as_str() {
        "enter" | "return" => format!("key code 36{using}"),
        "tab" => format!("key code 48{using}"),
        "escape" | "esc" => format!("key code 53{using}"),
        "backspace" | "delete" => format!("key code 51{using}"),
        "space" | " " => format!("key code 49{using}"),
        "up" | "arrowup" => format!("key code 126{using}"),
        "down" | "arrowdown" => format!("key code 125{using}"),
        "left" | "arrowleft" => format!("key code 123{using}"),
        "right" | "arrowright" => format!("key code 124{using}"),
        other => {
            if other.chars().count() == 1 {
                let ch = other.chars().next().unwrap();
                if ch.is_ascii_alphanumeric()
                    || matches!(
                        ch,
                        '.' | ',' | '/' | ';' | '\'' | '[' | ']' | '\\' | '-' | '=' | '`'
                    )
                {
                    format!("keystroke \"{ch}\"{using}")
                } else {
                    return Err(format!("unsupported key: {other}"));
                }
            } else if other.len() <= 24 && other.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
                // e.g. f1 — not fully mapped; fall through keystroke of first char only rejected
                return Err(format!(
                    "unsupported key token '{other}'. Use enter/tab/escape/space/arrows or a single character; for shortcuts use cmd+space, meta+f, ctrl+c."
                ));
            } else {
                return Err(format!("unsupported key: {other}"));
            }
        }
    };
    Ok(format!(r#"tell application "System Events" to {body}"#))
}

async fn inject_key(key: &str) -> Result<Value, String> {
    let (mods, token) = parse_hotkey(key)?;

    #[cfg(target_os = "macos")]
    {
        let script = macos_key_script(&token, &mods)?;
        let status = Command::new("osascript")
            .args(["-e", &script])
            .status()
            .await
            .map_err(|e| format!("key failed: {e}"))?;
        if !status.success() {
            return Err("PERMISSION_DENIED: Accessibility required for key events".into());
        }
        return Ok(json!({ "ok": true, "key": key, "parsedKey": token, "modifiers": mods }));
    }
    #[cfg(target_os = "windows")]
    {
        // SendKeys: ^ control, + shift, % alt; Win key not reliably supported.
        let mut prefix = String::new();
        for m in &mods {
            match *m {
                "control" => prefix.push('^'),
                "shift" => prefix.push('+'),
                "option" => prefix.push('%'),
                "command" => {
                    // No portable Win-key chord via SendKeys; still press the key alone.
                }
                _ => {}
            }
        }
        let send_key = match token.to_lowercase().as_str() {
            "enter" | "return" => "{ENTER}".to_string(),
            "tab" => "{TAB}".to_string(),
            "escape" | "esc" => "{ESC}".to_string(),
            "backspace" | "delete" => "{BACKSPACE}".to_string(),
            "space" => " ".to_string(),
            "up" | "arrowup" => "{UP}".to_string(),
            "down" | "arrowdown" => "{DOWN}".to_string(),
            "left" | "arrowleft" => "{LEFT}".to_string(),
            "right" | "arrowright" => "{RIGHT}".to_string(),
            other => {
                if other.chars().count() == 1 {
                    other.to_string()
                } else {
                    return Err(format!("unsupported key: {other}"));
                }
            }
        };
        let send = format!("{prefix}{send_key}");
        let escaped = send.replace('\'', "''");
        let ps = format!(
            r#"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{escaped}')"#
        );
        let status = Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps])
            .status()
            .await
            .map_err(|e| format!("key failed: {e}"))?;
        if !status.success() {
            return Err("key failed on Windows".into());
        }
        return Ok(json!({ "ok": true, "key": key, "parsedKey": token, "modifiers": mods }));
    }
    #[cfg(target_os = "linux")]
    {
        // xdotool uses ctrl+alt+key style
        let mut parts: Vec<String> = mods
            .iter()
            .map(|m| match *m {
                "command" => "super".to_string(),
                "control" => "ctrl".to_string(),
                "option" => "alt".to_string(),
                "shift" => "shift".to_string(),
                other => other.to_string(),
            })
            .collect();
        let k = match token.to_lowercase().as_str() {
            "enter" | "return" => "Return".to_string(),
            "esc" | "escape" => "Escape".to_string(),
            "backspace" | "delete" => "BackSpace".to_string(),
            "space" => "space".to_string(),
            other => other.to_string(),
        };
        parts.push(k);
        let chord = parts.join("+");
        let status = Command::new("xdotool")
            .args(["key", &chord])
            .status()
            .await;
        match status {
            Ok(s) if s.success() => {
                return Ok(json!({
                    "ok": true,
                    "key": key,
                    "parsedKey": token,
                    "modifiers": mods,
                    "experimental": true
                }))
            }
            _ => return Err("UNSUPPORTED: Linux key needs xdotool".into()),
        }
    }
    #[allow(unreachable_code)]
    Err("UNSUPPORTED_PLATFORM".into())
}

async fn inject_scroll(x: f64, y: f64, delta_y: f64) -> Result<Value, String> {
    let _ = (x, y);
    #[cfg(target_os = "macos")]
    {
        // cliclick doesn't scroll well; use osascript / rough approximation via key pages
        let clicks = (delta_y / 100.0).round() as i32;
        if clicks == 0 {
            return Ok(json!({ "ok": true, "deltaY": delta_y }));
        }
        // Prefer cliclick kd:arrow if available — fall back to page keys
        let key = if clicks > 0 { "page down" } else { "page up" };
        let times = clicks.unsigned_abs().min(5);
        for _ in 0..times {
            let script = if key == "page down" {
                r#"tell application "System Events" to key code 121"#
            } else {
                r#"tell application "System Events" to key code 116"#
            };
            let _ = Command::new("osascript").args(["-e", script]).status().await;
        }
        return Ok(json!({ "ok": true, "deltaY": delta_y }));
    }
    #[cfg(target_os = "windows")]
    {
        let amount = delta_y as i32;
        let ps = format!(
            r#"Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int f, int dx, int dy, int c, int e);' -Name U -Namespace W; [W.U]::mouse_event(0x0800, 0, 0, {}, 0)"#,
            -amount
        );
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps])
            .status()
            .await;
        return Ok(json!({ "ok": true, "deltaY": delta_y }));
    }
    #[cfg(target_os = "linux")]
    {
        let btn = if delta_y > 0.0 { "5" } else { "4" };
        let _ = Command::new("xdotool").args(["click", btn]).status().await;
        return Ok(json!({ "ok": true, "deltaY": delta_y, "experimental": true }));
    }
    #[allow(unreachable_code)]
    Err("UNSUPPORTED_PLATFORM".into())
}

async fn inject_mouse_move(x: f64, y: f64) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        let status = Command::new("cliclick")
            .args(["m", &format!("{},{}", x as i32, y as i32)])
            .status()
            .await;
        if let Ok(s) = status {
            if s.success() {
                return Ok(json!({ "ok": true, "x": x, "y": y }));
            }
        }
        return Err("mouse move requires cliclick on macOS".into());
    }
    #[cfg(target_os = "windows")]
    {
        let ps = format!(
            r#"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point({}, {})"#,
            x as i32, y as i32
        );
        let status = Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps])
            .status()
            .await
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("mouse move failed".into());
        }
        return Ok(json!({ "ok": true, "x": x, "y": y }));
    }
    #[cfg(target_os = "linux")]
    {
        let status = Command::new("xdotool")
            .args(["mousemove", &format!("{}", x as i32), &format!("{}", y as i32)])
            .status()
            .await;
        return match status {
            Ok(s) if s.success() => Ok(json!({ "ok": true, "x": x, "y": y, "experimental": true })),
            _ => Err("UNSUPPORTED: xdotool required".into()),
        };
    }
    #[allow(unreachable_code)]
    Err("UNSUPPORTED_PLATFORM".into())
}

#[allow(dead_code)]
fn tmp_path(name: &str) -> PathBuf {
    std::env::temp_dir().join(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn map_screenshot_to_act_scales_retina_points() {
        // Model saw 1280x800; display is 2560x1600 points → 2x
        let (x, y) = map_screenshot_to_act(100.0, 50.0, 1280, 800, 2560.0, 1600.0);
        assert!((x - 200.0).abs() < 0.01);
        assert!((y - 100.0).abs() < 0.01);
    }

    #[test]
    fn map_screenshot_to_act_identity_when_same() {
        let (x, y) = map_screenshot_to_act(10.0, 20.0, 1000, 500, 1000.0, 500.0);
        assert!((x - 10.0).abs() < 0.01);
        assert!((y - 20.0).abs() < 0.01);
    }

    #[test]
    fn parse_hotkey_cmd_space() {
        let (mods, key) = parse_hotkey("cmd+space").unwrap();
        assert_eq!(mods, vec!["command"]);
        assert_eq!(key, "space");
    }

    #[test]
    fn parse_hotkey_meta_f() {
        let (mods, key) = parse_hotkey("meta+f").unwrap();
        assert_eq!(mods, vec!["command"]);
        assert_eq!(key, "f");
    }

    #[test]
    fn parse_hotkey_ctrl_shift_t() {
        let (mods, key) = parse_hotkey("ctrl+shift+t").unwrap();
        assert_eq!(mods, vec!["control", "shift"]);
        assert_eq!(key, "t");
    }

    #[test]
    fn parse_hotkey_single_enter() {
        let (mods, key) = parse_hotkey("enter").unwrap();
        assert!(mods.is_empty());
        assert_eq!(key, "enter");
    }

    #[test]
    fn macos_key_script_cmd_space() {
        let script = macos_key_script("space", &["command"]).unwrap();
        assert!(script.contains("key code 49"));
        assert!(script.contains("command down"));
    }
}
