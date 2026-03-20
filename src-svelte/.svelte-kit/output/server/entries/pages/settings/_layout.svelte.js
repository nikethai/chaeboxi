import { f as ensure_array_like, b as attr, a as attr_class, e as escape_html, d as derived, g as store_get, u as unsubscribe_stores } from "../../../chunks/index2.js";
import { p as page } from "../../../chunks/stores.js";
import { p as platform } from "../../../chunks/index3.js";
import "../../../chunks/defaults.js";
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { children } = $$props;
    const pathname = derived(() => store_get($$store_subs ??= {}, "$page", page).url.pathname);
    const navItems = derived(() => {
      const items = [
        {
          key: "provider",
          href: "/settings/provider",
          label: "Model Provider",
          description: "Credentials, endpoints, model lists, and custom providers."
        },
        {
          key: "default-models",
          href: "/settings/default-models",
          label: "Default Models",
          description: "Pick the default chat, title, search, and OCR models."
        },
        {
          key: "web-search",
          href: "/settings/web-search",
          label: "Web Search",
          description: "Select the search backend and persist provider credentials."
        },
        {
          key: "document-parser",
          href: "/settings/document-parser",
          label: "Document Parser",
          description: "Still partial in Svelte.",
          badge: "Partial"
        },
        {
          key: "chat",
          href: "/settings/chat",
          label: "Chat Settings",
          description: "Conversation defaults, rendering, and context behavior."
        },
        {
          key: "general",
          href: "/settings/general",
          label: "General Settings",
          description: "Theme, language, font size, startup, proxy, and reporting."
        }
      ];
      if (platform.type === "desktop") {
        items.splice(3, 0, {
          key: "mcp",
          href: "/settings/mcp",
          label: "MCP",
          description: "Still partial in Svelte.",
          badge: "Partial"
        });
        items.splice(4, 0, {
          key: "knowledge-base",
          href: "/settings/knowledge-base",
          label: "Knowledge Base",
          description: "Still partial in Svelte.",
          badge: "Partial"
        });
        items.splice(items.length - 1, 0, {
          key: "hotkeys",
          href: "/settings/hotkeys",
          label: "Keyboard Shortcuts",
          description: "Still partial in Svelte.",
          badge: "Partial"
        });
      }
      return items;
    });
    function isActive(item) {
      return pathname() === item.href || pathname().startsWith(`${item.href}/`);
    }
    $$renderer2.push(`<div class="settings-layout svelte-15zgomd">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<aside class="settings-nav-pane svelte-15zgomd"><div class="settings-nav-header svelte-15zgomd"><p class="eyebrow svelte-15zgomd">Settings</p> <h1 class="svelte-15zgomd">Core settings now live in the Svelte shell.</h1> <p class="svelte-15zgomd">Provider, general, chat, default-model, and web-search settings now use the real shared store. Remaining areas stay
					explicitly partial until they are actually ported.</p></div> <nav class="settings-nav svelte-15zgomd"><!--[-->`);
      const each_array = ensure_array_like(navItems());
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let item = each_array[$$index];
        $$renderer2.push(`<a${attr("href", item.href)}${attr_class("settings-nav-item svelte-15zgomd", void 0, { "active": isActive(item) })}><div class="item-copy svelte-15zgomd"><div class="item-title-row svelte-15zgomd"><span class="item-title svelte-15zgomd">${escape_html(item.label)}</span> `);
        if (item.badge) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="item-badge svelte-15zgomd">${escape_html(item.badge)}</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> <p class="svelte-15zgomd">${escape_html(item.description)}</p></div> <span class="item-chevron svelte-15zgomd" aria-hidden="true">›</span></a>`);
      }
      $$renderer2.push(`<!--]--></nav></aside>`);
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<section class="settings-detail-pane svelte-15zgomd">`);
      children($$renderer2);
      $$renderer2.push(`<!----></section>`);
    }
    $$renderer2.push(`<!--]--></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _layout as default
};
