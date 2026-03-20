import "clsx";
import { s as settings } from "./defaults.js";
class SettingsStore {
  settings = settings();
  initialized = false;
  rendererModule = null;
  initializing = null;
  unsubscribeRenderer = null;
  listeners = /* @__PURE__ */ new Set();
  constructor() {
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }
  syncFromRenderer() {
    if (!this.rendererModule) {
      return;
    }
    this.settings = this.rendererModule.settingsStore.getState().getSettings();
    this.initialized = true;
    this.notify();
  }
  async init() {
    {
      return this.settings;
    }
  }
  update(nextStateOrUpdater) {
    if (this.rendererModule) {
      this.rendererModule.settingsStore.getState().setSettings(nextStateOrUpdater);
      return;
    }
    if (typeof nextStateOrUpdater === "function") {
      const draft = structuredClone(this.settings);
      nextStateOrUpdater(draft);
      this.settings = draft;
      this.notify();
      return;
    }
    this.settings = { ...this.settings, ...nextStateOrUpdater };
    this.notify();
  }
  get() {
    return this.settings;
  }
  // Helper getters
  get theme() {
    return this.settings.theme;
  }
  get language() {
    return this.settings.language;
  }
  get shortcuts() {
    return this.settings.shortcuts;
  }
}
const settingsStore = new SettingsStore();
export {
  settingsStore as s
};
