import "clsx";
import { T as Theme } from "./defaults.js";
import { p as platform } from "./index3.js";
import { s as settingsStore } from "./settings.svelte.js";
class ThemeStore {
  theme = Theme.System;
  resolvedTheme = "light";
  initialized = false;
  unsubscribeSettings = null;
  unsubscribeSystemTheme = null;
  constructor() {
  }
  async init() {
    {
      return;
    }
  }
  async updateResolvedTheme() {
    if (this.theme === Theme.Dark) {
      this.resolvedTheme = "dark";
    } else if (this.theme === Theme.Light) {
      this.resolvedTheme = "light";
    } else {
      this.resolvedTheme = await platform.shouldUseDarkColors() ? "dark" : "light";
    }
    this.applyTheme();
  }
  applyTheme() {
    return;
  }
  setTheme(newTheme) {
    this.theme = newTheme;
    settingsStore.update({ theme: newTheme });
    void this.updateResolvedTheme();
  }
  toggle() {
    this.setTheme(this.resolvedTheme === "dark" ? Theme.Light : Theme.Dark);
  }
}
const themeStore = new ThemeStore();
export {
  themeStore as t
};
