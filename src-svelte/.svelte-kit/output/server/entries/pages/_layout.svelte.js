import { a as attr_class, e as escape_html, d as derived, s as stringify, b as ensure_array_like, c as store_get, u as unsubscribe_stores } from "../../chunks/index2.js";
import { p as page } from "../../chunks/stores.js";
import "clsx";
import { t as themeStore } from "../../chunks/theme.svelte.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/root.js";
import "../../chunks/state.svelte.js";
class UIStore {
  state = {
    toasts: [],
    showSidebar: true,
    openSearchDialog: false,
    openAboutDialog: false,
    widthFull: false,
    showCopilotsInNewSession: false,
    sidebarWidth: null,
    realTheme: "light"
  };
  constructor() {
  }
  save() {
  }
  // Toast management
  addToast(content, duration = 3e3) {
    const id = `toast:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    this.state.toasts = [...this.state.toasts, { id, content, duration }];
    if (duration > 0) {
      setTimeout(() => this.removeToast(id), duration);
    }
  }
  removeToast(id) {
    this.state.toasts = this.state.toasts.filter((t) => t.id !== id);
  }
  // Sidebar
  setShowSidebar(show) {
    this.state.showSidebar = show;
  }
  toggleSidebar() {
    this.state.showSidebar = !this.state.showSidebar;
  }
  // Search dialog
  setOpenSearchDialog(open) {
    this.state.openSearchDialog = open;
  }
  // About dialog
  setOpenAboutDialog(open) {
    this.state.openAboutDialog = open;
  }
  // Width
  setWidthFull(full) {
    this.state.widthFull = full;
    this.save();
  }
  // Copilots
  setShowCopilotsInNewSession(show) {
    this.state.showCopilotsInNewSession = show;
    this.save();
  }
  // Sidebar width
  setSidebarWidth(width) {
    this.state.sidebarWidth = width;
    this.save();
  }
  // Theme
  setRealTheme(theme) {
    this.state.realTheme = theme;
  }
}
const uiStore = new UIStore();
function Header($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      title = "Chaeboxi",
      showSidebarToggle = true,
      class: className = ""
    } = $$props;
    const currentTheme = derived(() => themeStore.resolvedTheme);
    $$renderer2.push(`<header${attr_class(`header ${stringify(className)}`, "svelte-hv3zzy")}><div class="header-left svelte-hv3zzy">`);
    if (showSidebarToggle) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button class="icon-btn svelte-hv3zzy" title="Toggle Sidebar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"></path></svg></button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <h1 class="title svelte-hv3zzy">${escape_html(title)}</h1></div> <div class="header-right svelte-hv3zzy"><button class="icon-btn svelte-hv3zzy" title="Toggle Theme">`);
    if (currentTheme() === "dark") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path></svg>`);
    }
    $$renderer2.push(`<!--]--></button></div></header>`);
  });
}
function Sidebar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      sessions = [],
      currentSessionId = null,
      class: className = ""
    } = $$props;
    const showSidebar = derived(() => uiStore.state.showSidebar);
    function formatDate(timestamp) {
      const date = new Date(timestamp);
      const now = /* @__PURE__ */ new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1e3 * 60 * 60 * 24));
      if (days === 0) return "Today";
      if (days === 1) return "Yesterday";
      if (days < 7) return `${days} days ago`;
      return date.toLocaleDateString();
    }
    $$renderer2.push(`<aside${attr_class(`sidebar ${stringify(className)}`, "svelte-6dohdz", { "collapsed": !showSidebar() })}><div class="sidebar-header svelte-6dohdz"><h2 class="svelte-6dohdz">Chats</h2> <button class="new-chat-btn svelte-6dohdz" title="New Chat"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg></button></div> <div class="nav-links svelte-6dohdz"><a href="/" class="nav-item svelte-6dohdz"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path><polyline points="9,22 9,12 15,12 15,22"></polyline></svg> <span>Home</span></a> <a href="/settings" class="nav-item svelte-6dohdz"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path></svg> <span>Settings</span></a></div> <div class="sessions-list svelte-6dohdz">`);
    if (sessions.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="empty-sessions svelte-6dohdz"><p class="svelte-6dohdz">No chats yet</p> <button class="svelte-6dohdz">Start a conversation</button></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--[-->`);
      const each_array = ensure_array_like(sessions);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let session = each_array[$$index];
        $$renderer2.push(`<button${attr_class("session-item svelte-6dohdz", void 0, { "active": session.id === currentSessionId })}><span class="session-icon svelte-6dohdz">💬</span> <div class="session-info svelte-6dohdz"><span class="session-title svelte-6dohdz">${escape_html(session.title || "New Chat")}</span> <span class="session-date svelte-6dohdz">${escape_html(formatDate(session.updatedAt))}</span></div></button>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div></aside>`);
  });
}
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { children } = $$props;
    const showSidebar = derived(() => uiStore.state.showSidebar);
    $$renderer2.push(`<div class="app-container svelte-12qhfyh">`);
    if (store_get($$store_subs ??= {}, "$page", page).url.pathname !== "/settings") {
      $$renderer2.push("<!--[0-->");
      Sidebar($$renderer2, {});
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div${attr_class("main-content svelte-12qhfyh", void 0, {
      "sidebar-open": showSidebar() && store_get($$store_subs ??= {}, "$page", page).url.pathname !== "/settings"
    })}>`);
    Header($$renderer2, {});
    $$renderer2.push(`<!----> <main class="page-content svelte-12qhfyh">`);
    children($$renderer2);
    $$renderer2.push(`<!----></main></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _layout as default
};
