import { s as settings, n as newConfigs } from "./defaults.js";
import localforage from "localforage";
import { I as IndexedDBImageGenerationStorage } from "./ImageGenerationStorage.js";
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
const imageGenerationStorage = new IndexedDBImageGenerationStorage();
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
    return await localforage.getItem(key) ?? null;
  },
  async setStoreBlob(key, value) {
    await localforage.setItem(key, value);
  },
  async delStoreBlob(key) {
    await localforage.removeItem(key);
  },
  async listStoreBlobKeys() {
    return await localforage.keys();
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
export {
  platform as p
};
