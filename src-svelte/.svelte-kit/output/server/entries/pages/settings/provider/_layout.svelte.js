import { e as escape_html, f as ensure_array_like, a as attr_class, c as attr_style, d as derived, g as store_get, u as unsubscribe_stores } from "../../../../chunks/index2.js";
import { p as page } from "../../../../chunks/stores.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { M as ModelProviderType } from "../../../../chunks/defaults.js";
/* empty css                                                          */
import { i as isProviderConfigured, g as getProviderBaseInfos } from "../../../../chunks/provider-settings.js";
import { p as providerCatalogStore } from "../../../../chunks/provider-catalog.svelte.js";
import { s as settingsStore } from "../../../../chunks/settings.svelte.js";
function ProviderList($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      providers = [],
      settings,
      selectedProviderId = null,
      mobile = false
    } = $$props;
    ModelProviderType.OpenAI;
    function getProviderTone(providerId) {
      const palette = [
        ["#0f766e", "#99f6e4"],
        ["#1d4ed8", "#bfdbfe"],
        ["#7c3aed", "#ddd6fe"],
        ["#b45309", "#fde68a"],
        ["#be123c", "#fecdd3"],
        ["#166534", "#bbf7d0"],
        ["#4338ca", "#c7d2fe"],
        ["#374151", "#d1d5db"]
      ];
      const index = providerId.split("").reduce((total, char) => total + char.charCodeAt(0), 0) % palette.length;
      return palette[index];
    }
    $$renderer2.push(`<section class="provider-list svelte-1shg4z7"><div class="provider-list-header svelte-1shg4z7"><div><p class="eyebrow svelte-1shg4z7">Provider Setup</p> <h2 class="svelte-1shg4z7">Providers</h2> <p class="copy svelte-1shg4z7">Built-ins and custom providers now write to the real settings store used by chat.</p></div> <button class="primary-btn svelte-1shg4z7" type="button">${escape_html("Add provider")}</button></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="provider-rows svelte-1shg4z7"><!--[-->`);
    const each_array = ensure_array_like(providers);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let provider = each_array[$$index];
      const configured = isProviderConfigured(provider, settings);
      const tone = getProviderTone(provider.id);
      $$renderer2.push(`<button${attr_class("provider-row svelte-1shg4z7", void 0, { "active": provider.id === selectedProviderId })} type="button"><div class="provider-avatar svelte-1shg4z7"${attr_style(`--provider-accent:${tone[0]}; --provider-tint:${tone[1]};`)}>${escape_html(provider.name.slice(0, 1).toUpperCase())}</div> <div class="provider-body svelte-1shg4z7"><div class="provider-headline svelte-1shg4z7"><span class="provider-name svelte-1shg4z7">${escape_html(provider.name)}</span> <span class="provider-kind svelte-1shg4z7">${escape_html(provider.isCustom ? "Custom" : "Built-in")}</span></div> <div class="provider-meta svelte-1shg4z7"><span${attr_class("status-pill svelte-1shg4z7", void 0, { "configured": configured })}>${escape_html(configured ? "Configured" : "Needs setup")}</span> `);
      if (provider.description) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="description svelte-1shg4z7">${escape_html(provider.description)}</span>`);
      } else if (provider.isCustom) {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`<span class="description svelte-1shg4z7">Editable OpenAI-style provider profile.</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<span class="description svelte-1shg4z7">${escape_html(provider.type)} transport</span>`);
      }
      $$renderer2.push(`<!--]--></div></div> `);
      if (mobile) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="row-chevron svelte-1shg4z7" aria-hidden="true">›</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></button>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="scope-note svelte-1shg4z7"><div class="scope-badge svelte-1shg4z7">Out of scope</div> <p class="svelte-1shg4z7">Import, deep-link setup, and capability testing stay hidden until their Svelte paths are genuinely complete.</p></div></section>`);
  });
}
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { children } = $$props;
    let compactLayout = false;
    const providers = derived(() => getProviderBaseInfos(settingsStore.settings, providerCatalogStore.systemProviders));
    const selectedProviderId = derived(() => store_get($$store_subs ??= {}, "$page", page).params.providerId ?? null);
    $$renderer2.push(`<div class="provider-layout svelte-1af9bsd">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<aside class="list-pane svelte-1af9bsd">`);
      ProviderList($$renderer2, {
        providers: providers(),
        settings: settingsStore.settings,
        selectedProviderId: selectedProviderId(),
        mobile: compactLayout
      });
      $$renderer2.push(`<!----></aside>`);
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<section class="detail-pane svelte-1af9bsd">`);
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
