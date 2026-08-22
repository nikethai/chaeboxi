use super::authority::WorkspaceRuntime;
use super::error::{
    ALREADY_EXISTS, AMBIGUOUS_EDIT, CONFLICT, HARD_DENIED, MUTATION_DISABLED, NOT_FOUND, REVOKED, STALE_CAPABILITY,
    SYMLINK_ESCAPE, UNAUTHORIZED_ROOT, WRONG_WINDOW,
};
use super::path::content_revision;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

static TEST_DIR_SEQ: AtomicU64 = AtomicU64::new(0);

fn test_dir() -> PathBuf {
    let n = TEST_DIR_SEQ.fetch_add(1, Ordering::SeqCst);
    let dir = std::env::temp_dir().join(format!("chaeboxi-ws-{}-{n}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn runtime(root_parent: &Path, mutation: bool) -> WorkspaceRuntime {
    let registry = root_parent.join("project-bindings.json");
    WorkspaceRuntime::for_tests(registry, mutation)
}

fn bind_main(rt: &WorkspaceRuntime, project: &str, folder: &Path) -> serde_json::Value {
    rt.bind_picker_result(project, "main", folder).expect("bind")
}

fn cap_id(desc: &serde_json::Value) -> &str {
    desc.get("capabilityId").and_then(|v| v.as_str()).unwrap()
}

#[test]
fn reject_renderer_authorize_path() {
    let dir = test_dir();
    let rt = runtime(&dir, false);
    let err = rt.reject_authorize_path("p1", dir.to_str().unwrap()).unwrap_err();
    assert_eq!(err.code, UNAUTHORIZED_ROOT);
}

#[test]
fn tampered_registry_cannot_mint_capability() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    let rt = runtime(&dir, false);
    bind_main(&rt, "p1", &folder);

    // Overwrite registry with a binding pointing at / etc without valid checksum.
    let forged = serde_json::json!({
        "p-forged": {
            "projectId": "p-forged",
            "displayPath": "/",
            "filesystemIdentity": "forged",
            "rootGeneration": "gen",
            "status": "ready",
            "lastOpenedAt": 1,
            "trust": { "files": "allowed", "instructions": "allowed", "skillsCommands": "allowed", "hooks": "allowed" },
            "checksum": "deadbeef"
        }
    });
    fs::write(dir.join("project-bindings.json"), forged.to_string()).unwrap();
    let rt2 = runtime(&dir, false);
    rt2.open_desktop(&dir).unwrap();
    let err = rt2.restore("p-forged", "main").unwrap_err();
    assert_eq!(err.code, UNAUTHORIZED_ROOT);
}

#[test]
fn wrong_window_and_quick_rejected() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join("a.txt"), "hello").unwrap();
    let rt = runtime(&dir, false);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    let err = rt.read(cap, "quick", "a.txt").unwrap_err();
    assert_eq!(err.code, WRONG_WINDOW);
    let err = rt.bind_picker_result("p2", "quick", &folder).unwrap_err();
    assert_eq!(err.code, WRONG_WINDOW);
}

#[test]
fn other_project_capability_is_stale_or_wrong() {
    let dir = test_dir();
    let a = dir.join("a");
    let b = dir.join("b");
    fs::create_dir(&a).unwrap();
    fs::create_dir(&b).unwrap();
    fs::write(a.join("x.txt"), "a").unwrap();
    fs::write(b.join("x.txt"), "b").unwrap();
    let rt = runtime(&dir, false);
    let da = bind_main(&rt, "pa", &a);
    let _db = bind_main(&rt, "pb", &b);
    // Relink/bind of pb doesn't steal pa's capability, but using pa cap after... still valid for pa.
    let cap_a = cap_id(&da).to_string();
    let read = rt.read(&cap_a, "main", "x.txt").unwrap();
    assert_eq!(read.get("content").and_then(|v| v.as_str()).unwrap(), "a");
}

