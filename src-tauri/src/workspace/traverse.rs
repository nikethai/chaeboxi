//! Handle-relative, no-follow traversal.
//! Unix: openat(O_NOFOLLOW) per path component. Other OS: lstat and reject symlinks.

use super::error::{not_found, outside_root, symlink_escape, WorkspaceError, PERMISSION_DENIED};
use super::path::RelativePath;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

fn map_io(name: &str, err: io::Error) -> WorkspaceError {
    #[cfg(unix)]
    {
        if err.raw_os_error() == Some(libc::ELOOP) {
            return symlink_escape();
        }
    }
    match err.kind() {
        io::ErrorKind::NotFound => not_found(name),
        io::ErrorKind::PermissionDenied => WorkspaceError::new(PERMISSION_DENIED, format!("{err}")),
        _ => WorkspaceError::new(PERMISSION_DENIED, format!("{err}")),
    }
}

pub fn filesystem_identity(path: &Path) -> Result<String, WorkspaceError> {
    let meta = fs::metadata(path).map_err(|err| map_io(&path.display().to_string(), err))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        Ok(format!("{}:{}", meta.dev(), meta.ino()))
    }
    #[cfg(not(unix))]
    {
        Ok(format!("{}:{}", path.display(), meta.len()))
    }
}

fn reject_symlink(path: &Path) -> Result<fs::Metadata, WorkspaceError> {
    let meta = fs::symlink_metadata(path).map_err(|err| map_io(&path.display().to_string(), err))?;
    if meta.file_type().is_symlink() {
        return Err(symlink_escape());
    }
    Ok(meta)
}

/// Resolve `rel` under `root` without following directory (or any) symlinks.
pub fn resolve_nofollow(root: &Path, rel: &RelativePath) -> Result<PathBuf, WorkspaceError> {
    let mut current = root.to_path_buf();
    reject_symlink(&current)?;
    for component in &rel.components {
        current.push(component);
        reject_symlink(&current)?;
    }
    Ok(current)
}

#[cfg(unix)]
fn unix_open_root(root: &Path) -> Result<std::os::fd::OwnedFd, WorkspaceError> {
    use std::ffi::CString;
    use std::os::fd::{FromRawFd, OwnedFd};
    let bytes = root.as_os_str().as_encoded_bytes();
    let c = CString::new(bytes).map_err(|_| outside_root())?;
    let fd = unsafe {
        libc::open(
            c.as_ptr(),
            libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
        )
    };
    if fd < 0 {
        return Err(map_io(&root.display().to_string(), io::Error::last_os_error()));
    }
    Ok(unsafe { OwnedFd::from_raw_fd(fd) })
}

#[cfg(unix)]
fn is_nofollow_symlink_error(dirfd: std::os::fd::BorrowedFd<'_>, name: &std::ffi::CString, _err: &io::Error) -> bool {
    use std::os::fd::AsRawFd;
    let mut st: libc::stat = unsafe { std::mem::zeroed() };
    let rc = unsafe { libc::fstatat(dirfd.as_raw_fd(), name.as_ptr(), &mut st, libc::AT_SYMLINK_NOFOLLOW) };
    rc == 0 && (st.st_mode & libc::S_IFMT) == libc::S_IFLNK
}

#[cfg(unix)]
fn unix_openat(
    dirfd: std::os::fd::BorrowedFd<'_>,
    name: &str,
    flags: i32,
    mode: u32,
) -> Result<std::os::fd::OwnedFd, WorkspaceError> {
    use std::ffi::CString;
    use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
    let c = CString::new(name).map_err(|_| outside_root())?;
    let fd = unsafe { libc::openat(dirfd.as_raw_fd(), c.as_ptr(), flags | libc::O_CLOEXEC | libc::O_NOFOLLOW, mode) };
    if fd < 0 {
        let err = io::Error::last_os_error();
        if is_nofollow_symlink_error(dirfd, &c, &err) {
            return Err(symlink_escape());
        }
        return Err(map_io(name, err));
    }
    Ok(unsafe { OwnedFd::from_raw_fd(fd) })
}

#[cfg(unix)]
fn unix_walk(root: &Path, rel: &RelativePath, last_flags: i32, create: bool) -> Result<std::os::fd::OwnedFd, WorkspaceError> {
    use std::os::fd::{AsFd, OwnedFd};
    let mut current: OwnedFd = unix_open_root(root)?;
    if rel.components.is_empty() {
        return Ok(current);
    }
    for (i, component) in rel.components.iter().enumerate() {
        let is_last = i + 1 == rel.components.len();
        let flags = if is_last {
            last_flags
        } else {
            libc::O_RDONLY | libc::O_DIRECTORY
        };
        let mode = if is_last && create { 0o644 } else { 0 };
        current = unix_openat(current.as_fd(), component, flags, mode)?;
    }
    Ok(current)
}

