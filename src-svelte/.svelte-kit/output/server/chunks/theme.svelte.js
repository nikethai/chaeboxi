import "clsx";
class ThemeStore {
  theme = "system";
  resolvedTheme = "light";
  constructor() {
  }
  updateResolvedTheme() {
    if (this.theme === "system") {
      this.resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      this.resolvedTheme = this.theme;
    }
    this.applyTheme();
  }
  applyTheme() {
    return;
  }
  setTheme(newTheme) {
    this.theme = newTheme;
    this.updateResolvedTheme();
  }
  toggle() {
    this.setTheme(this.resolvedTheme === "dark" ? "light" : "dark");
  }
}
const themeStore = new ThemeStore();
export {
  themeStore as t
};
