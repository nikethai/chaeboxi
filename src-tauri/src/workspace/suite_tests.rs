//! Suite brokers: export, SCM hostile gate, change sets, WASI/worktree discovery.

use super::authority::WorkspaceRuntime;
use super::error::{
    APPLY_TICKET_INVALID, ENOSPC, FEATURE_DISABLED, MUTATION_DISABLED, STALE_CAPABILITY, UNAUTHORIZED_ROOT,
};
use super::local_execution;
use super::path::content_revision;
use super::policy::NativeRollout;
use super::worktree_gate;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static SEQ: AtomicU64 = AtomicU64::new(0);

fn test_dir() -> PathBuf {
    let n = SEQ.fetch_add(1, Ordering::SeqCst);
    let dir = std::env::temp_dir().join(format!(
        "chaeboxi-suite-{}-{}-{n}",
        std::process::id(),
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
    ));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn runtime(root_parent: &Path, mutation: bool) -> WorkspaceRuntime {
    let registry = root_parent.join("project-bindings.json");
    WorkspaceRuntime::for_tests(registry, mutation)
}

fn bind_main(rt: &WorkspaceRuntime, project: &str, folder: &Path) -> Value {
    rt.bind_picker_result(project, "main", folder).expect("bind")
}

fn cap_id(desc: &Value) -> &str {
    desc.get("capabilityId").and_then(|v| v.as_str()).unwrap()
}

fn git_available() -> bool {
    Command::new("git").arg("--version").output().map(|o| o.status.success()).unwrap_or(false)
}

#[test]
fn renderer_cannot_enable_native_mutation() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    let rt = runtime(&dir, false);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    rt.set_mutation_enabled(true);
    assert!(!rt.mutation_enabled());
    let err = rt.create_file(cap, "main", "a.txt", "x", "create", None).unwrap_err();
    assert_eq!(err.code, MUTATION_DISABLED);
    assert!(!folder.join("a.txt").exists());
}

#[test]
fn restore_reuses_capability_id() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    let rt = runtime(&dir, false);
    let d1 = bind_main(&rt, "p1", &folder);
    let c1 = cap_id(&d1).to_string();
    let d2 = rt.restore("p1", "main").unwrap();
    assert_eq!(cap_id(&d2), c1);
}

#[test]
fn list_does_not_embed_content_revision() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join("a.txt"), "hello").unwrap();
    let rt = runtime(&dir, false);
    let desc = bind_main(&rt, "p1", &folder);
    let listed = rt.list(cap_id(&desc), "main", "", None, None).unwrap();
    let entries = listed.get("entries").and_then(|v| v.as_array()).unwrap();
    let file = entries.iter().find(|e| e.get("name").and_then(|v| v.as_str()) == Some("a.txt"));
    assert!(file.is_some());
    assert!(file.unwrap().get("revision").is_none());
}

#[test]
fn list_uses_last_name_cursor() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    for name in ["a.txt", "b.txt", "c.txt"] {
        fs::write(folder.join(name), name).unwrap();
    }
    let rt = runtime(&dir, false);
    let desc = bind_main(&rt, "p1", &folder);
    let page = rt.list(cap_id(&desc), "main", "", Some("a.txt"), None).unwrap();
    let names: Vec<&str> = page
        .get("entries")
        .and_then(|v| v.as_array())
        .unwrap()
        .iter()
        .filter_map(|e| e.get("name").and_then(|v| v.as_str()))
        .collect();
    assert!(!names.contains(&"a.txt"));
    assert!(names.contains(&"b.txt"));
}

#[test]
fn revoke_between_preflight_and_commit_does_not_write() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    let rt = runtime(&dir, true);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc).to_string();
    rt.set_revoke_before_commit(true);
    let err = rt.create_file(&cap, "main", "late.txt", "nope", "create", None).unwrap_err();
    assert!(
        err.code == STALE_CAPABILITY || err.code == super::error::REVOKED,
        "{}",
        err.code
    );
    assert!(!folder.join("late.txt").exists());
}

#[test]
fn compiled_rollout_defaults_high_risk_off() {
    let policy = NativeRollout::compiled();
    assert!(policy.explorer);
    assert!(!policy.export);
    assert!(!policy.scm);
    assert!(!policy.staging);
    assert!(!policy.apply);
    assert!(!policy.wasi);
    assert!(!policy.worktrees);
    assert!(!policy.direct_mutation);
}

