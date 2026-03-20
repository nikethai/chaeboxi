import "clsx";
class UIStore {
  state = {
    showSidebar: true,
    widthFull: false,
    showCopilotsInNewSession: false,
    sidebarWidth: null,
    realTheme: "light",
    sessionWebBrowsingMap: {},
    newSessionState: {}
  };
  initialized = false;
  rendererModule = null;
  initializing = null;
  unsubscribeRenderer = null;
  constructor() {
  }
  syncFromRenderer() {
    if (!this.rendererModule) {
      return;
    }
    const state = this.rendererModule.uiStore.getState();
    this.state.showSidebar = state.showSidebar;
    this.state.widthFull = state.widthFull;
    this.state.showCopilotsInNewSession = state.showCopilotsInNewSession;
    this.state.sidebarWidth = state.sidebarWidth;
    this.state.realTheme = state.realTheme;
    this.state.sessionWebBrowsingMap = { ...state.sessionWebBrowsingMap };
    this.state.newSessionState = { ...state.newSessionState };
    this.initialized = true;
  }
  async init() {
    {
      return this.state;
    }
  }
  setShowSidebar(showSidebar) {
    if (this.rendererModule) {
      this.rendererModule.uiStore.getState().setShowSidebar(showSidebar);
      return;
    }
    this.state.showSidebar = showSidebar;
  }
  toggleSidebar() {
    this.setShowSidebar(!this.state.showSidebar);
  }
  setWidthFull(widthFull) {
    if (this.rendererModule) {
      this.rendererModule.uiStore.getState().setWidthFull(widthFull);
      return;
    }
    this.state.widthFull = widthFull;
  }
  setShowCopilotsInNewSession(show) {
    if (this.rendererModule) {
      this.rendererModule.uiStore.getState().setShowCopilotsInNewSession(show);
      return;
    }
    this.state.showCopilotsInNewSession = show;
  }
  setSidebarWidth(width) {
    if (this.rendererModule) {
      this.rendererModule.uiStore.getState().setSidebarWidth(width);
      return;
    }
    this.state.sidebarWidth = width;
  }
  setRealTheme(theme) {
    if (this.rendererModule) {
      this.rendererModule.uiStore.setState({ realTheme: theme });
    }
    this.state.realTheme = theme;
  }
}
const uiStore = new UIStore();
export {
  uiStore as u
};
