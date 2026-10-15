# WASI Runtime Decision

## Decision

Use embedded Wasmtime as the local capability runtime. Expose a product-level JavaScript Quick Run profile through a pinned WASI-compatible QuickJS runtime. Do not expose raw host commands or market Wasmtime as a general project environment.

## Why

- Zero external installation for non-technical users.
- Smaller than Docker/VM runtimes.
- Rust-native embedding fits the Tauri backend.
- Capability-based filesystem preopens.
- Fuel, epoch interruption, memory limits, and bounded host functions.
- Works across supported desktop operating systems when target packaging passes.

## Product Contract

Quick Local Run supports bounded JavaScript transformations against explicitly selected project context. It does not provide Node.js, npm, Python, a shell, native dependencies, databases, services, browser automation, or full application builds.

## Host Capabilities

Allowed:

- Captured stdin/stdout/stderr.
- Read-only app-private snapshot of selected eligible files.
- Writable app-private scratch directory.
- Deterministic clock/random only if required by the chosen profile and disclosed.

Denied:

- Original Project root.
- Network and sockets.
- Host environment and home.
- Subprocesses and dynamic native libraries.
- Credentials, keychain, devices, clipboard, browser/session storage.

## Runtime Alternatives Considered

| Option | Decision | Reason |
|---|---|---|
| Raw `.wasm` only | Reject as product MVP | Non-technical users cannot produce modules |
| QuickJS WASI profile | Preferred, gated | Small JavaScript experience; must verify artifact/provenance |
| Javy-based profile | Spike fallback | Evaluate compatibility/tooling; avoid build-time complexity |
| Python WASI | Defer | Larger runtime and package compatibility limits |
| Deno permissions | Reject as security boundary | Host process surface and broader compatibility assumptions |
| Docker/Podman | Advanced future provider only | Heavy installation and support burden |
| Remote sandbox | Defer | Requires external infrastructure and conflicts with local-first default |

## Feasibility Gate

Implementation may proceed only if:

1. Wasmtime crates support Rust 1.88 and desktop targets.
2. Runtime artifact license/provenance/hash are acceptable and reproducible.
3. Compressed release growth is at most 50 MiB.
4. Cold startup is at most 500 ms on baseline hardware.
5. Infinite loops, memory growth, output floods, path escapes, unsupported imports, cancellation, and revocation terminate safely.
6. JavaScript hello-world, JSON transformation, and selected-file transformation pass.

Failure outcome: Quick Run remains disabled. No host execution fallback.

## Future Provider Contract

Shared execution types should allow future providers—remote microVM, Docker, Podman—without implementing or exposing them now. Provider selection must never silently weaken isolation.