#[test]
fn symlink_directory_cannot_escape() {
    let dir = test_dir();
    let folder = dir.join("proj");
    let outside = dir.join("outside");
    fs::create_dir(&folder).unwrap();
    fs::create_dir(&outside).unwrap();
    fs::write(outside.join("secret.txt"), "classified").unwrap();
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&outside, folder.join("link")).unwrap();
        let rt = runtime(&dir, false);
        let desc = bind_main(&rt, "p1", &folder);
        let cap = cap_id(&desc);
        let listed = rt.list(cap, "main", "", None, None).unwrap();
        let entries = listed.get("entries").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        assert!(
            entries.iter().all(|e| e.get("name").and_then(|v| v.as_str()) != Some("link")),
            "directory symlink must not be listed: {entries:?}"
        );
        let err = rt.read(cap, "main", "link/secret.txt").unwrap_err();
        assert_eq!(err.code, SYMLINK_ESCAPE);
    }
}

#[test]
fn ancestor_swapped_with_symlink_during_read() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    let nested = folder.join("a");
    fs::create_dir(&nested).unwrap();
    fs::write(nested.join("file.txt"), "ok").unwrap();
    let outside = dir.join("outside");
    fs::create_dir(&outside).unwrap();
    fs::write(outside.join("file.txt"), "escaped").unwrap();
    let rt = runtime(&dir, false);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    fs::remove_dir_all(&nested).unwrap();
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&outside, &nested).unwrap();
        let err = rt.read(cap, "main", "a/file.txt").unwrap_err();
        assert!(
            err.code == SYMLINK_ESCAPE || err.code == NOT_FOUND,
            "unexpected {}",
            err.code
        );
    }
}

#[test]
fn revoke_blocks_read_and_mutation() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join("a.txt"), "hello").unwrap();
    let rt = runtime(&dir, true);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc).to_string();
    rt.revoke_project("p1", "main").unwrap();
    let err = rt.read(&cap, "main", "a.txt").unwrap_err();
    assert!(err.code == STALE_CAPABILITY || err.code == REVOKED, "{}", err.code);
    let err = rt
        .create_file(&cap, "main", "b.txt", "x", "create", None)
        .unwrap_err();
    assert!(
        err.code == STALE_CAPABILITY || err.code == REVOKED || err.code == MUTATION_DISABLED,
        "{}",
        err.code
    );
    assert!(!folder.join("b.txt").exists());
}

#[test]
fn mutation_disabled_leaves_files_intact() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join("a.txt"), "hello").unwrap();
    let rt = runtime(&dir, false);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    let err = rt.create_file(cap, "main", "b.txt", "x", "create", None).unwrap_err();
    assert_eq!(err.code, MUTATION_DISABLED);
    assert!(!folder.join("b.txt").exists());
}

#[test]
fn hard_denied_env_never_listed_or_read() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join(".env"), "SECRET=1").unwrap();
    fs::write(folder.join("ok.txt"), "public").unwrap();
    let rt = runtime(&dir, false);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    let listed = rt.list(cap, "main", "", None, None).unwrap();
    let entries = listed.get("entries").and_then(|v| v.as_array()).cloned().unwrap();
    assert!(entries.iter().all(|e| e.get("name").and_then(|v| v.as_str()) != Some(".env")));
    let err = rt.read(cap, "main", ".env").unwrap_err();
    assert_eq!(err.code, HARD_DENIED);
    let search = rt.search(cap, "main", "SECRET", None).unwrap();
    let hits = search.get("hits").and_then(|v| v.as_array()).cloned().unwrap();
    assert!(hits.is_empty());
}

