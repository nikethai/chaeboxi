import "clsx";
const defaultSettings = {
  theme: "system",
  language: "en",
  fontSize: 14,
  showWordCount: false,
  showTokenCount: false,
  showTokenUsed: true,
  showModelName: true,
  showMessageTimestamp: false,
  showFirstTokenLatency: false,
  userAvatarKey: "",
  defaultAssistantAvatarKey: "",
  defaultPrompt: "You are a helpful assistant.",
  allowReportingAndTracking: true,
  enableMarkdownRendering: true,
  enableLaTeXRendering: true,
  enableMermaidRendering: true,
  injectDefaultMetadata: true,
  autoPreviewArtifacts: false,
  autoCollapseCodeBlock: true,
  pasteLongTextAsAFile: true,
  autoGenerateTitle: true,
  autoCompaction: true,
  compactionThreshold: 0.6,
  autoLaunch: false,
  autoUpdate: true,
  betaUpdate: false,
  spellCheck: true,
  shortcuts: {
    quickToggle: "Alt+`",
    inputBoxFocus: "mod+i",
    inputBoxWebBrowsingMode: "mod+e",
    newChat: "mod+n",
    newPictureChat: "mod+shift+n",
    sessionListNavNext: "mod+tab",
    sessionListNavPrev: "mod+shift+tab",
    sessionListNavTargetIndex: "mod",
    messageListRefreshContext: "mod+r",
    dialogOpenSearch: "mod+k",
    inputBoxSendMessage: "Enter",
    inputBoxSendMessageWithoutResponse: "Ctrl+Enter",
    optionNavUp: "up",
    optionNavDown: "down",
    optionSelect: "enter"
  },
  extension: {
    webSearch: {
      provider: "bing",
      serperApiKey: "",
      googleApiKey: "",
      googleCseId: "",
      tavilyApiKey: ""
    },
    knowledgeBase: { models: { embedding: void 0, rerank: void 0 } },
    historySync: {
      enabled: false,
      endpoint: "",
      token: "",
      autoSync: false,
      intervalSeconds: 60
    },
    documentParser: { type: "local" }
  },
  mcp: { servers: [], enabledBuiltinServers: [] }
};
class SettingsStore {
  settings = defaultSettings;
  initialized = false;
  constructor() {
  }
  load() {
    const saved = localStorage.getItem("settings");
    if (saved) {
      try {
        this.settings = { ...defaultSettings, ...JSON.parse(saved) };
      } catch (e) {
        console.error("Failed to parse settings:", e);
      }
    }
    this.initialized = true;
  }
  save() {
  }
  update(partial) {
    this.settings = { ...this.settings, ...partial };
    this.save();
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
