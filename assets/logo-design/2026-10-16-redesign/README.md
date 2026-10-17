# 2026-10-16 redesign: app icon and mascot

- `app-icon-gpt-render.png` (1254 px, RGBA): the chosen app icon, rendered by GPT. Source of truth for the look. Not yet the shipped icon: `assets/icon*.png|icns|ico` are unchanged.
- Mascot: the round dark character with two oval eyes and no mouth, used inside the app (states: idle, thinking, replying, working, needs you, done, asleep, stuck). Drawn on the "Chaeboxi redesign wireframes" canvas, Redesign page.

To ship the icon:
1. Remove the baked-in outer glow; tile only, transparent background, 1024 px.
2. Trace into three layers (tile, face, wrap + sparkle) for Icon Composer so macOS 26 dark, clear and tinted icons work.
3. Generate `icon.icns`, `icon.ico`, `icon.png`; regenerate `iconTemplate*.png` from the mascot outline for the menu bar.