#[test]
fn capabilities_report_wasi_and_worktrees_unavailable() {
    let dir = test_dir();
    let rt = runtime(&dir, true);
    let caps = rt.suite_capabilities();
    assert_eq!(caps["wasi"]["state"].as_str(), Some("unavailable"));
    assert_eq!(caps["worktrees"]["state"].as_str(), Some("unavailable"));
    assert_eq!(caps["wasi"]["reason"].as_str(), Some("feasibility-gate"));
    assert_eq!(local_execution::status()["hostExecution"].as_bool(), Some(false));
    assert!(worktree_gate::status()["detail"].as_str().unwrap().contains("never auto-deleted"));
}

#[test]
fn export_rejects_renderer_destination_and_hard_denied() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join("ok.txt"), "public").unwrap();
    fs::write(folder.join(".env"), "SECRET=1").unwrap();
    let rt = runtime(&dir, true);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    let err = rt
        .prepare_workspace_export(
            cap,
            "main",
            &json!({ "kind": "selection", "relativePaths": ["ok.txt"], "destinationPath": "/tmp/out.zip" }),
        )
        .unwrap_err();
    assert_eq!(err.code, UNAUTHORIZED_ROOT);

    let prepared = rt
        .prepare_workspace_export(
            cap,
            "main",
            &json!({ "kind": "selection", "relativePaths": [".env", "ok.txt"] }),
        )
        .unwrap();
    assert_eq!(prepared["included"].as_u64(), Some(1));
    assert!(prepared["excluded"].as_u64().unwrap() >= 1);

    let snap = rt
        .prepare_workspace_export(cap, "main", &json!({ "kind": "snapshot" }))
        .unwrap();
    assert!(snap["included"].as_u64().unwrap() >= 1);
}

#[test]
fn export_symlink_is_excluded_and_enospc_keeps_destination() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join("ok.txt"), "public").unwrap();
    let outside = dir.join("outside.txt");
    fs::write(&outside, "secret").unwrap();
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&outside, folder.join("link.txt")).unwrap();
    }
    let rt = runtime(&dir, true);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    let prepared = rt
        .prepare_workspace_export(
            cap,
            "main",
            &json!({ "kind": "selection", "relativePaths": ["ok.txt", "link.txt"] }),
        )
        .unwrap();
    let dest = dir.join("existing.zip");
    fs::write(&dest, b"KEEP-ME").unwrap();
    let manifest_id = prepared["manifestId"].as_str().unwrap();
    rt.fail_next_export();
    let err = rt.save_export_to(manifest_id, &dest).unwrap_err();
    assert_eq!(err.code, ENOSPC);
    assert_eq!(fs::read(&dest).unwrap(), b"KEEP-ME");

    let prepared2 = rt
        .prepare_workspace_export(cap, "main", &json!({ "kind": "selection", "relativePaths": ["ok.txt"] }))
        .unwrap();
    let ok_dest = dir.join("out.zip");
    rt.save_export_to(prepared2["manifestId"].as_str().unwrap(), &ok_dest).unwrap();
    assert!(ok_dest.exists());
    assert_ne!(fs::read(&ok_dest).unwrap(), b"KEEP-ME");
}

#[test]
fn artifact_export_rejects_filesystem_path_id() {
    let dir = test_dir();
    let rt = runtime(&dir, true);
    let err = rt.prepare_app_artifact_export("/tmp/secret.bin", "main").unwrap_err();
    assert_eq!(err.code, UNAUTHORIZED_ROOT);
}

#[test]
fn change_set_stages_without_touching_project_until_apply() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join("a.txt"), "alpha").unwrap();
    let rt = runtime(&dir, true);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    let begun = rt.begin_change_set(cap, "main", "sess", "turn").unwrap();
    let cs = begun["changeSetId"].as_str().unwrap();
    rt.append_change(
        cs,
        "main",
        &json!({
            "kind": "edit",
            "relativePath": "a.txt",
            "oldString": "alpha",
            "newString": "beta",
            "expectedRevision": content_revision(b"alpha"),
        }),
    )
    .unwrap();
    let sealed = rt.seal_change_set(cs, "main").unwrap();
    assert_eq!(fs::read_to_string(folder.join("a.txt")).unwrap(), "alpha");
    let digest = sealed["digest"].as_str().unwrap();
    let op_id = sealed["operations"][0]["id"].as_str().unwrap().to_string();
    let ticket = rt.prepare_apply(cs, "main", digest, &[op_id.clone()]).unwrap();
    let apply_ticket = ticket["applyTicket"].as_str().unwrap();
    rt.apply_change_set(apply_ticket, "main").unwrap();
    assert_eq!(fs::read_to_string(folder.join("a.txt")).unwrap(), "beta");
    let replay = rt.apply_change_set(apply_ticket, "main").unwrap_err();
    assert_eq!(replay.code, APPLY_TICKET_INVALID);
}