pub fn read_file_bytes(root: &Path, rel: &RelativePath) -> Result<Vec<u8>, WorkspaceError> {
    #[cfg(unix)]
    {
        use std::os::fd::FromRawFd;
        let fd = unix_walk(root, rel, libc::O_RDONLY, false)?;
        let mut file = unsafe { File::from_raw_fd(std::os::fd::IntoRawFd::into_raw_fd(fd)) };
        let mut buf = Vec::new();
        file.read_to_end(&mut buf).map_err(|err| map_io(&rel.as_display(), err))?;
        return Ok(buf);
    }
    #[cfg(not(unix))]
    {
        let path = resolve_nofollow(root, rel)?;
        let meta = reject_symlink(&path)?;
        if meta.is_dir() {
            return Err(not_found(&rel.as_display()));
        }
        fs::read(&path).map_err(|err| map_io(&rel.as_display(), err))
    }
}

pub fn list_children(root: &Path, rel: &RelativePath) -> Result<Vec<(String, bool, u64)>, WorkspaceError> {
    #[cfg(unix)]
    {
        use std::os::fd::{AsFd, AsRawFd, FromRawFd, OwnedFd};
        let dirfd: OwnedFd = if rel.components.is_empty() {
            unix_open_root(root)?
        } else {
            unix_walk(root, rel, libc::O_RDONLY | libc::O_DIRECTORY, false)?
        };
        let dup = unsafe { libc::dup(dirfd.as_raw_fd()) };
        if dup < 0 {
            return Err(map_io(&rel.as_display(), io::Error::last_os_error()));
        }
        let dirp = unsafe { libc::fdopendir(dup) };
        if dirp.is_null() {
            unsafe { libc::close(dup) };
            return Err(map_io(&rel.as_display(), io::Error::last_os_error()));
        }
        let mut names = Vec::new();
        loop {
            let ent = unsafe { libc::readdir(dirp) };
            if ent.is_null() {
                break;
            }
            let cstr = unsafe { std::ffi::CStr::from_ptr((*ent).d_name.as_ptr()) };
            let name = cstr.to_string_lossy().into_owned();
            if name == "." || name == ".." {
                continue;
            }
            names.push(name);
        }
        unsafe { libc::closedir(dirp) };

        let mut out = Vec::new();
        for name in names {
            match unix_openat(dirfd.as_fd(), &name, libc::O_RDONLY, 0) {
                Ok(child_fd) => {
                    let file = unsafe { File::from_raw_fd(std::os::fd::IntoRawFd::into_raw_fd(child_fd)) };
                    let meta = file.metadata().map_err(|err| map_io(&name, err))?;
                    if meta.file_type().is_symlink() {
                        continue;
                    }
                    let is_dir = meta.is_dir();
                    let size = meta.len();
                    out.push((name, is_dir, size));
                }
                Err(err) => {
                    if err.code == super::error::SYMLINK_ESCAPE {
                        continue;
                    }
                    // Skip unreadable entries rather than failing the whole listing.
                    continue;
                }
            }
        }
        return Ok(out);
    }
    #[cfg(not(unix))]
    {
        let path = resolve_nofollow(root, rel)?;
        let meta = reject_symlink(&path)?;
        if !meta.is_dir() {
            return Err(not_found(&rel.as_display()));
        }
        let mut out = Vec::new();
        let rd = fs::read_dir(&path).map_err(|err| map_io(&rel.as_display(), err))?;
        for entry in rd.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            let child = path.join(&name);
            let Ok(meta) = fs::symlink_metadata(&child) else {
                continue;
            };
            if meta.file_type().is_symlink() {
                continue;
            }
            out.push((name, meta.is_dir(), meta.len()));
        }
        Ok(out)
    }
}

pub fn metadata_nofollow(root: &Path, rel: &RelativePath) -> Result<(bool, u64), WorkspaceError> {
    let path = resolve_nofollow(root, rel)?;
    let meta = reject_symlink(&path)?;
    Ok((meta.is_dir(), meta.len()))
}

pub fn exists_nofollow(root: &Path, rel: &RelativePath) -> bool {
    metadata_nofollow(root, rel).is_ok()
}

