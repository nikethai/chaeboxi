Dango is a desktop assistant that remembers what matters, per scope, and never acts behind your back. The interface is calm and native: near-white grounds, system type, one green that means approved and one blue that means it's your turn. The mascot shows what Dango is doing; everything else stays quiet.

## Voice and copy

- Write plainly, from the user's side. Name things the way people do: Review, scope, knowledge, sources. Never "memory bank", "RAG" or "agent mode".
- Buttons say exactly what happens: Approve, Run plan, Allow once, Keep this. The toast afterwards says what happened, in the past tense: "Approved "Launch is 6 Nov" for Acme Co".
- Sentence case everywhere, including section labels and menu rows. No exclamation marks, no emoji in the interface.
- Speak as Dango in the first person only in the assistant's own replies. Interface text addresses the user as "you": "Nothing needs you".
- Errors say what went wrong and the fix, and the fix is the button: "Your Anthropic key was rejected." with **Update key**. No apologies, no "something went wrong".
- Say what Dango did not do when it matters: "Reply drafted in Gmail. Not sent."
- Waiting is never silent: "Thinking · checking the brief…", "Still working. Nothing is stuck; this model thinks before it writes."

## Colour

- `ground` behind everything, `surface` for the sidebar and inline tints, `raised` for things on top (composer, sheets, menus, Review items).
- Text: `ink` for content, `ink-2` for secondary text people still read, `muted` for captions, times and counts. All three hold 4.5:1 or better on every ground in both themes.
- `green` is the only action colour and the colour of approved and done: primary buttons, the focus ring, approved knowledge (`green-wash` with `green-text`).
- `blue` means needs you: the Review badge, Needs you items, the mascot's alert dot. Never use blue for an action or for decoration.
- `amber-wash` with `amber-text` marks a conflict. `danger` is only for destructive menu rows and their confirm button.
- Status never relies on colour alone: every coloured item also says its kind in words ("Needs you · Acme Co").
- Dividers use `hairline`; outlines of buttons and cards use `line`; fields and switch tracks that must be seen use `control-border` (3:1).
- Dark follows the system. Washes become tinted darks, accents lighten, and text on a `green` or `blue` fill switches to `on-green` / `on-blue`.

## Type

- System sans (`sans`), so Dango reads as a native Mac app; `mono` for paths, timers, hashes and token counts.
- `body` (14/20) is the interface default. Chat answers use `reading` (15/24) at about 70 characters a line.
- Headers: `title-1` for full pages, `title-2` for pane headers, `headline` for sections. Section labels use `label`, in sentence case.
- `callout` (13/18) for thinking and tool blocks, sheet notes and menus; `caption` (12/16) for metadata.
- Line up figures with tabular numbers wherever they sit in a column.

## Space, shape and depth

- Spacing steps of 4: `space-1` to `space-8`. Review items pad with `space-3`; the content pane has `space-7` sides; settings pages `space-8`.
- Radii by size: `radius-sm` menu rows, `radius-md` buttons and fields, `radius-lg` items and cards, `radius-xl` plan cards, `radius-sheet` sheets, `radius-composer` the composer, `radius-pill` chips and switches.
- Inside the window things are flat: items are `raised` with a `hairline` edge. Shadows belong only to what floats: `shadow-composer`, `shadow-popover`, `shadow-sheet`, `shadow-toast`.
- Never add a coloured left border to a card.

## Layout

- Three panes: sidebar (220 px), content, inspector (380–460 px, closed until Info is pressed).
- At 760–1199 px the sidebar becomes a 56 px icon rail and the inspector a sheet. Below 760 px there is one pane with bottom tabs: Review, Chat, Scopes, Settings.
- Decisions happen in sheets that rise from the bottom, never in modal dialogs. Undo is a 5 s toast and ⌘Z.

## Motion

- Motion only says that something is happening: the mascot blinks, the thinking dots pulse, the progress ring turns.
- Nothing else animates beyond 150 ms state changes. With Reduce Motion everything stops and states are written as text.

## Iconography

- Line icons at a 1.8 stroke on a 24 grid, drawn 15–16 px, coloured with the text they sit beside. In code use Lucide; Tabler icons in the current code move to Lucide as screens are rebuilt.
- No emoji anywhere in the interface: not for dictate, pin, thumbs or status.
- The mascot is not an icon. It appears once per screen at most, as the assistant's face.

## The mascot

- One round dark body, two tilted oval eyes set low, no mouth. One character, never a group.
- Eight states: idle, thinking, replying, working, needs you, done, asleep, stuck. Each speaks through the eyes plus at most one extra.
- Never sad or angry. In product use the themed component (`Mascot`); the files under `assets/Mascot/` carry light-theme colours for documents.

## App icon

- `assets/Brand/app-icon.png` is the source of truth. Do not redraw or simplify it.
- Ship it as the tile alone on transparent at 1024 px. For macOS 26, trace it into three layers (tile, face, wrap with sparkle) in Icon Composer so dark, clear and tinted modes work.

## Components

Button, Chip, ReviewItem, Composer, ThinkingLine, PlanCard, QuickChat, Inspector, Toast, Sheet, Sidebar, Switch, Menu, MenuBar and Mascot. Their classes live in `components/bundle.css` and read only tokens; each has a README with when and how to use it.
