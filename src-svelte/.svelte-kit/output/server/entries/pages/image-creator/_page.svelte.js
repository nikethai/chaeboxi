import { f as ensure_array_like, b as attr, e as escape_html, a as attr_class, d as derived, c as attr_style } from "../../../chunks/index2.js";
import { P as ProviderModelInfoSchema, n as newConfigs, s as settings, a as ModelProviderEnum, M as ModelProviderType } from "../../../chunks/defaults.js";
import { p as providerCatalogStore } from "../../../chunks/provider-catalog.svelte.js";
import { s as settingsStore } from "../../../chunks/settings.svelte.js";
import "clsx";
import { a as getAvailableProviders } from "../../../chunks/providers.js";
import debounce from "lodash/debounce.js";
import dayjs from "dayjs";
import localforage from "localforage";
import { v4 } from "uuid";
import { I as IndexedDBImageGenerationStorage } from "../../../chunks/ImageGenerationStorage.js";
import "copy-to-clipboard";
import { atom, getDefaultStore } from "jotai";
import { createStore } from "zustand";
import { subscribeWithSelector, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { z } from "zod";
import "lodash/uniq.js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "@capacitor-community/sqlite";
function EmptyState($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { disabled = false } = $$props;
    const quickPrompts = [
      "A serene mountain landscape at sunset",
      "A futuristic city with flying cars",
      "A cozy coffee shop interior",
      "An abstract painting with vibrant colors",
      "A cute rabbit in Pixar animation style"
    ];
    $$renderer2.push(`<div class="empty-state svelte-1j0vq35"><div class="empty-icon svelte-1j0vq35"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="m21 15-5-5L5 21"></path></svg></div> <div class="empty-copy svelte-1j0vq35"><p class="empty-kicker svelte-1j0vq35">Real image route</p> <h1 class="svelte-1j0vq35">Create amazing images</h1> <p class="svelte-1j0vq35">Describe the image you want to generate. This route uses the real generation flow and keeps incomplete extras
			out of the way.</p></div> <div class="prompt-grid svelte-1j0vq35"><!--[-->`);
    const each_array = ensure_array_like(quickPrompts);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let prompt = each_array[$$index];
      $$renderer2.push(`<button class="prompt-chip svelte-1j0vq35" type="button"${attr("disabled", disabled, true)}>${escape_html(prompt)}</button>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
function ErrorCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { error = "Generation failed.", retrying = false } = $$props;
    $$renderer2.push(`<div class="error-card svelte-oluh2z"><div class="error-icon svelte-oluh2z"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></div> <div class="error-copy svelte-oluh2z"><h2 class="svelte-oluh2z">Generation failed</h2> <p class="svelte-oluh2z">${escape_html(error)}</p> <div class="error-actions svelte-oluh2z"><button type="button" class="retry-btn svelte-oluh2z"${attr("disabled", retrying, true)}>${escape_html(retrying ? "Retrying…" : "Retry")}</button> <a href="/settings/provider" class="svelte-oluh2z">Provider settings</a></div></div></div>`);
  });
}
function GeneratedImagesGallery($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { images = [], generating = false } = $$props;
    if (images.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="gallery svelte-1ucmys2"><!--[-->`);
      const each_array = ensure_array_like(images);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let image = each_array[$$index];
        $$renderer2.push(`<div class="gallery-card svelte-1ucmys2"><button class="gallery-image-button svelte-1ucmys2" type="button"><img${attr("src", image.dataUrl)} alt="" class="gallery-image svelte-1ucmys2"/></button> <div class="gallery-actions svelte-1ucmys2"><button type="button" class="svelte-1ucmys2">Use as reference</button> <a${attr("href", image.dataUrl)}${attr("download", `image-${image.storageKey.replaceAll(":", "-")}.png`)} class="svelte-1ucmys2">Download</a></div></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (generating) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="shimmer-shell svelte-1ucmys2"><div class="shimmer-card svelte-1ucmys2"></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
const MAX_REFERENCE_IMAGES = 14;
const HISTORY_PANEL_WIDTH = 280;
const IMAGE_MODEL_FALLBACK_NAMES = {
  "": "GPT Image",
  "gpt-image-1": "GPT Image 1",
  "gpt-image-1.5": "GPT Image 1.5",
  "gemini-2.5-flash-image": "Nano Banana",
  "gemini-3-pro-image-preview": "Nano Banana Pro",
  "gemini-3-pro-image": "Nano Banana Pro"
};
const OPENAI_IMAGE_MODEL_IDS = ["gpt-image-1", "gpt-image-1.5"];
const GEMINI_IMAGE_MODEL_IDS = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview", "gemini-3-pro-image"];
const RATIO_OPTIONS = {
  gpt: ["auto", "1:1", "3:2", "2:3"],
  gemini: ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "4:5", "5:4", "16:9", "9:16", "21:9"],
  default: ["auto", "1:1", "3:2", "2:3"]
};
function getRatioOptionsForModel(modelId) {
  switch (modelId) {
    case "":
    case "gpt-image-1":
    case "gpt-image-1.5":
      return RATIO_OPTIONS.gpt;
    case "gemini-2.5-flash-image":
    case "gemini-3-pro-image-preview":
    case "gemini-3-pro-image":
      return RATIO_OPTIONS.gemini;
    default:
      if (modelId.includes("gemini") && modelId.includes("image")) {
        return RATIO_OPTIONS.gemini;
      }
      return RATIO_OPTIONS.default;
  }
}
function blobToDataUrl(blob) {
  if (blob.startsWith("data:")) {
    return blob;
  }
  if (blob.startsWith("/9j/") || blob.startsWith("ÿØ")) {
    return `data:image/jpeg;base64,${blob}`;
  }
  return `data:image/png;base64,${blob}`;
}
function dedupeRecords(records) {
  const seen = /* @__PURE__ */ new Set();
  const next = [];
  for (const record of records) {
    if (seen.has(record.id)) {
      continue;
    }
    seen.add(record.id);
    next.push(record);
  }
  return next;
}
class ImageGenerationStore {
  ready = false;
  history = [];
  currentRecord = null;
  currentRecordId = null;
  currentGeneratingId = null;
  lastUsedPictureModel = null;
  historyLoading = false;
  loadingMore = false;
  error = null;
  rendererModule = null;
  initializing = null;
  historyCursor = 0;
  unsubscribeImageStore = null;
  unsubscribeLastUsed = null;
  pollTimer = null;
  recordRefreshInFlight = null;
  constructor() {
  }
  get hasMoreHistory() {
    return this.historyCursor !== null;
  }
  get imageStorage() {
    return this.rendererModule?.platform.getImageGenerationStorage() ?? null;
  }
  syncFromRendererStore() {
    if (!this.rendererModule) {
      return;
    }
    const rendererState = this.rendererModule.imageGenerationStore.getState();
    const nextRecordId = rendererState.currentRecordId;
    const nextGeneratingId = rendererState.currentGeneratingId;
    const recordChanged = this.currentRecordId !== nextRecordId;
    const generatingChanged = this.currentGeneratingId !== nextGeneratingId;
    this.currentRecordId = nextRecordId;
    this.currentGeneratingId = nextGeneratingId;
    this.lastUsedPictureModel = this.rendererModule.lastUsedModelStore.getState().picture ?? null;
    if (!nextRecordId) {
      this.currentRecord = null;
    }
    if (recordChanged && nextRecordId) {
      void this.refreshCurrentRecord();
    }
    if (generatingChanged) {
      this.syncPolling();
      if (!nextGeneratingId) {
        void this.loadHistory(true);
      }
    }
  }
  syncPolling() {
    {
      return;
    }
  }
  patchHistoryRecord(record) {
    if (!record) {
      return;
    }
    const index = this.history.findIndex((candidate) => candidate.id === record.id);
    if (index >= 0) {
      const nextHistory = [...this.history];
      nextHistory[index] = record;
      this.history = nextHistory;
      return;
    }
    this.history = dedupeRecords([record, ...this.history]);
  }
  async loadHistoryInternal(reset = false) {
    if (!this.imageStorage) {
      return;
    }
    if (reset) {
      this.historyLoading = true;
      this.historyCursor = 0;
      this.error = null;
    } else if (this.historyCursor === null || this.loadingMore) {
      return;
    } else {
      this.loadingMore = true;
    }
    try {
      const cursor = reset ? 0 : this.historyCursor ?? 0;
      const page = await this.imageStorage.getPage(cursor);
      this.historyCursor = page.nextCursor;
      this.history = reset ? page.items : dedupeRecords([...this.history, ...page.items]);
    } catch (error) {
      this.error = error instanceof Error ? error.message : `${error}`;
    } finally {
      this.historyLoading = false;
      this.loadingMore = false;
    }
  }
  async refreshCurrentRecordInternal() {
    if (!this.imageStorage || !this.currentRecordId) {
      this.currentRecord = null;
      return null;
    }
    if (this.recordRefreshInFlight) {
      return this.recordRefreshInFlight;
    }
    this.recordRefreshInFlight = this.imageStorage.getById(this.currentRecordId).then((record) => {
      this.currentRecord = record;
      this.patchHistoryRecord(record);
      return record;
    }).finally(() => {
      this.recordRefreshInFlight = null;
    });
    return this.recordRefreshInFlight;
  }
  async init() {
    {
      return;
    }
  }
  async loadHistory(reset = false) {
    await this.init();
    await this.loadHistoryInternal(reset);
  }
  async refreshCurrentRecord() {
    await this.init();
    return await this.refreshCurrentRecordInternal();
  }
  async selectRecord(recordId) {
    await this.init();
    this.rendererModule?.imageGenerationStore.getState().setCurrentRecordId(recordId);
    this.syncFromRendererStore();
    return await this.refreshCurrentRecord();
  }
  async createAndGenerate(params) {
    await this.init();
    if (!this.rendererModule) {
      return null;
    }
    const recordId = await this.rendererModule.createAndGenerate(params);
    this.syncFromRendererStore();
    await this.refreshCurrentRecord();
    return recordId;
  }
  async retryGeneration(recordId) {
    await this.init();
    await this.rendererModule?.retryGeneration(recordId);
    this.syncFromRendererStore();
    await this.refreshCurrentRecord();
  }
  async deleteRecord(recordId) {
    await this.init();
    await this.rendererModule?.deleteRecord(recordId);
    this.history = this.history.filter((record) => record.id !== recordId);
    this.syncFromRendererStore();
    if (this.currentRecordId === recordId) {
      this.currentRecord = null;
    }
  }
  clearCurrentRecord() {
    this.rendererModule?.clearCurrentRecord();
    this.syncFromRendererStore();
  }
  async getStoredImageDataUrl(storageKey) {
    await this.init();
    const blob = await this.rendererModule?.storage.getBlob(storageKey);
    return blob ? blobToDataUrl(blob) : null;
  }
  async saveStoredImage(storageKey, dataUrl) {
    await this.init();
    await this.rendererModule?.storage.setBlob(storageKey, dataUrl);
  }
  async deleteStoredImage(storageKey) {
    await this.init();
    await this.rendererModule?.storage.delBlob(storageKey);
  }
}
const imageGenerationStore = new ImageGenerationStore();
function HistoryList($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      records = [],
      currentRecordId = null,
      loading = false,
      hasMore = false,
      loadingMore = false,
      mobile = false,
      onSelect,
      onLoadMore,
      onDelete
    } = $$props;
    let thumbnails = {};
    $$renderer2.push(`<div class="history-list svelte-taj9un">`);
    if (loading && records.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<!--[-->`);
      const each_array = ensure_array_like(Array.from({ length: 3 }));
      for (let index = 0, $$length = each_array.length; index < $$length; index++) {
        each_array[index];
        $$renderer2.push(`<div class="history-skeleton svelte-taj9un"></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    } else if (records.length === 0) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="history-empty svelte-taj9un"><p class="svelte-taj9un">No image history yet.</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--[-->`);
      const each_array_1 = ensure_array_like(records);
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let record = each_array_1[$$index_1];
        $$renderer2.push(`<div role="button" tabindex="0"${attr_class("history-item svelte-taj9un", void 0, { "active": record.id === currentRecordId })}><div class="history-thumb svelte-taj9un">`);
        if (thumbnails[record.id]) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<img${attr("src", thumbnails[record.id] ?? "")} alt="" class="svelte-taj9un"/>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<div class="history-thumb-fallback svelte-taj9un"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svelte-taj9un"><rect x="3" y="3" width="18" height="18" rx="3" class="svelte-taj9un"></rect><circle cx="8.5" cy="8.5" r="1.5" class="svelte-taj9un"></circle><path d="m21 15-5-5L5 21" class="svelte-taj9un"></path></svg></div>`);
        }
        $$renderer2.push(`<!--]--></div> <div class="history-copy svelte-taj9un"><div class="history-title svelte-taj9un">${escape_html(record.prompt)}</div> <div class="history-meta svelte-taj9un"><span class="svelte-taj9un">${escape_html(new Date(record.createdAt).toLocaleDateString())}</span> <span class="svelte-taj9un">•</span> <span class="svelte-taj9un">${escape_html(IMAGE_MODEL_FALLBACK_NAMES[record.model.modelId] || record.model.modelId)}</span></div></div> <button type="button" class="history-delete svelte-taj9un" aria-label="Delete image record"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svelte-taj9un"><path d="M3 6h18" class="svelte-taj9un"></path><path d="M8 6V4h8v2" class="svelte-taj9un"></path><path d="m19 6-1 14H6L5 6" class="svelte-taj9un"></path></svg></button></div>`);
      }
      $$renderer2.push(`<!--]--> `);
      if (hasMore) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button type="button" class="load-more svelte-taj9un"${attr("disabled", loadingMore, true)}>${escape_html(loadingMore ? "Loading…" : "Load more")}</button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function MobileSheet($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { open = false, title = "", onClose, children, actions } = $$props;
    if (open) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="sheet-overlay svelte-iullg6" role="presentation"><div class="sheet svelte-iullg6" role="dialog" aria-modal="true"${attr("aria-label", title)}><div class="sheet-handle svelte-iullg6"></div> <header class="sheet-header svelte-iullg6"><div class="sheet-title svelte-iullg6">${escape_html(title)}</div> <div class="sheet-actions svelte-iullg6">`);
      actions?.($$renderer2);
      $$renderer2.push(`<!----></div></header> <div class="sheet-body svelte-iullg6">`);
      children?.($$renderer2);
      $$renderer2.push(`<!----></div></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function PromptDisplay($$renderer, $$props) {
  let {
    prompt = "",
    modelLabel = "",
    referenceImageCount = 0,
    status = "done"
  } = $$props;
  const statusLabel = derived(() => status === "generating" ? "Generating" : status === "error" ? "Failed" : status === "pending" ? "Queued" : "Completed");
  $$renderer.push(`<div class="prompt-display svelte-2s0g1j"><p class="prompt-text svelte-2s0g1j">${escape_html(prompt)}</p> <div class="prompt-meta svelte-2s0g1j"><span>${escape_html(modelLabel)}</span> <span class="meta-dot svelte-2s0g1j">•</span> <span>${escape_html(statusLabel())}</span> `);
  if (referenceImageCount > 0) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<span class="meta-dot svelte-2s0g1j">•</span> <span>${escape_html(referenceImageCount)} ref${escape_html(referenceImageCount === 1 ? "" : "s")}</span>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div></div>`);
}
function ReferenceImagesPreview($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { images = [] } = $$props;
    if (images.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="reference-strip svelte-n4dqkw"><!--[-->`);
      const each_array = ensure_array_like(images);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let image = each_array[$$index];
        $$renderer2.push(`<div class="thumb-shell svelte-n4dqkw"><img${attr("src", image.dataUrl)} alt="" class="thumb-image svelte-n4dqkw"/> <button class="thumb-remove svelte-n4dqkw" type="button" aria-label="Remove reference image"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button></div>`);
      }
      $$renderer2.push(`<!--]--> `);
      if (images.length < MAX_REFERENCE_IMAGES) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button class="add-thumb svelte-n4dqkw" type="button" aria-label="Add reference image"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg></button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
const pendingPromises = /* @__PURE__ */ new Map();
const memoryCache = /* @__PURE__ */ new Map();
class CrossPlatformStorage {
  constructor(name) {
    this.memoryFallback = /* @__PURE__ */ new Map();
    this.name = name;
  }
  async getItem(key) {
    if (typeof window !== "undefined" && "localforage" in window) {
      try {
        const localforage2 = (await import("localforage")).default;
        const store2 = localforage2.createInstance({ name: this.name });
        return await store2.getItem(key);
      } catch (error) {
        console.error("Error accessing localforage:", error);
        return this.memoryFallback.get(key) || null;
      }
    }
    return this.memoryFallback.get(key) || null;
  }
  async setItem(key, value) {
    if (typeof window !== "undefined" && "localforage" in window) {
      try {
        const localforage2 = (await import("localforage")).default;
        const store2 = localforage2.createInstance({ name: this.name });
        await store2.setItem(key, value);
        return;
      } catch (error) {
        console.error("Error accessing localforage:", error);
        this.memoryFallback.set(key, value);
        return;
      }
    }
    this.memoryFallback.set(key, value);
  }
  async removeItem(key) {
    if (typeof window !== "undefined" && "localforage" in window) {
      try {
        const localforage2 = (await import("localforage")).default;
        const store2 = localforage2.createInstance({ name: this.name });
        await store2.removeItem(key);
        return;
      } catch (error) {
        console.error("Error accessing localforage:", error);
        this.memoryFallback.delete(key);
        return;
      }
    }
    this.memoryFallback.delete(key);
  }
}
const store$1 = new CrossPlatformStorage("chatboxcache");
async function cacheWithStorage(key, getter, options) {
  let cache2 = null;
  if (options.memoryOnly) {
    cache2 = memoryCache.get(key) || null;
  } else {
    const cachedStr = await store$1.getItem(key);
    if (cachedStr) {
      try {
        cache2 = JSON.parse(cachedStr);
      } catch (e) {
        console.error(`Error parsing cache for key ${key}:`, e);
      }
    }
  }
  if (cache2 && cache2.expireAt > Date.now()) {
    return cache2.value;
  }
  const existingPromise = pendingPromises.get(key);
  if (existingPromise) {
    return existingPromise;
  }
  const promise = (async () => {
    try {
      const newValue = await getter();
      const newCache = {
        value: newValue,
        expireAt: Date.now() + options.ttl
      };
      if (options.memoryOnly) {
        memoryCache.set(key, newCache);
      } else {
        await store$1.setItem(key, JSON.stringify(newCache));
      }
      return newValue;
    } catch (e) {
      if (options.refreshFallbackToCache && cache2) {
        return cache2.value;
      }
      throw e;
    } finally {
      pendingPromises.delete(key);
    }
  })();
  pendingPromises.set(key, promise);
  return promise;
}
async function cache(key, getter, options) {
  return cacheWithStorage(key, getter, options);
}
function parseLocale(locale) {
  if (locale === "zh" || locale.startsWith("zh_CN") || locale.startsWith("zh-CN") || locale.startsWith("zh_Hans") || locale.startsWith("zh-Hans")) {
    return "zh-Hans";
  }
  if (locale.startsWith("zh_HK") || locale.startsWith("zh-HK") || locale.startsWith("zh_TW") || locale.startsWith("zh-TW") || locale.startsWith("zh_Hant") || locale.startsWith("zh-Hant")) {
    return "zh-Hant";
  }
  if (locale.startsWith("ja")) {
    return "ja";
  }
  if (locale.startsWith("ko")) {
    return "ko";
  }
  if (locale.startsWith("ru")) {
    return "ru";
  }
  if (locale.startsWith("de")) {
    return "de";
  }
  if (locale.startsWith("fr")) {
    return "fr";
  }
  if (locale.startsWith("pt")) {
    return "pt-PT";
  }
  if (locale.startsWith("es")) {
    return "es";
  }
  if (locale.startsWith("ar")) {
    return "ar";
  }
  if (locale.startsWith("it")) {
    return "it-IT";
  }
  if (locale.startsWith("sv")) {
    return "sv";
  }
  if (locale.startsWith("nb")) {
    return "nb-NO";
  }
  return "en";
}
const ua = navigator.userAgent;
const getBrowser = () => {
  if (ua.indexOf("Opera") > -1) {
    return "Opera";
  }
  if (ua.indexOf("Chrome") > -1) {
    return "Chrome";
  }
  if (ua.indexOf("Firefox") > -1) {
    return "Firefox";
  }
  if (ua.indexOf("Safari") > -1) {
    return "Safari";
  }
  if (ua.indexOf("MSIE") > -1) {
    return "IE";
  }
  if (ua.indexOf("Trident") > -1) {
    return "IE";
  }
  if (ua.indexOf("Edge") > -1) {
    return "Edge";
  }
  return "Unknown";
};
const getOS = () => {
  if (ua.indexOf("Windows") > -1) {
    return "Windows";
  }
  if (ua.indexOf("Mac") > -1) {
    return "Mac";
  }
  if (ua.indexOf("Linux") > -1) {
    return "Linux";
  }
  if (ua.indexOf("Android") > -1) {
    return "Android";
  }
  if (ua.indexOf("iPhone") > -1) {
    return "iOS";
  }
  if (ua.indexOf("iPad") > -1) {
    return "iOS";
  }
  if (ua.indexOf("iPod") > -1) {
    return "iOS";
  }
  return "Unknown";
};
class DesktopKnowledgeBaseController {
  constructor(ipc) {
    this.ipc = ipc;
  }
  async list() {
    const knowledgeBases = await this.ipc.invoke("kb:list");
    return knowledgeBases;
  }
  async create(createParams) {
    await this.ipc.invoke("kb:create", createParams);
  }
  async delete(id) {
    await this.ipc.invoke("kb:delete", id);
  }
  async listFiles(kbId) {
    const files = await this.ipc.invoke("kb:file:list", kbId);
    return files;
  }
  async countFiles(kbId) {
    return await this.ipc.invoke("kb:file:count", kbId);
  }
  async listFilesPaginated(kbId, offset = 0, limit = 20) {
    return await this.ipc.invoke("kb:file:list-paginated", kbId, offset, limit);
  }
  async uploadFile(kbId, file) {
    return await this.ipc.invoke("kb:file:upload", kbId, file);
  }
  async deleteFile(fileId) {
    return await this.ipc.invoke("kb:file:delete", fileId);
  }
  async retryFile(fileId, useRemoteParsing = false) {
    return await this.ipc.invoke("kb:file:retry", fileId, useRemoteParsing);
  }
  async pauseFile(fileId) {
    return await this.ipc.invoke("kb:file:pause", fileId);
  }
  async resumeFile(fileId) {
    return await this.ipc.invoke("kb:file:resume", fileId);
  }
  async search(kbId, query) {
    const results = await this.ipc.invoke("kb:search", kbId, query);
    return results;
  }
  async update(updateParams) {
    await this.ipc.invoke("kb:update", updateParams);
  }
  async getFilesMeta(kbId, fileIds) {
    return this.ipc.invoke("kb:file:get-metas", kbId, fileIds);
  }
  async readFileChunks(kbId, chunks) {
    return this.ipc.invoke("kb:file:read-chunks", kbId, chunks);
  }
  async testMineruConnection(apiToken) {
    return this.ipc.invoke("parser:test-mineru", apiToken);
  }
}
function parseImage(base64) {
  base64 = base64.replace(/^data:/, "");
  const markIndex = base64.indexOf(";");
  if (markIndex < 0) {
    return { type: "", data: "" };
  }
  const type = base64.slice(0, markIndex);
  base64 = base64.slice(markIndex + 1);
  base64 = base64.replace(/^base64,/, "");
  const data = base64;
  return { type, data };
}
class WebExporter {
  constructor() {
  }
  async exportBlob(filename, blob, encoding) {
    var eleLink = document.createElement("a");
    eleLink.download = filename;
    eleLink.style.display = "none";
    eleLink.href = URL.createObjectURL(blob);
    document.body.appendChild(eleLink);
    eleLink.click();
    document.body.removeChild(eleLink);
  }
  async exportTextFile(filename, content) {
    var eleLink = document.createElement("a");
    eleLink.download = filename;
    eleLink.style.display = "none";
    var blob = new Blob([content]);
    eleLink.href = URL.createObjectURL(blob);
    document.body.appendChild(eleLink);
    eleLink.click();
    document.body.removeChild(eleLink);
  }
  async exportImageFile(basename, base64Data) {
    let { type, data } = parseImage(base64Data);
    if (type === "") {
      type = "image/png";
      data = base64Data;
    }
    const ext = (type.split("/")[1] || "png").split("+")[0];
    const filename = basename + "." + ext;
    const raw = window.atob(data);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    const blob = new Blob([uInt8Array], { type });
    var eleLink = document.createElement("a");
    eleLink.download = filename;
    eleLink.style.display = "none";
    eleLink.href = URL.createObjectURL(blob);
    document.body.appendChild(eleLink);
    eleLink.click();
    document.body.removeChild(eleLink);
  }
  async exportByUrl(filename, url) {
    var eleLink = document.createElement("a");
    eleLink.style.display = "none";
    eleLink.download = filename;
    eleLink.href = url;
    document.body.appendChild(eleLink);
    eleLink.click();
    document.body.removeChild(eleLink);
  }
  async exportStreamingJson(filename, dataCallback) {
    try {
      let content = "";
      const generator = dataCallback();
      for await (const chunk of generator) {
        content += chunk;
      }
      await this.exportTextFile(filename, content);
    } catch (error) {
      console.error("Failed to export streaming JSON:", error);
      throw error;
    }
  }
}
const textExts = [
  ".txt",
  // Plain text file
  ".md",
  // Markdown file
  ".mdx",
  // Markdown file
  ".html",
  // HTML file
  ".htm",
  // HTML file (alternative extension)
  ".xml",
  // XML file
  ".json",
  // JSON file
  ".yaml",
  // YAML file
  ".yml",
  // YAML file (alternative extension)
  ".csv",
  // Comma-separated values file
  ".tsv",
  // Tab-separated values file
  ".ini",
  // Configuration file
  ".log",
  // Log file
  ".rtf",
  // Rich text format file
  ".tex",
  // LaTeX file
  ".srt",
  // Subtitle file
  ".xhtml",
  // XHTML file
  ".nfo",
  // Info file (mainly used for scene releases)
  ".conf",
  // Configuration file
  ".config",
  // Configuration file
  ".env",
  // Environment variables file
  ".rst",
  // reStructuredText file
  ".php",
  // PHP script file with embedded HTML
  ".js",
  // JavaScript file
  ".ts",
  // TypeScript file
  ".jsp",
  // JavaServer Pages file
  ".aspx",
  // ASP.NET file
  ".bat",
  // Windows batch file
  ".sh",
  // Unix/Linux shell script file
  ".py",
  // Python script file
  ".rb",
  // Ruby script file
  ".pl",
  // Perl script file
  ".sql",
  // SQL script file
  ".css",
  // Cascading Style Sheets file
  ".less",
  // Less CSS preprocessor file
  ".scss",
  // Sass CSS preprocessor file
  ".sass",
  // Sass file
  ".styl",
  // Stylus CSS preprocessor file
  ".coffee",
  // CoffeeScript file
  ".ino",
  // Arduino code file
  ".asm",
  // Assembly language file
  ".go",
  // Go language file
  ".scala",
  // Scala language file
  ".swift",
  // Swift language file
  ".kt",
  // Kotlin language file
  ".rs",
  // Rust language file
  ".lua",
  // Lua language file
  ".groovy",
  // Groovy language file
  ".dart",
  // Dart language file
  ".hs",
  // Haskell language file
  ".clj",
  // Clojure language file
  ".cljs",
  // ClojureScript language file
  ".elm",
  // Elm language file
  ".erl",
  // Erlang language file
  ".ex",
  // Elixir language file
  ".exs",
  // Elixir script file
  ".pug",
  // Pug (formerly Jade) template file
  ".haml",
  // Haml template file
  ".slim",
  // Slim template file
  ".tpl",
  // Template file (generic)
  ".ejs",
  // Embedded JavaScript template file
  ".hbs",
  // Handlebars template file
  ".mustache",
  // Mustache template file
  ".jade",
  // Jade template file (renamed to Pug)
  ".twig",
  // Twig template file
  ".blade",
  // Blade template file (Laravel)
  ".vue",
  // Vue.js single file component
  ".jsx",
  // React JSX file
  ".tsx",
  // React TSX file
  ".graphql",
  // GraphQL query language file
  ".gql",
  // GraphQL query language file
  ".proto",
  // Protocol Buffers file
  ".thrift",
  // Thrift file
  ".toml",
  // TOML configuration file
  ".edn",
  // Clojure data representation file
  ".cake",
  // CakePHP configuration file
  ".ctp",
  // CakePHP view file
  ".cfm",
  // ColdFusion markup language file
  ".cfc",
  // ColdFusion component file
  ".m",
  // Objective-C source file
  ".mm",
  // Objective-C++ source file
  ".gradle",
  // Gradle build file
  ".kts",
  // Kotlin Script file
  ".java",
  // Java code file
  ".cs",
  // C# code file
  ".c",
  // C source file
  ".h",
  // C/C++ header file
  ".cpp",
  // C++ source file
  ".hpp",
  // C++ header file
  ".cc",
  // C++ source file (alternative extension)
  ".cxx",
  // C++ source file (alternative extension)
  ".mjs"
  // JavaScript ES module file
];
function isTextFilePath(filePath) {
  return textExts.some((ext) => filePath.toLowerCase().endsWith(ext));
}
const initialState = {
  accessToken: null,
  refreshToken: null
};
createStore()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        ...initialState,
        setTokens: (tokens) => {
          set((state) => {
            state.accessToken = tokens.accessToken;
            state.refreshToken = tokens.refreshToken;
          });
        },
        clearTokens: () => {
          set((state) => {
            state.accessToken = null;
            state.refreshToken = null;
          });
        },
        getTokens: () => {
          const state = get();
          if (state.accessToken && state.refreshToken) {
            return {
              accessToken: state.accessToken,
              refreshToken: state.refreshToken
            };
          }
          return null;
        }
      })),
      {
        name: "auth-info",
        version: 0,
        partialize: (state) => ({
          accessToken: state.accessToken,
          refreshToken: state.refreshToken
        })
      }
    )
  )
);
class BaseError extends Error {
  constructor(message) {
    super(message);
    this.code = 1;
  }
}
class ChatboxAIAPIError extends BaseError {
  static {
    this.codeNameMap = {
      // 超出配额
      token_quota_exhausted: {
        name: "token_quota_exhausted",
        code: 10004,
        // 小于 20000 是为了兼容旧版本
        i18nKey: "You have reached your current quota for the {{model}} model. Please <OpenSettingButton>go to Settings</OpenSettingButton> to switch to a different model or check your provider configuration."
      },
      // 当前套餐不支持该模型
      license_upgrade_required: {
        name: "license_upgrade_required",
        code: 20001,
        i18nKey: "The current account configuration does not support the {{model}} model. Please <OpenSettingButton>open Settings</OpenSettingButton> and switch to another model or provider."
      },
      // license 过期
      expired_license: {
        name: "expired_license",
        code: 20002,
        i18nKey: "Authentication has expired or is invalid. Please check your provider credentials and try again."
      },
      // 未输入 license
      license_key_required: {
        name: "license_key_required",
        code: 20003,
        i18nKey: "The selected model provider requires credentials that are not configured yet. Please <OpenSettingButton>open Settings</OpenSettingButton> and configure provider credentials, or choose a different provider."
      },
      // 输入的 license 未找到
      license_not_found: {
        name: "license_not_found",
        code: 20004,
        i18nKey: "The configured provider credentials are invalid. Please update them and try again."
      },
      // 超出配额
      rate_limit_exceeded: {
        name: "rate_limit_exceeded",
        code: 20005,
        i18nKey: "You have exceeded the provider rate limit. Please try again later."
      },
      // 参数错误
      bad_params: {
        name: "bad_params",
        code: 20006,
        i18nKey: "Invalid request parameters detected. Please try again later. Persistent failures may indicate an outdated software version. Consider upgrading to access the latest performance improvements and features."
      },
      // 文件类型不支持。支持的类型有 txt、md、html、doc、docx、pdf、excel、pptx、csv 以及所有文本类型的文件，包括代码文件
      file_type_not_supported: {
        name: "file_type_not_supported",
        code: 20007,
        i18nKey: "File type not supported. Supported types include txt, md, html, doc, docx, pdf, excel, pptx, csv, and all text-based files, including code files."
      },
      // 发送的文件已经超过七天，为了保护您的隐私，所有文件相关的缓存数据已经清理。您需要重新创建对话或刷新上下文，然后再次发送文件。
      file_expired: {
        name: "file_expired",
        code: 20008,
        i18nKey: "The file you sent has expired. To protect your privacy, all file-related cache data has been cleared. You need to create a new conversation or refresh the context, and then send the file again."
      },
      // 未找到文件的缓存数据。请重新创建对话或刷新上下文，然后再次发送文件。
      file_not_found: {
        name: "file_not_found",
        code: 20009,
        i18nKey: "The cache data for the file was not found. Please create a new conversation or refresh the context, and then send the file again."
      },
      // 文件大小超过 50MB
      file_too_large: {
        name: "file_too_large",
        code: 20010,
        i18nKey: "The file size exceeds the limit of 50MB. Please reduce the file size and try again."
      },
      // 当前模型不支持发送文件
      model_not_support_file: {
        name: "model_not_support_file",
        code: 20011,
        i18nKey: "The {{model}} API doesn't support document understanding. Please switch to a model with vision/document capabilities, or use local document parsing where available."
      },
      model_not_support_file_2: {
        name: "model_not_support_file_2",
        code: 20012,
        i18nKey: "The {{model}} API doesn't support document understanding. Please switch to a model with vision/document capabilities."
      },
      // 当前模型不支持发送图片
      model_not_support_image: {
        name: "model_not_support_image",
        code: 20013,
        i18nKey: "Sorry, the current model {{model}} API itself does not support image understanding. Please switch to another model that supports vision."
      },
      model_not_support_image_2: {
        name: "model_not_support_image_2",
        code: 20014,
        i18nKey: "Vision capability is not enabled for Model {{model}}. Please enable it or set a default OCR model in <OpenSettingButton>Settings</OpenSettingButton>"
      },
      // 当前模型不支持发送链接
      // 'model_not_support_link': {
      //     name: 'model_not_support_link',
      //     code: 20015,
      //     i18nKey: 'The {{model}} API does not support links. Please use another model that supports link processing, or download <LinkToHomePage>the desktop app</LinkToHomePage> for local processing.'
      // },
      // 'model_not_support_link_2': {
      //     name: 'model_not_support_link_2',
      //     code: 20016,
      //     i18nKey: 'The {{model}} API does not support links. Please download <LinkToHomePage>the desktop app</LinkToHomePage> for local processing.'
      // },
      model_not_support_non_text_file: {
        name: "model_not_support_non_text_file",
        code: 20017,
        i18nKey: "The {{model}} API itself does not support sending files. Local parsing currently supports text-based files (including code). For richer formats, switch to a model with document capabilities or configure a document parser."
      },
      model_not_support_non_text_file_2: {
        name: "model_not_support_non_text_file_2",
        code: 20018,
        i18nKey: "The {{model}} API itself does not support sending files. Local parsing currently supports text-based files (including code)."
      },
      system_error: {
        name: "system_error",
        code: 20019,
        i18nKey: "An error occurred while processing your request. Please try again later. If this error continues, please send an email to hi@chatboxai.com for support."
      },
      unknown: {
        name: "unknown",
        code: 20020,
        i18nKey: "An unknown error occurred. Please try again later. If this error continues, please send an email to hi@chatboxai.com for support."
      },
      model_not_support_web_browsing: {
        name: "model_not_support_web_browsing",
        code: 20021,
        i18nKey: "The {{model}} API itself does not support web browsing. Supported models: {{supported_web_browsing_models}}"
      },
      model_not_support_web_browsing_2: {
        name: "model_not_support_web_browsing_2",
        code: 20022,
        i18nKey: "The {{model}} API itself does not support web browsing. Supported models: {{supported_web_browsing_models}}"
      },
      no_search_result: {
        name: "no_search_result",
        code: 20023,
        i18nKey: "No search results found. Please use another <OpenExtensionSettingButton>search provider</OpenExtensionSettingButton> or try again later."
      },
      chatbox_search_license_key_required: {
        name: "chatbox_search_license_key_required",
        code: 20024,
        i18nKey: "The selected search provider requires credentials that are not configured yet. Please <OpenExtensionSettingButton>open Settings</OpenExtensionSettingButton> and configure the required API key, or choose a different search provider."
      },
      tavily_api_key_required: {
        name: "tavily_api_key_required",
        code: 20025,
        i18nKey: "You have selected Tavily as the search provider, but an API key has not been entered yet. Please <OpenExtensionSettingButton>click here to open Settings</OpenExtensionSettingButton> and enter your API key, or choose a different search provider."
      },
      serper_api_key_required: {
        name: "serper_api_key_required",
        code: 20035,
        i18nKey: "You have selected Serper as the search provider, but an API key has not been entered yet. Please <OpenExtensionSettingButton>click here to open Settings</OpenExtensionSettingButton> and enter your API key, or choose a different search provider."
      },
      google_search_credentials_required: {
        name: "google_search_credentials_required",
        code: 20036,
        i18nKey: "You have selected Google Custom Search as the search provider, but the API key or Search Engine ID is missing. Please <OpenExtensionSettingButton>click here to open Settings</OpenExtensionSettingButton> and complete the configuration, or choose a different search provider."
      },
      model_not_support_tool_use: {
        name: "model_not_support_tool_use",
        code: 20026,
        i18nKey: "Tool use is not enabled for Model {{model}}. Please enable it in <OpenSettingButton>provider settings</OpenSettingButton> or switch to a model that supports tool use."
      },
      mobile_not_support_local_file_parsing: {
        name: "mobile_not_support_local_file_parsing",
        code: 20027,
        i18nKey: "Mobile devices temporarily do not support local parsing of this file type. Please use text files (txt, markdown, etc.) or switch to a model/parser that supports document understanding."
      },
      web_not_support_local_file_parsing: {
        name: "web_not_support_local_file_parsing",
        code: 20028,
        i18nKey: "The web version temporarily does not support local parsing of this file type. Please use text files (txt, markdown, etc.) or switch to a model/parser that supports document understanding."
      },
      // Document parser errors for InputBox file preprocessing
      local_parser_failed: {
        name: "local_parser_failed",
        code: 20029,
        i18nKey: "Local document parsing failed. You can go to <OpenDocumentParserSettingButton>Settings</OpenDocumentParserSettingButton> and switch to another parser."
      },
      chatbox_ai_parser_failed: {
        name: "chatbox_ai_parser_failed",
        code: 20030,
        i18nKey: "Cloud document parsing failed. Please try again later."
      },
      third_party_parser_failed: {
        name: "third_party_parser_failed",
        code: 20031,
        i18nKey: "Document parsing failed. You can go to <OpenDocumentParserSettingButton>Settings</OpenDocumentParserSettingButton> and switch to another parser."
      },
      third_party_parser_not_supported_in_chat: {
        name: "third_party_parser_not_supported_in_chat",
        code: 20032,
        i18nKey: "Selected document parser is currently only supported in Knowledge Base. For chat file attachments, please go to <OpenDocumentParserSettingButton>Settings</OpenDocumentParserSettingButton> and switch to Local."
      },
      mineru_api_token_required: {
        name: "mineru_api_token_required",
        code: 20033,
        i18nKey: "MinerU API token is required. Please go to <OpenDocumentParserSettingButton>Settings</OpenDocumentParserSettingButton> and configure your MinerU API token."
      },
      document_parser_not_configured: {
        name: "document_parser_not_configured",
        code: 20034,
        i18nKey: "This file type requires a document parser. Please go to <OpenDocumentParserSettingButton>Settings</OpenDocumentParserSettingButton> and enable a supported parser."
      }
    };
  }
  static fromCodeName(response, codeName) {
    if (!codeName) {
      return null;
    }
    if (ChatboxAIAPIError.codeNameMap[codeName]) {
      return new ChatboxAIAPIError(response, ChatboxAIAPIError.codeNameMap[codeName]);
    }
    return null;
  }
  static getDetail(code) {
    if (!code) {
      return null;
    }
    for (const name in ChatboxAIAPIError.codeNameMap) {
      if (ChatboxAIAPIError.codeNameMap[name].code === code) {
        return ChatboxAIAPIError.codeNameMap[name];
      }
    }
    return null;
  }
  constructor(message, detail) {
    super(message);
    this.detail = detail;
    this.code = detail.code;
  }
}
const RemoteModelInfoSchema = z.object({
  modelId: z.string(),
  modelName: z.string(),
  labels: z.array(z.string()).optional(),
  type: z.enum(["chat", "embedding", "rerank"]).optional(),
  apiStyle: z.enum(["google", "openai", "anthropic"]).optional(),
  contextWindow: z.number().optional(),
  capabilities: z.array(z.enum(["vision", "tool_use", "reasoning"])).optional()
});
z.object({
  success: z.boolean().optional(),
  data: z.object({
    groupName: z.string(),
    models: z.array(RemoteModelInfoSchema)
  })
});
z.object({
  success: z.boolean(),
  data: z.record(z.string(), ProviderModelInfoSchema.nullable())
});
async function parseTextFileLocally(file) {
  if (!isTextFilePath(file.name)) {
    return { text: "", isSupported: false };
  }
  const text = await file.text();
  return { text, isSupported: true };
}
const store = localforage.createInstance({ name: "chatboxstore" });
class DesktopPlatform {
  constructor(ipc) {
    this.type = "desktop";
    this.exporter = new WebExporter();
    this._imageGenerationStorage = null;
    this.ipc = ipc;
  }
  getStorageType() {
    return "INDEXEDDB";
  }
  async getVersion() {
    return cache("ipc:getVersion", () => this.ipc.invoke("getVersion"), { ttl: 5 * 60 * 1e3, memoryOnly: true });
  }
  async getPlatform() {
    return cache("ipc:getPlatform", () => this.ipc.invoke("getPlatform"), { ttl: 5 * 60 * 1e3 });
  }
  async getArch() {
    return cache("ipc:getArch", () => this.ipc.invoke("getArch"), { ttl: 5 * 60 * 1e3 });
  }
  async shouldUseDarkColors() {
    return await this.ipc.invoke("shouldUseDarkColors");
  }
  onSystemThemeChange(callback) {
    return this.ipc.onSystemThemeChange(callback);
  }
  onWindowShow(callback) {
    return this.ipc.onWindowShow(callback);
  }
  onWindowFocused(callback) {
    return this.ipc.onWindowFocused(callback);
  }
  onUpdateDownloaded(callback) {
    return this.ipc.onUpdateDownloaded(callback);
  }
  onNavigate(callback) {
    return this.ipc.onNavigate(callback);
  }
  async openLink(url) {
    return this.ipc.invoke("openLink", url);
  }
  async getDeviceName() {
    const deviceName = await cache("ipc:getDeviceName", () => this.ipc.invoke("getDeviceName"), {
      ttl: 5 * 60 * 1e3
    });
    return deviceName;
  }
  async getInstanceName() {
    const deviceName = await this.getDeviceName();
    return `${deviceName} / ${getOS()}`;
  }
  async getLocale() {
    const locale = await cache("ipc:getLocale", () => this.ipc.invoke("getLocale"), { ttl: 5 * 60 * 1e3 });
    return parseLocale(locale);
  }
  async ensureShortcutConfig(config) {
    return this.ipc.invoke("ensureShortcutConfig", JSON.stringify(config));
  }
  async ensureProxyConfig(config) {
    return this.ipc.invoke("ensureProxy", JSON.stringify(config));
  }
  async relaunch() {
    return this.ipc.invoke("relaunch");
  }
  async getConfig() {
    return this.ipc.invoke("getConfig");
  }
  async getSettings() {
    return this.ipc.invoke("getSettings");
  }
  needStoreInFile(key) {
    return key === "configs" || key === "settings" || key === "configVersion";
  }
  async setStoreValue(key, value) {
    let valueJson;
    try {
      valueJson = JSON.stringify(value);
    } catch (error) {
      throw new Error(`Failed to serialize value for key "${key}": ${error.message}`);
    }
    if (this.needStoreInFile(key)) {
      return this.ipc.invoke("setStoreValue", key, valueJson);
    } else {
      await store.setItem(key, valueJson);
    }
  }
  async getStoreValue(key) {
    if (this.needStoreInFile(key)) {
      return this.ipc.invoke("getStoreValue", key);
    } else {
      const json = await store.getItem(key);
      if (!json) return null;
      try {
        return JSON.parse(json);
      } catch (error) {
        console.error(`Failed to parse stored value for key "${key}":`, error);
        return null;
      }
    }
  }
  async delStoreValue(key) {
    if (this.needStoreInFile(key)) {
      return this.ipc.invoke("delStoreValue", key);
    } else {
      return await store.removeItem(key);
    }
  }
  async getAllStoreValues() {
    const ret = {};
    await store.iterate((json2, key) => {
      const value = typeof json2 === "string" ? JSON.parse(json2) : null;
      ret[key] = value;
    });
    const json = JSON.parse(await this.ipc.invoke("getAllStoreValues"));
    for (const [key, value] of Object.entries(json)) {
      if (this.needStoreInFile(key)) {
        ret[key] = value;
      }
    }
    return ret;
  }
  async getAllStoreKeys() {
    const keys = await store.keys();
    const ipcKeys = await this.ipc.invoke("getAllStoreKeys");
    return [...keys, ...ipcKeys];
  }
  async setAllStoreValues(data) {
    for (const [key, value] of Object.entries(data)) {
      await this.setStoreValue(key, value);
    }
  }
  async getStoreBlob(key) {
    return this.ipc.invoke("getStoreBlob", key);
  }
  async setStoreBlob(key, value) {
    return this.ipc.invoke("setStoreBlob", key, value);
  }
  async delStoreBlob(key) {
    return this.ipc.invoke("delStoreBlob", key);
  }
  async listStoreBlobKeys() {
    return this.ipc.invoke("listStoreBlobKeys");
  }
  initTracking() {
    setTimeout(() => {
      this.trackingEvent("user_engagement", {});
    }, 4e3);
  }
  trackingEvent(name, params) {
    const dataJson = JSON.stringify({ name, params });
    this.ipc.invoke("analysticTrackingEvent", dataJson);
  }
  async shouldShowAboutDialogWhenStartUp() {
    return cache("ipc:shouldShowAboutDialogWhenStartUp", () => this.ipc.invoke("shouldShowAboutDialogWhenStartUp"), {
      ttl: 30 * 1e3
    });
  }
  async appLog(level, message) {
    return this.ipc.invoke("appLog", JSON.stringify({ level, message }));
  }
  async exportLogs() {
    return this.ipc.invoke("exportLogs");
  }
  async clearLogs() {
    return this.ipc.invoke("clearLogs");
  }
  async ensureAutoLaunch(enable) {
    return this.ipc.invoke("ensureAutoLaunch", enable);
  }
  async parseFileLocally(file) {
    let result;
    if (!file.path) {
      result = await parseTextFileLocally(file);
    } else {
      const resultJSON = await this.ipc.invoke("parseFileLocally", JSON.stringify({ filePath: file.path }));
      result = JSON.parse(resultJSON);
    }
    if (!result.isSupported) {
      return { isSupported: false };
    }
    const key = `parseFile-` + v4();
    await this.setStoreBlob(key, result.text);
    return { key, isSupported: true };
  }
  async parseFileWithMineru(file, apiToken) {
    if (!file.path) {
      return { success: false, error: "File path is required for MinerU parsing" };
    }
    return this.ipc.invoke("parser:parse-file-with-mineru", {
      filePath: file.path,
      filename: file.name,
      mimeType: file.type,
      apiToken
    });
  }
  async cancelMineruParse(filePath) {
    return this.ipc.invoke("parser:cancel-mineru-parse", filePath);
  }
  async parseUrl(url) {
    const json = await this.ipc.invoke("parseUrl", url);
    return JSON.parse(json);
  }
  async isFullscreen() {
    return this.ipc.invoke("isFullscreen");
  }
  async setFullscreen(enabled) {
    return this.ipc.invoke("setFullscreen", enabled);
  }
  async installUpdate() {
    return this.ipc.invoke("install-update");
  }
  async switchTheme(theme) {
    return this.ipc.invoke("switch-theme", theme);
  }
  getKnowledgeBaseController() {
    if (!this._kbController) {
      this._kbController = new DesktopKnowledgeBaseController(this.ipc);
    }
    return this._kbController;
  }
  getImageGenerationStorage() {
    if (!this._imageGenerationStorage) {
      this._imageGenerationStorage = new IndexedDBImageGenerationStorage();
    }
    return this._imageGenerationStorage;
  }
  minimize() {
    return this.ipc.invoke("window:minimize");
  }
  maximize() {
    return this.ipc.invoke("window:maximize");
  }
  unmaximize() {
    return this.ipc.invoke("window:unmaximize");
  }
  closeWindow() {
    return this.ipc.invoke("window:close");
  }
  isMaximized() {
    return this.ipc.invoke("window:is-maximized");
  }
  onMaximizedChange(callback) {
    const unsubscribe = this.ipc.onWindowMaximizedChanged((_, isMaximized) => {
      callback(isMaximized);
    });
    return unsubscribe;
  }
}
function getWindowWithTauri() {
  return window;
}
function isTauriRuntime() {
  if (typeof window === "undefined") {
    return false;
  }
  const w = getWindowWithTauri();
  return Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__);
}
function listenEvent(eventName, callback) {
  let unlisten = null;
  let isDisposed = false;
  void listen(eventName, (event) => {
    if (!isDisposed) {
      callback(event.payload);
    }
  }).then((dispose) => {
    if (isDisposed) {
      dispose();
    } else {
      unlisten = dispose;
    }
  }).catch((err) => {
    console.error(`[tauri-ipc] subscribe failed: ${eventName}`, err);
  });
  return () => {
    isDisposed = true;
    unlisten?.();
    unlisten = null;
  };
}
function createTauriIPCAdapter() {
  return {
    invoke: (channel, ...args) => invoke("ipc_invoke", { channel, args }),
    onSystemThemeChange: (callback) => listenEvent("system-theme-updated", () => callback()),
    onWindowMaximizedChanged: (callback) => listenEvent("window:maximized-changed", (payload) => {
      callback(void 0, Boolean(payload));
    }),
    onWindowShow: (callback) => listenEvent("window-show", () => callback()),
    onWindowFocused: (callback) => listenEvent("window:focused", () => callback()),
    onUpdateDownloaded: (callback) => listenEvent("update-downloaded", () => callback()),
    addMcpStdioTransportEventListener: (transportId, event, callback) => {
      const eventName = `mcp:stdio-transport:${transportId}:${event}`;
      return listenEvent(eventName, (payload) => {
        if (Array.isArray(payload)) {
          callback?.(...payload);
          return;
        }
        callback?.(payload);
      });
    },
    onNavigate: (callback) => listenEvent("navigate-to", (payload) => {
      if (typeof payload === "string") {
        callback(payload);
      }
    })
  };
}
class InMemoryStorage {
  constructor() {
    this.store = /* @__PURE__ */ new Map();
  }
  getStorageType() {
    return "IN_MEMORY";
  }
  async setStoreValue(key, value) {
    this.store.set(key, JSON.parse(JSON.stringify(value)));
  }
  async getStoreValue(key) {
    const value = this.store.get(key);
    return value !== void 0 ? value : null;
  }
  async delStoreValue(key) {
    this.store.delete(key);
  }
  async getAllStoreValues() {
    const result = {};
    this.store.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  async getAllStoreKeys() {
    return Array.from(this.store.keys());
  }
  async setAllStoreValues(data) {
    for (const [key, value] of Object.entries(data)) {
      await this.setStoreValue(key, value);
    }
  }
  clear() {
    this.store.clear();
  }
}
class TestExporter {
  constructor() {
    this.exports = /* @__PURE__ */ new Map();
  }
  async exportBlob(filename, blob, encoding) {
    const text = await blob.text();
    this.exports.set(filename, text);
  }
  async exportTextFile(filename, content) {
    this.exports.set(filename, content);
  }
  async exportImageFile(basename, base64) {
    this.exports.set(basename, base64);
  }
  async exportByUrl(filename, url) {
    this.exports.set(filename, url);
  }
  async exportStreamingJson(filename, dataCallback) {
    let content = "";
    for await (const chunk of dataCallback()) {
      content += chunk;
    }
    this.exports.set(filename, content);
  }
  getExport(filename) {
    return this.exports.get(filename);
  }
  getAllExports() {
    return new Map(this.exports);
  }
  clear() {
    this.exports.clear();
  }
}
class TestPlatform {
  constructor() {
    this.type = "web";
    this.exporter = new TestExporter();
    this.storage = new InMemoryStorage();
    this.blobs = /* @__PURE__ */ new Map();
    this.configs = null;
    this.settings = null;
    this.configs = newConfigs();
    this.settings = settings();
  }
  // ============ Storage 接口实现 ============
  getStorageType() {
    return "IN_MEMORY_TEST";
  }
  async setStoreValue(key, value) {
    return this.storage.setStoreValue(key, value);
  }
  async getStoreValue(key) {
    return this.storage.getStoreValue(key);
  }
  async delStoreValue(key) {
    return this.storage.delStoreValue(key);
  }
  async getAllStoreValues() {
    return this.storage.getAllStoreValues();
  }
  async getAllStoreKeys() {
    return this.storage.getAllStoreKeys();
  }
  async setAllStoreValues(data) {
    return this.storage.setAllStoreValues(data);
  }
  // ============ Blob 存储实现 ============
  async getStoreBlob(key) {
    return this.blobs.get(key) ?? null;
  }
  async setStoreBlob(key, value) {
    this.blobs.set(key, value);
  }
  async delStoreBlob(key) {
    this.blobs.delete(key);
  }
  async listStoreBlobKeys() {
    return Array.from(this.blobs.keys());
  }
  // ============ 系统相关 ============
  async getVersion() {
    return "test";
  }
  async getPlatform() {
    return "test";
  }
  async getArch() {
    return "test";
  }
  async shouldUseDarkColors() {
    return false;
  }
  onSystemThemeChange(callback) {
    return () => {
    };
  }
  onWindowShow(callback) {
    return () => {
    };
  }
  onWindowFocused(callback) {
    return () => {
    };
  }
  onUpdateDownloaded(callback) {
    return () => {
    };
  }
  async openLink(url) {
  }
  async getDeviceName() {
    return "test-device";
  }
  async getInstanceName() {
    return "test-instance";
  }
  async getLocale() {
    return "en";
  }
  async ensureShortcutConfig(config) {
  }
  async ensureProxyConfig(config) {
  }
  async relaunch() {
  }
  // ============ 数据配置 ============
  async getConfig() {
    if (!this.configs) {
      this.configs = newConfigs();
    }
    return this.configs;
  }
  async getSettings() {
    if (!this.settings) {
      this.settings = settings();
    }
    return this.settings;
  }
  // ============ 追踪 ============
  initTracking() {
  }
  trackingEvent(name, params) {
  }
  // ============ 通知 ============
  async shouldShowAboutDialogWhenStartUp() {
    return false;
  }
  async appLog(level, message) {
    console.log(`[${level}] ${message}`);
  }
  async exportLogs() {
    return "";
  }
  async clearLogs() {
  }
  async ensureAutoLaunch(enable) {
  }
  async parseFileLocally(file) {
    try {
      const text = await file.text();
      const key = `parseFile-${v4()}`;
      await this.setStoreBlob(key, text);
      return { key, isSupported: true };
    } catch {
      return { isSupported: false };
    }
  }
  async isFullscreen() {
    return false;
  }
  async setFullscreen(enabled) {
  }
  async installUpdate() {
    throw new Error("Method not implemented in test platform.");
  }
  getKnowledgeBaseController() {
    throw new Error("Knowledge base not implemented in test platform.");
  }
  getImageGenerationStorage() {
    return new IndexedDBImageGenerationStorage();
  }
  async minimize() {
  }
  async maximize() {
  }
  async unmaximize() {
  }
  async closeWindow() {
  }
  async isMaximized() {
    return false;
  }
  onMaximizedChange(callback) {
    return () => {
    };
  }
  // ============ 测试辅助方法 ============
  /**
   * 加载文件内容到 blob 存储
   * @param storageKey 存储键名
   * @param content 文件内容
   */
  loadFile(storageKey, content) {
    this.blobs.set(storageKey, content);
  }
  /**
   * 批量加载文件
   * @param files 文件映射 { storageKey: content }
   */
  loadFiles(files) {
    for (const [key, content] of Object.entries(files)) {
      this.blobs.set(key, content);
    }
  }
  /**
   * 获取所有 blob 存储的内容
   */
  getAllBlobs() {
    const result = {};
    this.blobs.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  /**
   * 清空所有存储
   */
  clear() {
    this.storage.clear();
    this.blobs.clear();
    this.exporter.clear();
    this.configs = null;
    this.settings = null;
  }
  /**
   * 设置测试用的 settings
   */
  setSettings(settings$1) {
    this.settings = { ...settings(), ...settings$1 };
  }
  /**
   * 设置测试用的 config
   */
  setConfig(config) {
    this.configs = { ...newConfigs(), ...config };
  }
  /**
   * 获取内部存储实例
   */
  getInternalStorage() {
    return this.storage;
  }
}
new StoreStorage();
class IndexedDBStorage {
  constructor() {
    this.store = localforage.createInstance({ name: "chatboxstore" });
  }
  getStorageType() {
    return "INDEXEDDB";
  }
  async setStoreValue(key, value) {
    try {
      await this.store.setItem(key, JSON.stringify(value));
    } catch (error) {
      throw new Error(`Failed to store value for key "${key}": ${error.message}`);
    }
  }
  async getStoreValue(key) {
    const json = await this.store.getItem(key);
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch (error) {
      console.error(`Failed to parse stored value for key "${key}":`, error);
      return null;
    }
  }
  async delStoreValue(key) {
    return await this.store.removeItem(key);
  }
  async getAllStoreValues() {
    const ret = {};
    await this.store.iterate((json, key) => {
      if (typeof json === "string") {
        try {
          ret[key] = JSON.parse(json);
        } catch (error) {
          console.error(`Failed to parse value for key "${key}":`, error);
          ret[key] = null;
        }
      } else {
        ret[key] = null;
      }
    });
    return ret;
  }
  async getAllStoreKeys() {
    return this.store.keys();
  }
  async setAllStoreValues(data) {
    for (const [key, value] of Object.entries(data)) {
      await this.setStoreValue(key, value);
    }
  }
}
const LOG_STORAGE_KEY = "chatbox-app-logs";
const MAX_LOG_ENTRIES = 1e3;
const MAX_LOG_AGE_DAYS = 30;
class WebLogger {
  constructor() {
    this.logBuffer = [];
    this.flushTimer = null;
    this.isInitialized = false;
  }
  static getInstance() {
    if (!WebLogger.instance) {
      WebLogger.instance = new WebLogger();
    }
    return WebLogger.instance;
  }
  /**
   * 初始化日志系统
   */
  async init() {
    if (this.isInitialized) return;
    try {
      await this.cleanupOldLogs();
      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize web logger:", error);
    }
  }
  /**
   * 清理过期日志
   */
  async cleanupOldLogs() {
    try {
      const logs = await this.getStoredLogs();
      if (logs.length === 0) return;
      const cutoffDate = dayjs().subtract(MAX_LOG_AGE_DAYS, "day");
      const filteredLogs = logs.filter((log2) => {
        const logDate = dayjs(log2.timestamp);
        return logDate.isAfter(cutoffDate);
      });
      const trimmedLogs = filteredLogs.slice(-MAX_LOG_ENTRIES);
      if (trimmedLogs.length !== logs.length) {
        await localforage.setItem(LOG_STORAGE_KEY, trimmedLogs);
      }
    } catch (error) {
      console.error("Failed to cleanup old logs:", error);
    }
  }
  /**
   * 获取存储的日志
   */
  async getStoredLogs() {
    try {
      const logs = await localforage.getItem(LOG_STORAGE_KEY);
      return logs || [];
    } catch (error) {
      return [];
    }
  }
  /**
   * 记录日志
   */
  log(level, message) {
    const timestamp = dayjs().format("YYYY-MM-DD HH:mm:ss.SSS");
    console.log(`APP_LOG: [${level}] ${message}`);
    this.logBuffer.push({ timestamp, level: level.toUpperCase(), message });
    this.scheduleFlush();
  }
  /**
   * 调度批量写入
   */
  scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, 1e3);
  }
  /**
   * 将缓冲区内容写入存储
   */
  async flush() {
    this.flushTimer = null;
    if (this.logBuffer.length === 0) return;
    const newLogs = [...this.logBuffer];
    this.logBuffer = [];
    try {
      const existingLogs = await this.getStoredLogs();
      const allLogs = [...existingLogs, ...newLogs];
      const trimmedLogs = allLogs.slice(-MAX_LOG_ENTRIES);
      await localforage.setItem(LOG_STORAGE_KEY, trimmedLogs);
    } catch (error) {
      console.error("Failed to save logs:", error);
    }
  }
  /**
   * 立即刷新缓冲区
   */
  async flushNow() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
  /**
   * 导出日志内容
   * @returns 格式化的日志内容
   */
  async exportLogs() {
    await this.flushNow();
    try {
      const logs = await this.getStoredLogs();
      return logs.map((log2) => `[${log2.timestamp}] [${log2.level}] ${log2.message}`).join("\n");
    } catch (error) {
      console.error("Failed to export logs:", error);
      return "";
    }
  }
  /**
   * 清空日志
   */
  async clearLogs() {
    this.logBuffer = [];
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    try {
      await localforage.removeItem(LOG_STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear logs:", error);
    }
  }
}
const webLogger = WebLogger.getInstance();
class WebPlatform extends IndexedDBStorage {
  constructor() {
    super();
    this.type = "web";
    this.exporter = new WebExporter();
    this.imageGenerationStorage = null;
    webLogger.init().catch((e) => console.error("Failed to init web logger:", e));
  }
  async getVersion() {
    return "web";
  }
  async getPlatform() {
    return "web";
  }
  async getArch() {
    return "web";
  }
  async shouldUseDarkColors() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  onSystemThemeChange(callback) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", callback);
    return () => {
      window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", callback);
    };
  }
  onWindowShow(callback) {
    return () => null;
  }
  onWindowFocused(callback) {
    return () => null;
  }
  onUpdateDownloaded(callback) {
    return () => null;
  }
  async openLink(url) {
    window.open(url);
  }
  async getDeviceName() {
    return await Promise.resolve(getBrowser());
  }
  async getInstanceName() {
    return `${getOS()} / ${getBrowser()}`;
  }
  async getLocale() {
    const lang = window.navigator.language;
    return parseLocale(lang);
  }
  async ensureShortcutConfig(config) {
    return;
  }
  async ensureProxyConfig(config) {
    return;
  }
  async relaunch() {
    location.reload();
  }
  async getConfig() {
    let value = await this.getStoreValue("configs");
    if (value === void 0 || value === null) {
      value = newConfigs();
      await this.setStoreValue("configs", value);
    }
    return value;
  }
  async getSettings() {
    let value = await this.getStoreValue("settings");
    if (value === void 0 || value === null) {
      value = settings();
      await this.setStoreValue("settings", value);
    }
    return value;
  }
  async getStoreBlob(key) {
    return localforage.getItem(key);
  }
  async setStoreBlob(key, value) {
    await localforage.setItem(key, value);
  }
  async delStoreBlob(key) {
    return localforage.removeItem(key);
  }
  async listStoreBlobKeys() {
    return localforage.keys();
  }
  async initTracking() {
    const GAID = "G-B365F44W6E";
    try {
      const conf = await this.getConfig();
      window.gtag("config", GAID, {
        app_name: "chatbox",
        user_id: conf.uuid,
        client_id: conf.uuid,
        app_version: await this.getVersion(),
        chatbox_platform_type: "web",
        chatbox_platform: await this.getPlatform(),
        app_platform: await this.getPlatform()
      });
    } catch (e) {
      window.gtag("config", GAID, {
        app_name: "chatbox"
      });
      throw e;
    }
  }
  trackingEvent(name, params) {
    window.gtag("event", name, params);
  }
  async shouldShowAboutDialogWhenStartUp() {
    return false;
  }
  async appLog(level, message) {
    webLogger.log(level, message);
  }
  async exportLogs() {
    return webLogger.exportLogs();
  }
  async clearLogs() {
    return webLogger.clearLogs();
  }
  async ensureAutoLaunch(enable) {
    return;
  }
  async parseFileLocally(file) {
    const result = await parseTextFileLocally(file);
    if (!result.isSupported) {
      return { isSupported: false };
    }
    const key = `parseFile-` + v4();
    await this.setStoreBlob(key, result.text);
    return { key, isSupported: true };
  }
  async parseUrl(url) {
    throw new Error("Not implemented");
  }
  async isFullscreen() {
    return true;
  }
  async setFullscreen(enabled) {
    return;
  }
  installUpdate() {
    throw new Error("Method not implemented.");
  }
  getKnowledgeBaseController() {
    throw new Error("Method not implemented.");
  }
  getImageGenerationStorage() {
    if (!this.imageGenerationStorage) {
      this.imageGenerationStorage = new IndexedDBImageGenerationStorage();
    }
    return this.imageGenerationStorage;
  }
  minimize() {
    return Promise.resolve();
  }
  maximize() {
    return Promise.resolve();
  }
  unmaximize() {
    return Promise.resolve();
  }
  closeWindow() {
    return Promise.resolve();
  }
  isMaximized() {
    return Promise.resolve(true);
  }
  onMaximizedChange() {
    return () => null;
  }
}
var define_process_env_default = {};
function initPlatform() {
  if (define_process_env_default.NODE_ENV === "test") {
    return new TestPlatform();
  }
  if (typeof window !== "undefined") {
    if (window.desktopAPI) {
      return new DesktopPlatform(window.desktopAPI);
    }
    if (isTauriRuntime()) {
      const tauriIPC = createTauriIPCAdapter();
      window.desktopAPI = tauriIPC;
      return new DesktopPlatform(tauriIPC);
    }
  }
  return new WebPlatform();
}
const platform = initPlatform();
const initLogAtom = atom([]);
atom("");
function getLogger(logId) {
  return {
    log(level, ...args) {
      const store2 = getDefaultStore();
      const now = dayjs().format("HH:mm:ss.SSS");
      store2.set(initLogAtom, [...store2.get(initLogAtom), `[${now}][${logId}] ${args.join(" ")}`]);
      platform.appLog(level, args.join(" ")).catch((e) => {
        console.error("Failed to send log to desktop backend", e);
      });
    },
    info(...args) {
      this.log("info", ...args);
    },
    error(...args) {
      this.log("error", ...args);
    },
    debug(...args) {
      console.debug("debug", ...args);
    }
  };
}
const log = getLogger("base-storage");
class BaseStorage {
  constructor() {
  }
  getStorageType() {
    return platform.getStorageType();
  }
  async setItem(key, value) {
    return this.setItemNow(key, value);
  }
  async setItemNow(key, value) {
    try {
      if (key === "settings") {
        const valueObj = value;
        const providers = valueObj?.providers;
        const providersCount = providers && typeof providers === "object" && !Array.isArray(providers) ? Object.keys(providers).length : 0;
        if (providersCount === 0) {
          log.info(
            `[CONFIG_DEBUG] setItemNow settings with providersCount=0, stack=${new Error().stack?.split("\n").slice(1, 6).join(" <- ")}`
          );
        }
      }
      return await platform.setStoreValue(key, value);
    } catch (error) {
      log.error(`Failed to write to storage (key: ${key}):`, error);
      throw error;
    }
  }
  async getItem(key, initialValue) {
    try {
      let value = await platform.getStoreValue(key);
      if (value === void 0 || value === null) {
        value = initialValue;
        if (key === "settings") {
          log.info(`[CONFIG_DEBUG] getItem settings: value was null/undefined, using initialValue`);
        }
        this.setItemNow(key, value);
      } else if (key === "settings") {
        const providers = value?.providers;
        const providersCount = providers && typeof providers === "object" && !Array.isArray(providers) ? Object.keys(providers).length : 0;
        if (providersCount === 0) {
          log.info(`[CONFIG_DEBUG] getItem settings: read providersCount=0 from storage`);
        }
      }
      return value;
    } catch (error) {
      log.error(`Failed to read from storage (key: ${key}):`, error);
      throw error;
    }
  }
  async removeItem(key) {
    return platform.delStoreValue(key);
  }
  async getAll() {
    try {
      return await platform.getAllStoreValues();
    } catch (error) {
      log.error("Failed to read all values from storage:", error);
      throw error;
    }
  }
  async getAllKeys() {
    try {
      return await platform.getAllStoreKeys();
    } catch (error) {
      log.error("Failed to read all keys from storage:", error);
      throw error;
    }
  }
  async setAll(data) {
    return platform.setAllStoreValues(data);
  }
  // TODO: 这些数据也应该实现数据导出与导入
  async setBlob(key, value) {
    return platform.setStoreBlob(key, value);
  }
  async getBlob(key) {
    try {
      return await platform.getStoreBlob(key);
    } catch (error) {
      log.error(`Failed to read blob from storage (key: ${key}):`, error);
      throw error;
    }
  }
  async delBlob(key) {
    return platform.delStoreBlob(key);
  }
  async getBlobKeys() {
    return platform.listStoreBlobKeys();
  }
  // subscribe(key: string, callback: any, initialValue: any): Promise<void>
}
class StoreStorage extends BaseStorage {
  constructor() {
    super(...arguments);
    this.immediateKeys = /* @__PURE__ */ new Set([
      "settings",
      "configs",
      "configVersion"
      /* ConfigVersion */
    ]);
    this.debounceQueue = /* @__PURE__ */ new Map();
  }
  async getItem(key, initialValue) {
    const value = await super.getItem(key, initialValue);
    if (key === "configs" && value === initialValue) {
      await super.setItemNow(key, initialValue);
    }
    return value;
  }
  async setItem(key, value) {
    if (this.immediateKeys.has(key)) {
      await this.setItemNow(key, value);
      return;
    }
    let debounced = this.debounceQueue.get(key);
    if (!debounced) {
      debounced = debounce(this.setItemNow.bind(this), 500, { maxWait: 2e3 });
      this.debounceQueue.set(key, debounced);
    }
    debounced(key, value);
  }
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let prompt = "";
    let referenceImages = [];
    let generatedImages = [];
    let selectedProvider = ModelProviderEnum.OpenAI;
    let selectedModel = "";
    let selectedRatio = "auto";
    let showHistorySheet = false;
    let showModelSheet = false;
    let showRatioSheet = false;
    let isSubmitting = false;
    let isRetrying = false;
    const providers = derived(() => getAvailableProviders(settingsStore.settings, providerCatalogStore.systemProviders));
    const imageModelGroups = derived(() => getImageModelGroups(providers()));
    const hasImageProviders = derived(() => imageModelGroups().length > 0);
    const currentRecord = derived(() => imageGenerationStore.currentRecord);
    const isGenerating = derived(() => Boolean(imageGenerationStore.currentGeneratingId));
    const ratioOptions = derived(() => getRatioOptionsForModel(selectedModel));
    const modelDisplayName = derived(() => getModelDisplayName(providers()));
    function getImageModelGroups(providerList) {
      const groups = [];
      const geminiProvider = providerList.find((provider) => provider.id === ModelProviderEnum.Gemini);
      if (geminiProvider) {
        const models = getAvailableImageModels(geminiProvider, GEMINI_IMAGE_MODEL_IDS);
        if (models.length > 0) {
          groups.push({
            label: "Google Gemini",
            providerId: geminiProvider.id,
            models
          });
        }
      }
      for (const provider of providerList.filter((candidate) => candidate.isCustom && candidate.type === ModelProviderType.Gemini)) {
        const models = getAvailableImageModels(provider, GEMINI_IMAGE_MODEL_IDS);
        if (models.length > 0) {
          groups.push({ label: provider.name, providerId: provider.id, models });
        }
      }
      for (const provider of providerList.filter((candidate) => [ModelProviderEnum.OpenAI, ModelProviderEnum.Azure].includes(candidate.id))) {
        const models = getAvailableImageModels(provider, OPENAI_IMAGE_MODEL_IDS);
        if (models.length > 0) {
          groups.push({ label: provider.name, providerId: provider.id, models });
        }
      }
      return groups;
    }
    function getAvailableImageModels(provider, imageModelIds) {
      const providerModels = provider.models || provider.defaultSettings?.models || [];
      return imageModelIds.map((modelId) => {
        const model = providerModels.find((candidate) => candidate.modelId === modelId);
        if (!model) {
          return null;
        }
        return {
          modelId,
          displayName: model.nickname || IMAGE_MODEL_FALLBACK_NAMES[modelId] || modelId
        };
      }).filter((model) => model !== null);
    }
    function getModelDisplayName(providerList, providerId, modelId) {
      {
        return "Select model";
      }
    }
    async function loadReferenceImages(storageKeys) {
      const images = await Promise.all(storageKeys.map(async (storageKey) => {
        const dataUrl = await imageGenerationStore.getStoredImageDataUrl(storageKey);
        return dataUrl ? { storageKey, dataUrl } : null;
      }));
      referenceImages = images.filter((image) => image !== null);
    }
    async function handleHistorySelect(record) {
      await imageGenerationStore.selectRecord(record.id);
      prompt = record.prompt;
      await loadReferenceImages(record.referenceImages);
      showHistorySheet = false;
    }
    async function handleDeleteRecord(recordId) {
      await imageGenerationStore.deleteRecord(recordId);
    }
    $$renderer2.push(`<div class="image-page svelte-1ny9vvz"><div class="image-page-header svelte-1ny9vvz"><div class="page-copy svelte-1ny9vvz"><p class="page-kicker svelte-1ny9vvz">Image creator</p> <h1 class="svelte-1ny9vvz">Real generation workflow</h1> <p class="page-subtitle svelte-1ny9vvz">Create, retry, browse history, and reuse reference images without placeholder behavior.</p></div> <div class="page-actions svelte-1ny9vvz"><button class="header-action svelte-1ny9vvz" type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg> New</button> <button class="header-action svelte-1ny9vvz" type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"></path><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path></svg> History</button></div></div> <div class="image-shell svelte-1ny9vvz"><section class="image-main svelte-1ny9vvz"><div class="result-scroll svelte-1ny9vvz"><div class="result-column svelte-1ny9vvz">`);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (currentRecord()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="record-stack svelte-1ny9vvz">`);
      GeneratedImagesGallery($$renderer2, {
        images: generatedImages,
        generating: currentRecord().status === "generating" && generatedImages.length === 0
      });
      $$renderer2.push(`<!----> `);
      PromptDisplay($$renderer2, {
        prompt: currentRecord().prompt,
        modelLabel: modelDisplayName(),
        referenceImageCount: currentRecord().referenceImages.length,
        status: currentRecord().status
      });
      $$renderer2.push(`<!----> `);
      if (currentRecord().status === "error") {
        $$renderer2.push("<!--[0-->");
        ErrorCard($$renderer2, {
          error: currentRecord().error ?? "Generation failed.",
          retrying: isRetrying
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      EmptyState($$renderer2, {
        disabled: !hasImageProviders() || isGenerating() || isSubmitting
      });
    }
    $$renderer2.push(`<!--]--></div></div> <div class="composer-shell svelte-1ny9vvz"><div class="composer-column svelte-1ny9vvz">`);
    ReferenceImagesPreview($$renderer2, {
      images: referenceImages
    });
    $$renderer2.push(`<!----> <input type="file" class="file-input svelte-1ny9vvz" accept="image/*" multiple=""/> <div class="composer-card svelte-1ny9vvz"><div class="composer-row svelte-1ny9vvz"><textarea class="composer-textarea svelte-1ny9vvz" placeholder="Describe the image you want to create..."${attr("disabled", !hasImageProviders() || isGenerating() || isSubmitting, true)} rows="1">`);
    const $$body = escape_html(prompt);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea> <button${attr_class("send-button svelte-1ny9vvz", void 0, { "busy": isGenerating() })} type="button"${attr("disabled", !prompt.trim() || !hasImageProviders() || isGenerating() || isSubmitting, true)}>`);
    if (isGenerating()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="spinner svelte-1ny9vvz"></span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19 7-7-7-7"></path><path d="M5 12h14"></path></svg>`);
    }
    $$renderer2.push(`<!--]--></button></div> <div class="toolbar-row svelte-1ny9vvz"><div class="toolbar-group svelte-1ny9vvz"><div class="toolbar-menu svelte-1ny9vvz"><button type="button" class="toolbar-pill svelte-1ny9vvz"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.9 5.8H20l-4.9 3.6 1.9 5.8-4.9-3.6-4.9 3.6 1.9-5.8L4 8.8h6.1L12 3z"></path></svg> <span class="svelte-1ny9vvz">${escape_html(modelDisplayName())}</span> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg></button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="toolbar-menu svelte-1ny9vvz"><button type="button" class="toolbar-pill svelte-1ny9vvz"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect></svg> <span class="svelte-1ny9vvz">${escape_html(selectedRatio)}</span> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg></button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <button type="button" class="toolbar-pill svelte-1ny9vvz"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.2 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7.2"></path><path d="M16 3h5v5"></path><path d="m21 3-7 7"></path></svg> <span class="svelte-1ny9vvz">Upload</span></button></div> <button type="button" class="toolbar-pill subtle svelte-1ny9vvz"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg> <span class="svelte-1ny9vvz">New creation</span></button></div></div> <p class="composer-disclaimer disclaimer-safe-area svelte-1ny9vvz">AI-generated images may be inaccurate. Review output carefully before using it.</p></div></div></section> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<aside class="history-panel svelte-1ny9vvz"${attr_style(`width: ${HISTORY_PANEL_WIDTH}px;`)}><div class="history-header svelte-1ny9vvz"><div class="history-title svelte-1ny9vvz">History</div> <div class="history-header-actions svelte-1ny9vvz"><button type="button" class="history-header-btn svelte-1ny9vvz">New</button> <button type="button" class="history-header-btn svelte-1ny9vvz">Hide</button></div></div> `);
      HistoryList($$renderer2, {
        records: imageGenerationStore.history,
        currentRecordId: imageGenerationStore.currentRecordId,
        loading: imageGenerationStore.historyLoading,
        hasMore: imageGenerationStore.hasMoreHistory,
        loadingMore: imageGenerationStore.loadingMore,
        onSelect: (record) => void handleHistorySelect(record),
        onLoadMore: () => void imageGenerationStore.loadHistory(),
        onDelete: (recordId) => void handleDeleteRecord(recordId)
      });
      $$renderer2.push(`<!----></aside>`);
    }
    $$renderer2.push(`<!--]--></div></div> `);
    {
      let actions = function($$renderer3) {
        $$renderer3.push(`<button type="button" class="sheet-action svelte-1ny9vvz">New</button>`);
      };
      MobileSheet($$renderer2, {
        open: showHistorySheet,
        title: "History",
        onClose: () => showHistorySheet = false,
        actions,
        children: ($$renderer3) => {
          HistoryList($$renderer3, {
            records: imageGenerationStore.history,
            currentRecordId: imageGenerationStore.currentRecordId,
            loading: imageGenerationStore.historyLoading,
            hasMore: imageGenerationStore.hasMoreHistory,
            loadingMore: imageGenerationStore.loadingMore,
            mobile: true,
            onSelect: (record) => void handleHistorySelect(record),
            onLoadMore: () => void imageGenerationStore.loadHistory(),
            onDelete: (recordId) => void handleDeleteRecord(recordId)
          });
        }
      });
    }
    $$renderer2.push(`<!----> `);
    MobileSheet($$renderer2, {
      open: showModelSheet,
      title: "Select Model",
      onClose: () => showModelSheet = false,
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="sheet-option-list svelte-1ny9vvz"><!--[-->`);
        const each_array_3 = ensure_array_like(imageModelGroups());
        for (let $$index_4 = 0, $$length = each_array_3.length; $$index_4 < $$length; $$index_4++) {
          let group = each_array_3[$$index_4];
          $$renderer3.push(`<div class="sheet-option-group svelte-1ny9vvz"><div class="sheet-option-label svelte-1ny9vvz">${escape_html(group.label)}</div> <!--[-->`);
          const each_array_4 = ensure_array_like(group.models);
          for (let $$index_3 = 0, $$length2 = each_array_4.length; $$index_3 < $$length2; $$index_3++) {
            let model = each_array_4[$$index_3];
            $$renderer3.push(`<button type="button"${attr_class("sheet-option svelte-1ny9vvz", void 0, {
              "selected": selectedProvider === group.providerId && selectedModel === model.modelId
            })}>${escape_html(model.displayName)}</button>`);
          }
          $$renderer3.push(`<!--]--></div>`);
        }
        $$renderer3.push(`<!--]--></div>`);
      }
    });
    $$renderer2.push(`<!----> `);
    MobileSheet($$renderer2, {
      open: showRatioSheet,
      title: "Aspect Ratio",
      onClose: () => showRatioSheet = false,
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="sheet-option-list svelte-1ny9vvz"><!--[-->`);
        const each_array_5 = ensure_array_like(ratioOptions());
        for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
          let ratio = each_array_5[$$index_5];
          $$renderer3.push(`<button type="button"${attr_class("sheet-option svelte-1ny9vvz", void 0, { "selected": selectedRatio === ratio })}>${escape_html(ratio)}</button>`);
        }
        $$renderer3.push(`<!--]--></div>`);
      }
    });
    $$renderer2.push(`<!---->`);
  });
}
export {
  _page as default
};
