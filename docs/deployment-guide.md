# Deployment Guide

How Chaeboxi ships desktop installers to users.

## Channels

| Channel | Status | Notes |
| --- | --- | --- |
| **GitHub Releases** | Primary | Users download from [releases](https://github.com/nikethai/chaeboxi/releases) |
| In-app About → Check update | Link only | Opens `PRODUCT.releasesUrl` — no auto-updater yet |
| Web / mobile | Separate | Not part of the desktop release pipeline |

## Version sources

Keep these in sync before tagging:

| File | Field |
| --- | --- |
| `package.json` | `version` |
| `src-tauri/tauri.conf.json` | `version` |
| `src-tauri/Cargo.toml` | `package.version` |

## CI workflows

| Workflow | File | Trigger | Purpose |
| --- | --- | --- | --- |
| **CI** | `.github/workflows/ci.yml` | PR + push to `main` | **Required:** unit tests. Biome + `tsc` run report-only (pre-existing debt on main) |
| **Release** | `.github/workflows/release.yml` | Tag `v*` or manual dispatch | Build installers → draft GitHub Release |

### Artifacts produced

| Platform | Bundle |
| --- | --- |
| macOS Apple Silicon | `.dmg` (`aarch64-apple-darwin`) |
| macOS Intel | `.dmg` (`x86_64-apple-darwin`) |
| Windows x64 | NSIS installer |
| Linux x64 | `.AppImage` + `.deb` |

`bundle.targets` in `tauri.conf.json` is limited to `dmg`, `nsis`, `appimage`, `deb` (not `"all"`).

The browser-host script (`sidecars/browser-host/index.mjs` + `package.json`) is packaged via `bundle.resources`. Playwright / Chromium is **not** embedded in installers — browser-agent features may need a separate runtime setup until that path is productized.

## Release checklist

1. Bump version in the three files above (same semver).
2. Commit on `main` (CI green).
3. Tag and push:
   ```bash
   git tag v1.6.0
   git push origin v1.6.0
   ```
4. Wait for **Release** workflow (all matrix jobs).
5. Open the **draft** release on GitHub, download each asset, smoke-test:
   - Install / open app
   - Create a chat (BYOK)
   - About → releases link points at `nikethai/chaeboxi`
6. Edit release notes if needed → **Publish release**.

Manual re-run without a new tag: Actions → **Release** → Run workflow (optional tag input).

## Signing (optional, recommended for public macOS)

Unsigned or ad-hoc Apple Silicon builds often show “app is damaged”. Workaround for testers:

```bash
xattr -cr /Applications/Chaeboxi.app
```

For real distribution, enroll in Apple Developer Program and add repo secrets:

| Secret | Purpose |
| --- | --- |
| `APPLE_CERTIFICATE` | Base64 `.p12` Developer ID Application cert |
| `APPLE_CERTIFICATE_PASSWORD` | p12 password |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: …` |
| `APPLE_ID` | Apple ID email |
| `APPLE_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Team ID |

Docs: [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/), [Windows signing](https://v2.tauri.app/distribute/sign/windows/).

Workflow already forwards these env vars when set; omit them for unsigned CI builds.

## Out of scope (intentionally)

- Auto-updater (`tauri-plugin-updater` / `latest.json`)
- App Store / TestFlight / Play Store
- Linux ARM matrix
- Publishing web build to hosting

## Local package build

```bash
pnpm install
pnpm tauri:build
# artifacts under src-tauri/target/release/bundle/
```

Requirements: Node 20–22, pnpm ≥ 10, Rust 1.88 (see `rust-toolchain.toml`), platform WebView deps.