pub fn write_atomic(root: &Path, rel: &RelativePath, content: &[u8]) -> Result<(), WorkspaceError> {
    let parent = rel.parent();
    let Some(name) = rel.file_name() else {
        return Err(outside_root());
    };
    if name.starts_with('.') && name.contains(".tmp.") {
        return Err(outside_root());
    }
    let tmp_name = format!(".{}.tmp.{}", name, uuid::Uuid::new_v4().simple());

    #[cfg(unix)]
    {
        use std::os::fd::{AsFd, FromRawFd, IntoRawFd};
        let dirfd = if parent.components.is_empty() {
            unix_open_root(root)?
        } else {
            unix_walk(root, &parent, libc::O_RDONLY | libc::O_DIRECTORY, false)?
        };
        let tmp_fd = unix_openat(
            dirfd.as_fd(),
            &tmp_name,
            libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL,
            0o644,
        );
        let tmp_fd = match tmp_fd {
            Ok(fd) => fd,
            Err(err) => return Err(err),
        };
        let mut file = unsafe { File::from_raw_fd(tmp_fd.into_raw_fd()) };
        let write_res = file.write_all(content).and_then(|_| file.sync_all());
        if let Err(err) = write_res {
            let _ = unix_unlink(&dirfd, &tmp_name);
            return Err(map_io(&tmp_name, err));
        }
        drop(file);
        if let Err(err) = unix_rename(&dirfd, &tmp_name, name) {
            let _ = unix_unlink(&dirfd, &tmp_name);
            return Err(err);
        }
        return Ok(());
    }
    #[cfg(not(unix))]
    {
        let parent_path = resolve_nofollow(root, &parent)?;
        reject_symlink(&parent_path)?;
        let tmp_path = parent_path.join(&tmp_name);
        let target = parent_path.join(name);
        if let Err(err) = fs::write(&tmp_path, content) {
            let _ = fs::remove_file(&tmp_path);
            return Err(map_io(&tmp_name, err));
        }
        if let Err(err) = fs::rename(&tmp_path, &target) {
            let _ = fs::remove_file(&tmp_path);
            return Err(map_io(name, err));
        }
        Ok(())
    }
}

#[cfg(unix)]
fn unix_unlink(dirfd: &std::os::fd::OwnedFd, name: &str) -> Result<(), WorkspaceError> {
    use std::ffi::CString;
    use std::os::fd::AsRawFd;
    let c = CString::new(name).map_err(|_| outside_root())?;
    let rc = unsafe { libc::unlinkat(dirfd.as_raw_fd(), c.as_ptr(), 0) };
    if rc != 0 {
        return Err(map_io(name, io::Error::last_os_error()));
    }
    Ok(())
}

#[cfg(unix)]
fn unix_rename(dirfd: &std::os::fd::OwnedFd, from: &str, to: &str) -> Result<(), WorkspaceError> {
    use std::ffi::CString;
    use std::os::fd::AsRawFd;
    let a = CString::new(from).map_err(|_| outside_root())?;
    let b = CString::new(to).map_err(|_| outside_root())?;
    let rc = unsafe { libc::renameat(dirfd.as_raw_fd(), a.as_ptr(), dirfd.as_raw_fd(), b.as_ptr()) };
    if rc != 0 {
        return Err(map_io(to, io::Error::last_os_error()));
    }
    Ok(())
}

pub fn delete_file(root: &Path, rel: &RelativePath) -> Result<(), WorkspaceError> {
    let Some(name) = rel.file_name() else {
        return Err(outside_root());
    };
    let parent = rel.parent();
    #[cfg(unix)]
    {
        // Confirm the target is not a symlink before unlinkat.
        let _fd = unix_walk(root, rel, libc::O_RDONLY, false)?;
        drop(_fd);
        let dirfd = if parent.components.is_empty() {
            unix_open_root(root)?
        } else {
            unix_walk(root, &parent, libc::O_RDONLY | libc::O_DIRECTORY, false)?
        };
        unix_unlink(&dirfd, name)
    }
    #[cfg(not(unix))]
    {
        let path = resolve_nofollow(root, rel)?;
        let meta = reject_symlink(&path)?;
        if meta.is_dir() {
            return Err(not_found(&rel.as_display()));
        }
        fs::remove_file(&path).map_err(|err| map_io(&rel.as_display(), err))
    }
}

pub fn create_new_exclusive(root: &Path, rel: &RelativePath, content: &[u8]) -> Result<(), WorkspaceError> {
    if exists_nofollow(root, rel) {
        return Err(super::error::already_exists(&rel.as_display()));
    }
    ensure_parent_dir(root, rel)?;
    write_atomic(root, rel, content)
}

/// Best-effort same-directory temp leftover cleanup is the caller's job on failure.
pub fn ensure_parent_dir(root: &Path, rel: &RelativePath) -> Result<(), WorkspaceError> {
    let parent = rel.parent();
    if parent.components.is_empty() {
        reject_symlink(root).map(|_| ())?;
        return Ok(());
    }
    let (is_dir, _) = metadata_nofollow(root, &parent)?;
    if !is_dir {
        return Err(not_found(&parent.as_display()));
    }
    Ok(())
}

#[allow(dead_code)]
pub fn open_write_options() -> OpenOptions {
    let mut o = OpenOptions::new();
    o.write(true).create(true).truncate(true);
    o
}