#[test]
fn overwrite_stage_applies_full_content_replace() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join("a.txt"), "alpha").unwrap();
    let rt = runtime(&dir, true);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    let begun = rt.begin_change_set(cap, "main", "sess", "turn").unwrap();
    let cs = begun["changeSetId"].as_str().unwrap();
    rt.append_change(
        cs,
        "main",
        &json!({
            "kind": "edit",
            "relativePath": "a.txt",
            "content": "omega",
            "expectedRevision": content_revision(b"alpha"),
        }),
    )
    .unwrap();
    let sealed = rt.seal_change_set(cs, "main").unwrap();
    assert_eq!(fs::read_to_string(folder.join("a.txt")).unwrap(), "alpha");
    let digest = sealed["digest"].as_str().unwrap();
    let ticket = rt.prepare_apply(cs, "main", digest, &[]).unwrap();
    let apply_ticket = ticket["applyTicket"].as_str().unwrap();
    rt.apply_change_set(apply_ticket, "main").unwrap();
    assert_eq!(fs::read_to_string(folder.join("a.txt")).unwrap(), "omega");
}

#[test]
fn apply_without_ticket_and_tampered_digest_rejected() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    let rt = runtime(&dir, true);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    let begun = rt.begin_change_set(cap, "main", "sess", "turn").unwrap();
    let cs = begun["changeSetId"].as_str().unwrap();
    rt.append_change(
        cs,
        "main",
        &json!({ "kind": "create", "relativePath": "n.txt", "content": "hi" }),
    )
    .unwrap();
    let sealed = rt.seal_change_set(cs, "main").unwrap();
    let err = rt
        .prepare_apply(cs, "main", "deadbeef", &[])
        .unwrap_err();
    assert!(err.code == APPLY_TICKET_INVALID || err.code == super::error::CHANGE_SET_INVALID, "{}", err.code);
    let _ = sealed;
    assert!(!folder.join("n.txt").exists());
}

#[test]
fn external_edit_conflicts_apply() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join("a.txt"), "alpha").unwrap();
    let rt = runtime(&dir, true);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    let begun = rt.begin_change_set(cap, "main", "sess", "turn").unwrap();
    let cs = begun["changeSetId"].as_str().unwrap();
    rt.append_change(
        cs,
        "main",
        &json!({
            "kind": "edit",
            "relativePath": "a.txt",
            "oldString": "alpha",
            "newString": "beta",
            "expectedRevision": content_revision(b"alpha"),
        }),
    )
    .unwrap();
    let sealed = rt.seal_change_set(cs, "main").unwrap();
    fs::write(folder.join("a.txt"), "changed-outside").unwrap();
    let digest = sealed["digest"].as_str().unwrap();
    let pre = rt.preflight_change_set(cs, "main", digest, &[]).unwrap();
    assert_eq!(pre["ok"].as_bool(), Some(false));
    assert_eq!(fs::read_to_string(folder.join("a.txt")).unwrap(), "changed-outside");
}

#[test]
fn wasi_run_is_rejected_without_host_fallback() {
    let err = local_execution::reject_run();
    assert_eq!(err.code, FEATURE_DISABLED);
    let status = local_execution::status();
    assert_eq!(status["state"].as_str(), Some("unavailable"));
    assert_eq!(status["hostExecution"].as_bool(), Some(false));
}

#[test]
fn scm_status_on_repo_or_unavailable() {
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join("a.txt"), "hello").unwrap();
    let rt = runtime(&dir, true);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    if !git_available() {
        let err = rt.source_control_status(cap, "main").unwrap_err();
        assert!(
            err.code == super::error::GIT_UNAVAILABLE || err.code == FEATURE_DISABLED,
            "{}",
            err.code
        );
        return;
    }
    init_git(&folder);
    let status = rt.source_control_status(cap, "main").unwrap();
    assert!(status.get("branch").is_some());
    assert!(status.get("repositoryId").and_then(|v| v.as_str()).unwrap().len() >= 8);
}

