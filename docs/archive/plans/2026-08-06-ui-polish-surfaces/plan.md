# UI Polish Surfaces

**Status:** implemented (pending visual QA)  
**Date:** 2026-08-06  
**Branch:** feat/chat-auto-tools-ux

## Locked decisions

| # | Decision |
|---|----------|
| Empty toolbar control | Remove full-width from toolbar; move into overflow menu |
| Session settings | Inline rename + slim advanced sheet (keep capabilities) |
| Code blocks | Theme-following |
| Project New Chat | Hover-only `+` desktop; menu always; small-screen always visible |
| Themes | Light + dark together |
| Composer glow | Soft ambient elevation, brand mix ≤~20% |

## Phases

1. Toolbar dead control + ActionMenu polish + composer elevation
2. Code fence redesign
3. Projects tree hierarchy
4. Inline rename + slim Session Settings

## Acceptance

- No empty icon buttons in thread toolbar
- Menus Title Case, grouped, danger separated
- Composer lifts on hover/focus without neon wash
- Code fences follow theme, better overflow/copy
- Project rows read as sections; `+` not always-on desktop
- Header supports rename without full modal; modal progressive disclosure
