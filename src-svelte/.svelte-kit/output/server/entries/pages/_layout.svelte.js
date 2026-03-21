import { a as attr_class, b as attr, e as escape_html, d as derived, s as stringify, c as attr_style, f as ensure_array_like, g as store_get, u as unsubscribe_stores } from "../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/root.js";
import "../../chunks/state.svelte.js";
import { p as page } from "../../chunks/stores.js";
import "clsx";
import "../../chunks/defaults.js";
import "localforage";
import { g as getSelectedModelLabel, a as getAvailableProviders } from "../../chunks/providers.js";
import { c as conversationStore } from "../../chunks/conversation.svelte.js";
import { p as providerCatalogStore } from "../../chunks/provider-catalog.svelte.js";
import { s as settingsStore } from "../../chunks/settings.svelte.js";
import { t as themeStore } from "../../chunks/theme.svelte.js";
import { u as uiStore } from "../../chunks/ui.svelte.js";
function WindowControls($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
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
    const selectedProviderName = derived(() => selected ? providers.find((provider) => provider.id === selected.provider)?.name || selected.provider : "Model");
    $$renderer2.push(`<div${attr_class(`model-selector ${stringify(className)}`, "svelte-zseknu")}><button class="selector-trigger svelte-zseknu" type="button"${attr("disabled", disabled || !providers.length, true)} aria-label="Select model"><span class="label-stack svelte-zseknu"><span class="provider-name svelte-zseknu">${escape_html(selectedProviderName())}</span> <span class="model-name svelte-zseknu">${escape_html(selectedLabel())}</span></span> <svg${attr_class("chevron svelte-zseknu", void 0, { "open": isOpen })} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg></button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function Header($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      providers = [],
      selectedModel = null,
      title = "New chat",
      subtitle = "Start a real conversation",
      sessionId = null,
      currentTheme = "light",
      showSidebarToggle = true,
      sidebarOpen = true,
      onRenameSession,
      class: className = ""
    } = $$props;
    const canRename = derived(() => Boolean(sessionId && onRenameSession));
    $$renderer2.push(`<header${attr_class(`header title-bar ${stringify(className)}`, "svelte-hv3zzy")}><div class="header-left svelte-hv3zzy">`);
    if (showSidebarToggle) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button class="icon-btn svelte-hv3zzy" type="button" title="Toggle Sidebar" aria-label="Toggle Sidebar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`);
      if (sidebarOpen) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<path d="M7 4v16"></path><path d="M11 7l-3 5 3 5"></path><path d="M18 7h-3"></path><path d="M18 12h-5"></path><path d="M18 17h-3"></path>`);
      }
      $$renderer2.push(`<!--]--></svg></button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    ModelSelector($$renderer2, { providers, selected: selectedModel });
    $$renderer2.push(`<!----></div> <div class="header-center svelte-hv3zzy">`);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="title-stack svelte-hv3zzy"><div class="title-eyebrow svelte-hv3zzy">${escape_html(sessionId ? "Conversation" : "New chat")}</div> <div class="title-text svelte-hv3zzy"${attr("title", title)}>${escape_html(title)}</div> <div class="title-subtitle svelte-hv3zzy"${attr("title", subtitle)}>${escape_html(subtitle)}</div></div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="header-right svelte-hv3zzy">`);
    if (canRename() && true) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button class="icon-btn svelte-hv3zzy" type="button" title="Rename conversation" aria-label="Rename conversation"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg></button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button class="icon-btn svelte-hv3zzy" type="button" title="Toggle Theme" aria-label="Toggle Theme">`);
    if (currentTheme === "dark") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`);
    }
    $$renderer2.push(`<!--]--></button> `);
    WindowControls($$renderer2);
    $$renderer2.push(`<!----></div></header>`);
  });
}
function Sidebar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let {
      sessions = [],
      currentSessionId = null,
      open = true,
      width = 280,
      onResizeSidebar,
      class: className = ""
    } = $$props;
    let isResizing = false;
    const pathname = derived(() => store_get($$store_subs ??= {}, "$page", page).url.pathname);
    const navItems = [
      {
        href: "/settings",
        label: "Settings",
        badge: null,
        icon: "settings"
      },
      {
        href: "/image-creator",
        label: "Image Creator",
        badge: null,
        icon: "image"
      },
      {
        href: "/about",
        label: "About",
        badge: "Partial",
        icon: "about"
      }
    ];
    $$renderer2.push(`<aside${attr_class(`sidebar ${stringify(className)}`, "svelte-6dohdz", { "collapsed": !open, "resizing": isResizing })}${attr_style(`width: ${open ? `${width}px` : "0px"};`)}><div class="sidebar-header svelte-6dohdz"><div class="brand svelte-6dohdz"><div class="brand-icon svelte-6dohdz"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></div> <div class="brand-copy svelte-6dohdz"><span class="brand-name svelte-6dohdz">Chaeboxi</span> <span class="brand-subtitle svelte-6dohdz">Svelte revamp shell</span></div></div> <button class="icon-btn svelte-6dohdz" type="button" title="Collapse Sidebar" aria-label="Collapse Sidebar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 19l-7-7 7-7"></path><path d="M21 12H4"></path></svg></button></div> <div class="primary-action svelte-6dohdz"><button class="action-btn-light svelte-6dohdz" type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg> New Chat</button></div> <div class="section-heading svelte-6dohdz"><span class="svelte-6dohdz">Conversations</span> <span class="section-count svelte-6dohdz">${escape_html(sessions.length)}</span></div> <div class="sessions-list svelte-6dohdz">`);
    if (sessions.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="empty-sessions svelte-6dohdz"><p class="empty-title svelte-6dohdz">No conversations yet</p> <p class="empty-copy svelte-6dohdz">Start from the real \`/\` route and new sessions will appear here.</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--[-->`);
      const each_array = ensure_array_like(sessions);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let session = each_array[$$index];
        $$renderer2.push(`<button${attr_class("session-item svelte-6dohdz", void 0, { "active": session.id === currentSessionId })} type="button"><svg class="session-icon svelte-6dohdz" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> <div class="session-info svelte-6dohdz"><span class="session-title svelte-6dohdz">${escape_html(session.name || "Untitled")}</span> <span class="session-subtitle svelte-6dohdz">${escape_html(session.id === currentSessionId ? "Current conversation" : "Open conversation")}</span></div></button>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div> <div class="sidebar-footer svelte-6dohdz"><div class="section-heading section-heading-footer svelte-6dohdz"><span class="svelte-6dohdz">Explore</span> <span class="section-tag svelte-6dohdz">Route status</span></div> <div class="nav-links svelte-6dohdz"><!--[-->`);
    const each_array_1 = ensure_array_like(navItems);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let item = each_array_1[$$index_1];
      $$renderer2.push(`<a${attr("href", item.href)}${attr_class("nav-item svelte-6dohdz", void 0, { "active": pathname() === item.href })}>`);
      if (item.icon === "settings") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`);
      } else if (item.icon === "image") {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="m21 15-5-5L5 21"></path></svg>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>`);
      }
      $$renderer2.push(`<!--]--> <span class="svelte-6dohdz">${escape_html(item.label)}</span> `);
      if (item.badge) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="nav-tag svelte-6dohdz">${escape_html(item.badge)}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></a>`);
    }
    $$renderer2.push(`<!--]--></div></div> `);
    if (onResizeSidebar) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="sidebar-resizer svelte-6dohdz" role="presentation"></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></aside>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { children } = $$props;
    const pathname = derived(() => store_get($$store_subs ??= {}, "$page", page).url.pathname);
    const currentSessionId = derived(() => pathname().startsWith("/session/") ? store_get($$store_subs ??= {}, "$page", page).params.id : null);
    const isChatRoute = derived(() => pathname() === "/" || pathname().startsWith("/session/"));
    const currentSession = derived(() => currentSessionId() && conversationStore.currentSession?.id === currentSessionId() ? conversationStore.currentSession : null);
    const providers = derived(() => getAvailableProviders(settingsStore.settings, providerCatalogStore.systemProviders));
    const selectedModel = derived(() => currentSessionId() && currentSession() ? currentSession()?.settings?.provider && currentSession()?.settings?.modelId ? {
      provider: currentSession().settings.provider,
      modelId: currentSession().settings.modelId
    } : null : conversationStore.draftChatModel);
    $$renderer2.push(`<div class="app-shell app-container svelte-12qhfyh">`);
    Sidebar($$renderer2, {
      open: uiStore.state.showSidebar,
      width: uiStore.state.sidebarWidth ?? 264,
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
        title: conversationStore.currentDisplayTitle,
        subtitle: conversationStore.currentDisplaySubtitle,
        sessionId: currentSessionId(),
        currentTheme: themeStore.resolvedTheme,
        sidebarOpen: uiStore.state.showSidebar,
        onRenameSession: (name) => currentSessionId() ? conversationStore.renameSession(currentSessionId(), name) : void 0
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
