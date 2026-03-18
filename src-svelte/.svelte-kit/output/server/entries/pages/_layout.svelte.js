import { a as attr_class, b as attr, e as escape_html, d as derived, s as stringify, c as attr_style, f as ensure_array_like, g as store_get, u as unsubscribe_stores } from "../../chunks/root.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/state.svelte.js";
import { u as uiStore, p as page } from "../../chunks/ui.svelte.js";
import { g as getSelectedModelLabel, a as getAvailableProviders, p as providerCatalogStore } from "../../chunks/provider-catalog.svelte.js";
import { s as settings, n as newConfigs, T as Theme, a as settingsStore, c as conversationStore } from "../../chunks/conversation.svelte.js";
import "clsx";
function ModelSelector($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      providers = [],
      selected = null,
      disabled = false,
      class: className = ""
    } = $$props;
    let isOpen = false;
    const selectedLabel = derived(() => providers.length ? getSelectedModelLabel(providers, selected) : "No models configured");
    $$renderer2.push(`<div${attr_class(`model-selector ${stringify(className)}`, "svelte-zseknu")}><button class="selector-trigger svelte-zseknu" type="button"${attr("disabled", disabled || !providers.length, true)} aria-label="Select model"><span class="model-name svelte-zseknu">${escape_html(selectedLabel())}</span> <svg${attr_class("chevron svelte-zseknu", void 0, { "open": isOpen })} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg></button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function Header($$renderer, $$props) {
  let {
    providers = [],
    selectedModel = null,
    currentTheme = "light",
    showSidebarToggle = true,
    sidebarOpen = true,
    class: className = ""
  } = $$props;
  $$renderer.push(`<header${attr_class(`header title-bar ${stringify(className)}`, "svelte-hv3zzy")}><div class="header-left svelte-hv3zzy">`);
  if (showSidebarToggle) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<button class="icon-btn svelte-hv3zzy" type="button" title="Toggle Sidebar" aria-label="Toggle Sidebar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`);
    if (sidebarOpen) {
      $$renderer.push("<!--[0-->");
      $$renderer.push(`<path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path>`);
    } else {
      $$renderer.push("<!--[-1-->");
      $$renderer.push(`<path d="M7 4v16"></path><path d="M11 7l-3 5 3 5"></path><path d="M18 7h-3"></path><path d="M18 12h-5"></path><path d="M18 17h-3"></path>`);
    }
    $$renderer.push(`<!--]--></svg></button>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div> <div class="header-center svelte-hv3zzy">`);
  ModelSelector($$renderer, { providers, selected: selectedModel });
  $$renderer.push(`<!----></div> <div class="header-right svelte-hv3zzy"><button class="icon-btn svelte-hv3zzy" type="button" title="Toggle Theme" aria-label="Toggle Theme">`);
  if (currentTheme === "dark") {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`);
  } else {
    $$renderer.push("<!--[-1-->");
    $$renderer.push(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`);
  }
  $$renderer.push(`<!--]--></button></div></header>`);
}
function Sidebar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      sessions = [],
      currentSessionId = null,
      open = true,
      width = 280,
      onResizeSidebar,
      class: className = ""
    } = $$props;
    let isResizing = false;
    $$renderer2.push(`<aside${attr_class(`sidebar ${stringify(className)}`, "svelte-6dohdz", { "collapsed": !open, "resizing": isResizing })}${attr_style(`width: ${open ? `${width}px` : "0px"};`)}><div class="sidebar-header svelte-6dohdz"><div class="brand svelte-6dohdz"><div class="brand-icon svelte-6dohdz"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></div> <span class="brand-name svelte-6dohdz">Chaeboxi</span></div> <button class="icon-btn svelte-6dohdz" type="button" title="Collapse Sidebar" aria-label="Collapse Sidebar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 19l-7-7 7-7"></path><path d="M21 12H4"></path></svg></button></div> <div class="sessions-list svelte-6dohdz">`);
    if (sessions.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="empty-sessions svelte-6dohdz"><p>No conversations yet.</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--[-->`);
      const each_array = ensure_array_like(sessions);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let session = each_array[$$index];
        $$renderer2.push(`<button${attr_class("session-item svelte-6dohdz", void 0, { "active": session.id === currentSessionId })} type="button"><svg class="session-icon svelte-6dohdz" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> <div class="session-info svelte-6dohdz"><span class="session-title svelte-6dohdz">${escape_html(session.name || "Untitled")}</span></div></button>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div> <div class="sidebar-footer svelte-6dohdz"><button class="action-btn-light svelte-6dohdz" type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg> New Chat</button> <div class="nav-links svelte-6dohdz"><a href="/settings" class="nav-item svelte-6dohdz"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> <span class="svelte-6dohdz">Settings</span> <span class="nav-tag svelte-6dohdz">Partial</span></a> <a href="/about" class="nav-item svelte-6dohdz"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg> <span class="svelte-6dohdz">About</span> <span class="nav-tag svelte-6dohdz">Partial</span></a></div></div> `);
    if (onResizeSidebar) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="sidebar-resizer svelte-6dohdz" role="presentation"></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></aside>`);
  });
}
function canUseDOM() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}
function getRuntimeType() {
  if (!canUseDOM()) {
    return "web";
  }
  const runtimeWindow = window;
  return runtimeWindow.desktopAPI || runtimeWindow.__TAURI__ || runtimeWindow.__TAURI_INTERNALS__ ? "desktop" : "web";
}
function createDownload(filename, blob) {
  if (!canUseDOM()) {
    return;
  }
  const link = document.createElement("a");
  link.download = filename;
  link.style.display = "none";
  link.href = URL.createObjectURL(blob);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
const exporter = {
  async exportBlob(filename, blob) {
    createDownload(filename, blob);
  },
  async exportTextFile(filename, content) {
    createDownload(filename, new Blob([content]));
  },
  async exportImageFile() {
    throw new Error("Image export is not implemented in the Svelte rescue shell.");
  },
  async exportByUrl(filename, url) {
    if (!canUseDOM()) {
      return;
    }
    const link = document.createElement("a");
    link.download = filename;
    link.style.display = "none";
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
  async exportStreamingJson(filename, dataCallback) {
    let content = "";
    const generator = dataCallback();
    for await (const chunk of generator) {
      content += chunk;
    }
    createDownload(filename, new Blob([content]));
  }
};
const knowledgeBaseController = {
  async list() {
    throw new Error("Knowledge base is not implemented in the Svelte rescue shell.");
  },
  async create() {
    throw new Error("Knowledge base is not implemented in the Svelte rescue shell.");
  },
  async delete() {
    throw new Error("Knowledge base is not implemented in the Svelte rescue shell.");
  },
  async listFiles() {
    throw new Error("Knowledge base is not implemented in the Svelte rescue shell.");
  },
  async countFiles() {
    throw new Error("Knowledge base is not implemented in the Svelte rescue shell.");
  },
  async listFilesPaginated() {
    throw new Error("Knowledge base is not implemented in the Svelte rescue shell.");
  },
  async uploadFile() {
    throw new Error("Knowledge base is not implemented in the Svelte rescue shell.");
  },
  async deleteFile() {
    throw new Error("Knowledge base is not implemented in the Svelte rescue shell.");
  },
  async retryFile() {
    throw new Error("Knowledge base is not implemented in the Svelte rescue shell.");
  },
  async pauseFile() {
    throw new Error("Knowledge base is not implemented in the Svelte rescue shell.");
  },
  async resumeFile() {
    throw new Error("Knowledge base is not implemented in the Svelte rescue shell.");
  },
  async search() {
    throw new Error("Knowledge base is not implemented in the Svelte rescue shell.");
  },
  async update() {
    throw new Error("Knowledge base is not implemented in the Svelte rescue shell.");
  },
  async getFilesMeta() {
    throw new Error("Knowledge base is not implemented in the Svelte rescue shell.");
  },
  async readFileChunks() {
    throw new Error("Knowledge base is not implemented in the Svelte rescue shell.");
  },
  async testMineruConnection() {
    throw new Error("Knowledge base is not implemented in the Svelte rescue shell.");
  }
};
const imageGenerationStorage = {
  async initialize() {
  },
  async create() {
    throw new Error("Image generation storage is not implemented in the Svelte rescue shell.");
  },
  async update() {
    throw new Error("Image generation storage is not implemented in the Svelte rescue shell.");
  },
  async getById() {
    throw new Error("Image generation storage is not implemented in the Svelte rescue shell.");
  },
  async delete() {
    throw new Error("Image generation storage is not implemented in the Svelte rescue shell.");
  },
  async getPage() {
    throw new Error("Image generation storage is not implemented in the Svelte rescue shell.");
  },
  async getTotal() {
    throw new Error("Image generation storage is not implemented in the Svelte rescue shell.");
  }
};
function createMediaQueryListener(callback) {
  if (!canUseDOM() || !window.matchMedia) {
    return () => void 0;
  }
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = () => callback();
  mediaQuery.addEventListener("change", listener);
  return () => {
    mediaQuery.removeEventListener("change", listener);
  };
}
const platform = {
  get type() {
    return getRuntimeType();
  },
  exporter,
  getStorageType() {
    return "LOCAL_STORAGE";
  },
  async setStoreValue(key, value) {
    if (canUseDOM()) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  },
  async getStoreValue(key) {
    if (!canUseDOM()) {
      return null;
    }
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
  async delStoreValue(key) {
    if (canUseDOM()) {
      localStorage.removeItem(key);
    }
  },
  async getAllStoreValues() {
    if (!canUseDOM()) {
      return {};
    }
    return Object.fromEntries(Object.keys(localStorage).map((key) => [key, JSON.parse(localStorage.getItem(key) || "null")]));
  },
  async getAllStoreKeys() {
    return canUseDOM() ? Object.keys(localStorage) : [];
  },
  async setAllStoreValues(data) {
    for (const [key, value] of Object.entries(data)) {
      await this.setStoreValue(key, value);
    }
  },
  async getVersion() {
    return "svelte";
  },
  async getPlatform() {
    return this.type;
  },
  async getArch() {
    return "unknown";
  },
  async shouldUseDarkColors() {
    return canUseDOM() && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)").matches : false;
  },
  onSystemThemeChange(callback) {
    return createMediaQueryListener(callback);
  },
  onWindowShow() {
    return () => void 0;
  },
  onWindowFocused() {
    return () => void 0;
  },
  onUpdateDownloaded() {
    return () => void 0;
  },
  onNavigate() {
    return () => void 0;
  },
  async openLink(url) {
    if (canUseDOM()) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  },
  async getDeviceName() {
    return "browser";
  },
  async getInstanceName() {
    return "svelte-shell";
  },
  async getLocale() {
    if (!canUseDOM()) {
      return "en";
    }
    return window.navigator.language || "en";
  },
  async ensureShortcutConfig(_config) {
  },
  async ensureProxyConfig(_config) {
  },
  async relaunch() {
    if (canUseDOM()) {
      window.location.reload();
    }
  },
  async getConfig() {
    return newConfigs();
  },
  async getSettings() {
    return settings();
  },
  async getStoreBlob(key) {
    return await this.getStoreValue(`blob:${key}`);
  },
  async setStoreBlob(key, value) {
    await this.setStoreValue(`blob:${key}`, value);
  },
  async delStoreBlob(key) {
    await this.delStoreValue(`blob:${key}`);
  },
  async listStoreBlobKeys() {
    const keys = await this.getAllStoreKeys();
    return keys.filter((key) => key.startsWith("blob:"));
  },
  initTracking() {
  },
  trackingEvent() {
  },
  async shouldShowAboutDialogWhenStartUp() {
    return false;
  },
  async appLog() {
  },
  async exportLogs() {
    return "";
  },
  async clearLogs() {
  },
  async ensureAutoLaunch() {
  },
  async parseFileLocally() {
    return { isSupported: false };
  },
  async parseFileWithMineru() {
    return { success: false, error: "Not implemented" };
  },
  async cancelMineruParse() {
    return { success: false, error: "Not implemented" };
  },
  async isFullscreen() {
    return canUseDOM() ? Boolean(document.fullscreenElement) : false;
  },
  async setFullscreen(enabled) {
    if (!canUseDOM()) {
      return;
    }
    if (enabled) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  },
  async installUpdate() {
    throw new Error("App update install is not implemented in the Svelte rescue shell.");
  },
  getKnowledgeBaseController() {
    return knowledgeBaseController;
  },
  getImageGenerationStorage() {
    return imageGenerationStorage;
  },
  async minimize() {
  },
  async maximize() {
  },
  async unmaximize() {
  },
  async closeWindow() {
    if (canUseDOM()) {
      window.close();
    }
  },
  async isMaximized() {
    return false;
  },
  onMaximizedChange() {
    return () => void 0;
  }
};
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
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { children } = $$props;
    const pathname = derived(() => store_get($$store_subs ??= {}, "$page", page).url.pathname);
    const currentSessionId = derived(() => pathname().startsWith("/session/") ? store_get($$store_subs ??= {}, "$page", page).params.id : null);
    const isChatRoute = derived(() => pathname() === "/" || pathname().startsWith("/session/"));
    const providers = derived(() => getAvailableProviders(settingsStore.settings, providerCatalogStore.systemProviders));
    const selectedModel = derived(() => currentSessionId() && conversationStore.currentSession?.id === currentSessionId() ? conversationStore.currentSession?.settings?.provider && conversationStore.currentSession?.settings?.modelId ? {
      provider: conversationStore.currentSession.settings.provider,
      modelId: conversationStore.currentSession.settings.modelId
    } : null : conversationStore.draftChatModel);
    $$renderer2.push(`<div class="app-shell app-container svelte-12qhfyh">`);
    Sidebar($$renderer2, {
      open: uiStore.state.showSidebar,
      width: uiStore.state.sidebarWidth ?? 280,
      sessions: conversationStore.sessions,
      currentSessionId: currentSessionId(),
      onResizeSidebar: (width) => uiStore.setSidebarWidth(width)
    });
    $$renderer2.push(`<!----> <div class="main-content svelte-12qhfyh">`);
    if (isChatRoute()) {
      $$renderer2.push("<!--[0-->");
      Header($$renderer2, {
        providers: providers(),
        selectedModel: selectedModel(),
        currentTheme: themeStore.resolvedTheme,
        sidebarOpen: uiStore.state.showSidebar
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <main class="page-content svelte-12qhfyh">`);
    children($$renderer2);
    $$renderer2.push(`<!----></main></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _layout as default
};
