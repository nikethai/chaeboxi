//! Per-root operation leases, request cancellation, and concurrency caps.

use super::budgets::{MAX_CONCURRENT_JOBS_GLOBAL, MAX_CONCURRENT_JOBS_PER_PROJECT};
use super::error::{cancelled, queue_saturated, WorkspaceError};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

#[derive(Debug)]
pub struct RequestState {
    pub cancelled: bool,
    pub project_id: String,
}

pub struct LeaseBook {
    pub global: Arc<AtomicU64>,
    pub per_project: HashMap<String, Arc<AtomicU64>>,
    pub requests: Arc<Mutex<HashMap<String, RequestState>>>,
    pub root_locks: HashMap<String, Arc<Mutex<()>>>,
}

impl Default for LeaseBook {
    fn default() -> Self {
        Self {
            global: Arc::new(AtomicU64::new(0)),
            per_project: HashMap::new(),
            requests: Arc::new(Mutex::new(HashMap::new())),
            root_locks: HashMap::new(),
        }
    }
}

impl LeaseBook {
    pub fn project_counter(&mut self, project_id: &str) -> Arc<AtomicU64> {
        self.per_project
            .entry(project_id.to_string())
            .or_insert_with(|| Arc::new(AtomicU64::new(0)))
            .clone()
    }

    pub fn root_lock(&mut self, identity: &str) -> Arc<Mutex<()>> {
        self.root_locks
            .entry(identity.to_string())
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    }

    pub fn cancel(&self, request_id: &str) {
        if let Ok(mut map) = self.requests.lock() {
            map.entry(request_id.to_string())
                .and_modify(|s| s.cancelled = true)
                .or_insert(RequestState {
                    cancelled: true,
                    project_id: String::new(),
                });
        }
    }

    pub fn is_cancelled(&self, request_id: &str) -> bool {
        self.requests
            .lock()
            .ok()
            .and_then(|m| m.get(request_id).map(|s| s.cancelled))
            .unwrap_or(false)
    }

    pub fn begin(
        &mut self,
        project_id: &str,
        request_id: Option<&str>,
    ) -> Result<OpGuard, WorkspaceError> {
        if let Some(id) = request_id {
            if self.is_cancelled(id) {
                if let Ok(mut map) = self.requests.lock() {
                    map.remove(id);
                }
                return Err(cancelled());
            }
        }
        let global_now = self.global.load(Ordering::SeqCst);
        if global_now >= MAX_CONCURRENT_JOBS_GLOBAL {
            return Err(queue_saturated());
        }
        let project = self.project_counter(project_id);
        let project_now = project.load(Ordering::SeqCst);
        if project_now >= MAX_CONCURRENT_JOBS_PER_PROJECT {
            return Err(queue_saturated());
        }
        self.global.fetch_add(1, Ordering::SeqCst);
        project.fetch_add(1, Ordering::SeqCst);
        if let Some(id) = request_id {
            if let Ok(mut map) = self.requests.lock() {
                map.insert(
                    id.to_string(),
                    RequestState {
                        cancelled: false,
                        project_id: project_id.to_string(),
                    },
                );
            }
        }
        Ok(OpGuard {
            global: self.global.clone(),
            project,
            request_id: request_id.map(str::to_string),
            requests: self.requests.clone(),
        })
    }
}

pub struct OpGuard {
    global: Arc<AtomicU64>,
    project: Arc<AtomicU64>,
    request_id: Option<String>,
    requests: Arc<Mutex<HashMap<String, RequestState>>>,
}

impl Drop for OpGuard {
    fn drop(&mut self) {
        self.global.fetch_sub(1, Ordering::SeqCst);
        self.project.fetch_sub(1, Ordering::SeqCst);
        if let Some(id) = &self.request_id {
            if let Ok(mut map) = self.requests.lock() {
                map.remove(id);
            }
        }
    }
}
