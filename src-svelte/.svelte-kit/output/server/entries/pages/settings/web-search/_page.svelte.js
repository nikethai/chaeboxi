import { b as attr, d as derived } from "../../../../chunks/index2.js";
import { S as SelectMenu } from "../../../../chunks/SelectMenu.js";
import { s as settingsStore } from "../../../../chunks/settings.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const providerOptions = [
      {
        value: "bing",
        label: "Bing Search",
        hint: "Free built-in search path"
      },
      {
        value: "duckduckgo",
        label: "DuckDuckGo Search",
        hint: "Free built-in search path"
      },
      {
        value: "serper",
        label: "Serper",
        hint: "Google Search API wrapper"
      },
      {
        value: "google",
        label: "Google Custom Search",
        hint: "Google programmable search"
      },
      {
        value: "tavily",
        label: "Tavily",
        hint: "Dedicated search API"
      }
    ];
    const webSearch = derived(() => settingsStore.settings.extension.webSearch);
    function updateWebSearch(patch) {
      settingsStore.update({
        extension: {
          ...settingsStore.settings.extension,
          webSearch: { ...settingsStore.settings.extension.webSearch, ...patch }
        }
      });
    }
    $$renderer2.push(`<section class="settings-page svelte-yt8zq0"><header class="page-header svelte-yt8zq0"><p class="eyebrow svelte-yt8zq0">Web Search</p> <h1 class="svelte-yt8zq0">Search provider configuration</h1> <p class="svelte-yt8zq0">Keep this route limited to the real persisted web-search settings path. No fake connection tests.</p></header> <section class="card svelte-yt8zq0"><div class="card-header svelte-yt8zq0"><h2 class="svelte-yt8zq0">Search backend</h2> <p class="svelte-yt8zq0">Choose the provider used for web-enabled chat flows.</p></div> <label class="field svelte-yt8zq0"><span class="svelte-yt8zq0">Search provider</span> `);
    SelectMenu($$renderer2, {
      options: providerOptions,
      value: webSearch().provider === "build-in" ? "bing" : webSearch().provider,
      onChange: (value) => updateWebSearch({ provider: value })
    });
    $$renderer2.push(`<!----></label> `);
    if (webSearch().provider === "bing") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="note svelte-yt8zq0">Bing remains the default built-in option in the current Svelte shell.</p>`);
    } else if (webSearch().provider === "duckduckgo") {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<p class="note svelte-yt8zq0">DuckDuckGo uses the existing built-in path and may be rate-limited by region.</p>`);
    } else if (webSearch().provider === "serper") {
      $$renderer2.push("<!--[2-->");
      $$renderer2.push(`<div class="field-stack svelte-yt8zq0"><label class="field svelte-yt8zq0"><span class="svelte-yt8zq0">Serper API key</span> <input type="password"${attr("value", webSearch().serperApiKey ?? "")} class="svelte-yt8zq0"/></label> <p class="note svelte-yt8zq0">Only the real stored credential field is exposed in this pass.</p></div>`);
    } else if (webSearch().provider === "google") {
      $$renderer2.push("<!--[3-->");
      $$renderer2.push(`<div class="field-stack svelte-yt8zq0"><label class="field svelte-yt8zq0"><span class="svelte-yt8zq0">Google API key</span> <input type="password"${attr("value", webSearch().googleApiKey ?? "")} class="svelte-yt8zq0"/></label> <label class="field svelte-yt8zq0"><span class="svelte-yt8zq0">Search engine ID (cx)</span> <input type="text"${attr("value", webSearch().googleCseId ?? "")} class="svelte-yt8zq0"/></label></div>`);
    } else if (webSearch().provider === "tavily") {
      $$renderer2.push("<!--[4-->");
      $$renderer2.push(`<div class="field-stack svelte-yt8zq0"><label class="field svelte-yt8zq0"><span class="svelte-yt8zq0">Tavily API key</span> <input type="password"${attr("value", webSearch().tavilyApiKey ?? "")} class="svelte-yt8zq0"/></label> <p class="note svelte-yt8zq0">Depth, result limits, and capability testing stay out of scope for this pass.</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></section></section>`);
  });
}
export {
  _page as default
};