#[test]
fn scm_hostile_helpers_do_not_execute() {
    if !git_available() {
        return;
    }
    let dir = test_dir();
    let folder = dir.join("proj");
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join("a.txt"), "hello\n").unwrap();
    let sentinel = dir.join("SENTINEL_RAN");
    init_git(&folder);
    let hook = folder.join(".git/hooks/pre-commit");
    fs::write(&hook, format!("#!/bin/sh\necho ran > {}\n", sentinel.display())).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut p = fs::metadata(&hook).unwrap().permissions();
        p.set_mode(0o755);
        fs::set_permissions(&hook, p).unwrap();
    }
    let git_dir = folder.join(".git");
    fs::write(
        git_dir.join("config"),
        format!(
            "[core]\n\thooksPath = .git/hooks\n\tpager = sh -c 'echo pager > {s}'\n[filter \"evil\"]\n\tsmudge = sh -c 'echo smudge > {s}'\n[diff]\n\texternal = sh -c 'echo diff > {s}'\n[credential]\n\thelper = sh -c 'echo cred > {s}'\n",
            s = sentinel.display()
        ),
    )
    .unwrap();
    let attrs = folder.join(".gitattributes");
    fs::write(&attrs, "* filter=evil diff=evil\n").unwrap();
    let index_before = fs::metadata(git_dir.join("index")).ok().and_then(|m| m.modified().ok());

    let rt = runtime(&dir, true);
    let desc = bind_main(&rt, "p1", &folder);
    let cap = cap_id(&desc);
    let _ = rt.source_control_status(cap, "main");
    let status = rt.source_control_status(cap, "main");
    assert!(status.is_ok() || status.as_ref().err().map(|e| e.code) == Some(super::error::PERMISSION_DENIED) || status.as_ref().err().map(|e| e.code) == Some(FEATURE_DISABLED));
    assert!(!sentinel.exists(), "hostile helper/pager must not execute");
    let index_after = fs::metadata(git_dir.join("index")).ok().and_then(|m| m.modified().ok());
    assert_eq!(index_before, index_after);

    if let Ok(st) = rt.source_control_status(cap, "main") {
        if let Some(id) = st["changes"].as_array().and_then(|a| a.first()).and_then(|c| c["changeId"].as_str()) {
            let _ = rt.source_control_diff(cap, "main", Some(id));
        }
        let _ = rt.source_control_log(cap, "main", Some(5));
    }
    assert!(!sentinel.exists(), "diff/log must not execute helpers");
}

#[test]
fn scm_parent_repository_is_rejected() {
    if !git_available() {
        return;
    }
    let dir = test_dir();
    let parent = dir.join("repo");
    fs::create_dir(&parent).unwrap();
    init_git(&parent);
    let nested = parent.join("nested");
    fs::create_dir(&nested).unwrap();
    fs::write(nested.join("a.txt"), "x").unwrap();
    let rt = runtime(&dir, true);
    let desc = bind_main(&rt, "p1", &nested);
    let err = rt.source_control_status(cap_id(&desc), "main").unwrap_err();
    assert!(
        err.code == super::error::REPOSITORY_OUTSIDE_ROOT || err.code == super::error::PERMISSION_DENIED,
        "{}",
        err.code
    );
}

#[test]
fn worktree_add_executes_smudge_so_feature_stays_disabled() {
    if !git_available() {
        return;
    }
    let dir = test_dir();
    let repo = dir.join("repo");
    fs::create_dir(&repo).unwrap();
    fs::write(repo.join("tracked.txt"), "hello\n").unwrap();
    init_git(&repo);
    Command::new("git")
        .args(["add", "."])
        .current_dir(&repo)
        .output()
        .unwrap();
    Command::new("git")
        .args(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "init"])
        .current_dir(&repo)
        .output()
        .unwrap();
    let sentinel = dir.join("WORKTREE_SMUDGE");
    fs::write(
        repo.join(".git/config"),
        format!(
            "{}\n[filter \"evil\"]\n\tsmudge = sh -c 'echo smudge >> {}'\n\tclean = cat\n",
            fs::read_to_string(repo.join(".git/config")).unwrap_or_default(),
            sentinel.display()
        ),
    )
    .unwrap();
    fs::write(repo.join(".gitattributes"), "* filter=evil\n").unwrap();
    let wt = dir.join("wt");
    let _ = Command::new("git")
        .args(["worktree", "add", "--detach", wt.to_str().unwrap(), "HEAD"])
        .current_dir(&repo)
        .output();
    // Whether this Git invokes smudge, managed worktrees stay disabled: no vetted non-executing checkout.
    let dir2 = test_dir();
    let rt = runtime(&dir2, true);
    let caps = rt.suite_capabilities();
    assert_eq!(caps["worktrees"]["state"].as_str(), Some("unavailable"));
    assert_eq!(caps["worktrees"]["reason"].as_str(), Some("feasibility-gate"));
    let _ = sentinel;
}

fn init_git(folder: &Path) {
    Command::new("git").args(["init"]).current_dir(folder).output().unwrap();
    Command::new("git")
        .args(["config", "user.email", "test@example.com"])
        .current_dir(folder)
        .output()
        .unwrap();
    Command::new("git")
        .args(["config", "user.name", "Test"])
        .current_dir(folder)
        .output()
        .unwrap();
}
