# Quick Chat Density + Horizontal Scroll Fix

**Status:** Implemented  
**Date:** 2026-08-10  

See session plan for full design. Phases 1–4 applied in code:

- Phase 1: Virtuoso `message-list-scroller--no-x` + containment CSS
- Phase 2: Compact statusline, remove hints row, denser padding
- Phase 3: `taskDetailsMode="sheet"` for Quick Chat
- Phase 4: `docs/design-guidelines.md` Quick Chat section
- Follow-up: composer type scale + placeholder; `html[data-quick-chat]` densifies portaled pickers
- Follow-up: `/quick` forces **desktop** model combobox (narrow window was mounting 85vh mobile drawer)
