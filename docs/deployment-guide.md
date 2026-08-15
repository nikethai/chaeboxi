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
| **Release** | `.github/workflows/release.yml` | Tag `v*` or manual dispatch | Build desktop installers → draft GitHub Release |
| **Mobile Build** | `.github/workflows/mobile.yml` | Tag `v*` or manual dispatch | Android APK/AAB (GitHub-hosted) + iOS build (self-hosted mac) |

### Artifacts produced

| Platform | Bundle |
| --- | --- |
| macOS Apple Silicon | `.dmg` (`aarch64-apple-darwin`) |
| macOS Intel | `.dmg` (`x86_64-apple-darwin`) |
| Windows x64 | NSIS installer |
| Linux x64 | `.AppImage` + `.deb` |
| Android | `.apk` (all ABIs) + `.aab` — job artifact of **Mobile Build** |
| iOS | `Chaeboxi-simulator.app` (smoke) or `Chaeboxi.ipa` (beta lane) — job artifact of **Mobile Build** |

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
4. Wait for **Release** (desktop installers) and **Mobile Build** (Android APK/AAB + iOS) workflows.
5. Open the **draft** release on GitHub, download each asset, smoke-test:
   - Install / open app
   - Create a chat (BYOK)
   - About → releases link points at `nikethai/chaeboxi`
6. Edit release notes if needed → **Publish release**.

Manual re-run without a new tag: Actions → **Release** → Run workflow (optional tag input).

### Mobile Build details

- **Android job** runs on `ubuntu-22.04` (GitHub-hosted): JDK 17, Android SDK
  platform 36 + build-tools 36 + NDK 26.3, Rust 1.88 Android targets,
  `cargo-ndk`, then `pnpm tauri android build`. APK is built for every tag;
  dispatch input selects `apk` / `aab` / `both`. Signing uses the debug
  keystore until a release keystore is configured.
- **iOS job** runs on the self-hosted runner (`runs-on: [self-hosted, macOS, X64]`,
  Intel Mac). Requirements: macOS + Xcode 16+, internet for RubyGems/npm.
  CocoaPods and fastlane are installed automatically (Ruby 3.3 via
  `ruby/setup-ruby`, `ios/Gemfile`). The job runs `pnpm run mobile:sync:ios`
  (web assets + Capacitor sync + `pod install`) and then:
  - `fastlane ios simulator_build` — unsigned simulator smoke build (default),
  - `fastlane ios beta` — signed `app-store` archive + optional TestFlight
    upload, only when dispatch input `ios_mode: beta` is selected. Needs a
    signing identity in the runner's login keychain (Xcode signed in with an
    Apple ID of team `962WN46SFR`). Optional repo secrets:
    `FASTLANE_APPLE_ID`, `FASTLANE_TEAM_ID`, `FASTLANE_TESTFLIGHT_UPLOAD=true`.
- The iOS job is concurrency-limited to one at a time (Intel 6-core / 16 GB box).
- **`ruby/setup-ruby` self-hosted requirement:** its prebuilt macOS Ruby embeds
  the fixed path `/Users/runner/hostedtoolcache`; changing `HOME` or
  `RUNNER_TOOL_CACHE` in workflow YAML cannot relocate it. The directory must
  be writable by the account running Actions. On this runner (`ringo`), run:
  `sudo mkdir -p /Users/runner/hostedtoolcache && sudo chown -R ringo:staff /Users/runner`.
  Verify with `touch /Users/runner/hostedtoolcache/.write-test && rm $_`, then
  re-run the workflow. This does **not** require a macOS user named `runner`.
- The Intel prebuilt Ruby also requires matching Homebrew runtime libraries.
  Install once with
  `HOMEBREW_NO_AUTO_UPDATE=1 brew install gmp libyaml openssl@3`; verify
  `/usr/local/opt/gmp/lib/libgmp.10.dylib` exists. The workflow runs this
  idempotently before Ruby setup and rejects a non-Intel Homebrew prefix.
- The workflow runs `bundle install` immediately after Ruby setup, before
  Capacitor sync. Capacitor detects `ios/Gemfile` and therefore invokes
  `bundle exec pod install`; installing the bundle afterward will fail with
  `Bundler::GemNotFound` and can mix Homebrew Ruby with the setup Ruby.
- `epub@1.3.0` has an obsolete optional `zipfile@0.5.12` native accelerator
  that cannot build on Node 22. It is intentionally excluded from pnpm's
  `onlyBuiltDependencies`, so `epub` uses its documented pure-JS `adm-zip`
  fallback instead.

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
- Automated store submission (App Store / TestFlight / Play Store uploads are
  manual; `beta` lane can push to TestFlight when `FASTLANE_TESTFLIGHT_UPLOAD=true`)
- Linux ARM matrix
- Publishing the **chat web app** (`pnpm build:web`) to hosting

## Marketing site (GitHub Pages)

The brochure lives in `website/` (Astro static). Workflow: `.github/workflows/pages.yml`.

Origin: `https://nikethai.github.io/chaeboxi/`. Do **not** publish `pnpm build:web` there.

Repo setting required once: Settings → Pages → Source = GitHub Actions.

Flip `PRODUCT.homepage` / privacy / terms only after all four routes return 200.

## Local package build

```bash
pnpm install
pnpm tauri:build
# artifacts under src-tauri/target/release/bundle/
```

Requirements: Node 20–22, pnpm ≥ 10, Rust 1.88 (see `rust-toolchain.toml`), platform WebView deps.