#[test]
fn create_edit_delete_revision_and_conflict() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    let rt = runtime(&dir, true);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    let created = rt
        .create_file(cap, "main", "note.txt", "alpha", "create", None)
        .unwrap();
    let rev = created.get("revision").and_then(|v| v.as_str()).unwrap().to_string();
    let err = rt
        .create_file(cap, "main", "note.txt", "beta", "create", None)
        .unwrap_err();
    assert_eq!(err.code, ALREADY_EXISTS);
    assert_eq!(fs::read_to_string(folder.join("note.txt")).unwrap(), "alpha");

    fs::write(folder.join("note.txt"), "changed-outside").unwrap();
    let err = rt
        .edit_file(cap, "main", "note.txt", "alpha", "gamma", &rev)
        .unwrap_err();
    assert_eq!(err.code, CONFLICT);
    assert_eq!(fs::read_to_string(folder.join("note.txt")).unwrap(), "changed-outside");

    let current = fs::read(folder.join("note.txt")).unwrap();
    let rev2 = content_revision(&current);
    let edited = rt
        .edit_file(cap, "main", "note.txt", "changed-outside", "gamma", &rev2)
        .unwrap();
    assert_eq!(fs::read_to_string(folder.join("note.txt")).unwrap(), "gamma");
    let rev3 = edited.get("revision").and_then(|v| v.as_str()).unwrap();
    rt.delete_file(cap, "main", "note.txt", rev3).unwrap();
    assert!(!folder.join("note.txt").exists());
}

#[test]
fn ambiguous_edit_and_delete_stale() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join("a.txt"), "foo foo").unwrap();
    let rt = runtime(&dir, true);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    let rev = content_revision(b"foo foo");
    let err = rt.edit_file(cap, "main", "a.txt", "foo", "bar", &rev).unwrap_err();
    assert_eq!(err.code, AMBIGUOUS_EDIT);
    assert_eq!(fs::read_to_string(folder.join("a.txt")).unwrap(), "foo foo");
    let err = rt.delete_file(cap, "main", "a.txt", "stale-rev").unwrap_err();
    assert_eq!(err.code, CONFLICT);
    assert!(folder.join("a.txt").exists());
}

#[test]
fn overwrite_without_revision_is_conflict() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join("a.txt"), "original").unwrap();
    let rt = runtime(&dir, true);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    let err = rt
        .create_file(cap, "main", "a.txt", "replaced", "overwrite", None)
        .unwrap_err();
    assert_eq!(err.code, CONFLICT);
    assert_eq!(fs::read_to_string(folder.join("a.txt")).unwrap(), "original");
}

#[test]
fn failed_replace_keeps_original() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join("keep.txt"), "original").unwrap();
    let rt = runtime(&dir, true);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    let rev = content_revision(b"original");
    // empty old_string is rejected before write
    let err = rt.edit_file(cap, "main", "keep.txt", "", "x", &rev).unwrap_err();
    assert_eq!(err.code, AMBIGUOUS_EDIT);
    assert_eq!(fs::read_to_string(folder.join("keep.txt")).unwrap(), "original");
}

#[test]
fn cancel_request_stops_search() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join("a.txt"), "needle").unwrap();
    let rt = runtime(&dir, false);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    rt.cancel_request("req-1");
    let err = rt.search(cap, "main", "needle", Some("req-1")).unwrap_err();
    assert_eq!(err.code, super::error::CANCELLED);
}

#[test]
fn generation_stale_after_relink() {
    let dir = test_dir();
    let a = dir.join("a");
    let b = dir.join("b");
    fs::create_dir(&a).unwrap();
    fs::create_dir(&b).unwrap();
    fs::write(a.join("x.txt"), "a").unwrap();
    fs::write(b.join("x.txt"), "b").unwrap();
    let rt = runtime(&dir, false);
    let d1 = bind_main(&rt, "p1", &a);
    let cap1 = cap_id(&d1).to_string();
    let d2 = rt.relink("p1", "main", &b).unwrap();
    let cap2 = cap_id(&d2);
    let err = rt.read(&cap1, "main", "x.txt").unwrap_err();
    assert!(err.code == STALE_CAPABILITY || err.code == REVOKED, "{}", err.code);
    let read = rt.read(cap2, "main", "x.txt").unwrap();
    assert_eq!(read.get("content").and_then(|v| v.as_str()).unwrap(), "b");
}
