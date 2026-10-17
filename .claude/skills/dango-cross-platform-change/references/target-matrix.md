# Target matrix

| Target | Effective path | Notes |
|--------|----------------|-------|
| Desktop macOS/Windows/Linux | Tauri + `DesktopPlatform` | Full IPC: store, secrets, MCP stdio+HTTP, KB, FS, shell |
| Tauri Android | Desktop IPC transport + mobile form factor | No stdio MCP; no desktop KB / desktop-only settings / skill scan |
| Capacitor iOS | Mobile shell → often `WebPlatform` path | Reduced native surface; not full desktop |
| Capacitor Android | Capacitor mobile | Different from Tauri Android |
| Web | `WebPlatform` | IndexedDB-style storage; no privileged desktop IPC |
| Test | `TestPlatform` | In-memory fakes; not native proof |

## Capability source

Authoritative: `createPlatformCapabilities()` in `src/renderer/platform/capabilities.ts`

| Flag | Rough rule |
|------|------------|
| `supportsMcpBootstrap` | `type === 'desktop'` (includes Tauri Android HTTP MCP) |
| `supportsMcpStdio` | desktop runtime, not Android |
| `supportsKnowledgeBase` | desktop runtime, not Android |
| `supportsDesktopOnlySettings` | desktop runtime, not Android |
| `supportsAgentSkillScan` | desktop runtime, not Android |
| `supportsSystemNotifications` | desktop, mobile, web, Android |
| `isMobileLayout` | form factor only |

## Reporting template

For each change, fill:

| Target | Affected? | Evidence |
|--------|-----------|----------|
| Desktop host | Y/N | tests/build/manual |
| Tauri Android | Y/N | … |
| Capacitor iOS | Y/N | … |
| Capacitor Android | Y/N | … |
| Web | Y/N | … |
| TestPlatform | Y/N | … |

Never claim all-platform success from one host or pure Node tests.
