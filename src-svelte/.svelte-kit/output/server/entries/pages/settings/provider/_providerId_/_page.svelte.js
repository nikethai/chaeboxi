import { e as escape_html, b as attr, f as ensure_array_like, d as derived, g as store_get, u as unsubscribe_stores } from "../../../../../chunks/index2.js";
import { p as page } from "../../../../../chunks/stores.js";
import "@sveltejs/kit/internal";
import "../../../../../chunks/exports.js";
import "../../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../../chunks/root.js";
import "../../../../../chunks/state.svelte.js";
import { a as ModelProviderEnum, M as ModelProviderType } from "../../../../../chunks/defaults.js";
import { p as providerCatalogStore } from "../../../../../chunks/provider-catalog.svelte.js";
import { u as updateCustomProvider, a as getProviderBaseInfo, b as getProviderSettings, c as getProviderModels } from "../../../../../chunks/provider-settings.js";
import { s as settingsStore } from "../../../../../chunks/settings.svelte.js";
import { S as SelectMenu } from "../../../../../chunks/SelectMenu.js";
function normalizeOpenAIApiHostAndPath(options, defaults) {
  let { apiHost, apiPath } = options;
  if (apiHost) {
    apiHost = apiHost.trim();
  }
  if (apiPath) {
    apiPath = apiPath.trim();
  }
  const DEFAULT_HOST = defaults?.apiHost ?? "https://api.openai.com/v1";
  const DEFAULT_PATH = defaults?.apiPath ?? "/chat/completions";
  if (!apiHost) {
    apiHost = DEFAULT_HOST;
    apiPath = DEFAULT_PATH;
    return { apiHost, apiPath };
  }
  if (apiHost.endsWith("/")) {
    apiHost = apiHost.slice(0, -1);
  }
  if (apiPath && !apiPath.startsWith("/")) {
    apiPath = "/" + apiPath;
  }
  if (apiHost && !apiHost.startsWith("http://") && !apiHost.startsWith("https://")) {
    apiHost = "https://" + apiHost;
  }
  if (apiHost.endsWith(DEFAULT_PATH)) {
    apiHost = apiHost.replace(DEFAULT_PATH, "");
    apiPath = DEFAULT_PATH;
  }
  if (apiHost.endsWith("://api.openai.com") || apiHost.endsWith("://api.openai.com/v1")) {
    apiHost = DEFAULT_HOST;
    apiPath = DEFAULT_PATH;
    return { apiHost, apiPath };
  }
  if (apiHost.endsWith("://openrouter.ai") || apiHost.endsWith("://openrouter.ai/api")) {
    apiHost = "https://openrouter.ai/api/v1";
    apiPath = DEFAULT_PATH;
    return { apiHost, apiPath };
  }
  if (apiHost.endsWith("://api.x.com") || apiHost.endsWith("://api.x.com/v1")) {
    apiHost = "https://api.x.com/v1";
    apiPath = DEFAULT_PATH;
    return { apiHost, apiPath };
  }
  if (!apiHost.endsWith("/v1") && !apiPath) {
    apiHost = apiHost + "/v1";
    apiPath = DEFAULT_PATH;
  }
  if (!apiPath) {
    apiPath = DEFAULT_PATH;
  }
  return { apiHost, apiPath };
}
function normalizeOpenAIResponsesHostAndPath(options) {
  const trimmedApiPath = options.apiPath?.trim();
  const hasCustomApiPath = !!trimmedApiPath && trimmedApiPath !== "/responses";
  const normalized = normalizeOpenAIApiHostAndPath(
    hasCustomApiPath ? { ...options, apiPath: trimmedApiPath } : { ...options, apiPath: void 0 },
    { apiPath: "/responses" }
  );
  if (!hasCustomApiPath) {
    normalized.apiPath = "/responses";
  }
  return normalized;
}
function normalizeClaudeHost(apiHost) {
  apiHost = apiHost.trim();
  if (apiHost === "https://api.anthropic.com") {
    apiHost = `${apiHost}/v1`;
  }
  if (apiHost.endsWith("/")) {
    apiHost = apiHost.slice(0, apiHost.length - 1);
  }
  return {
    apiHost,
    apiPath: "/messages"
  };
}
function normalizeGeminiHost(apiHost) {
  apiHost = apiHost.trim();
  if (apiHost.endsWith("/")) {
    apiHost = apiHost.slice(0, apiHost.length - 1);
  }
  apiHost = `${apiHost}/v1beta`;
  return {
    apiHost,
    apiPath: "/models/[model]"
  };
}
function normalizeAzureEndpoint(endpoint) {
  let origin = endpoint;
  try {
    origin = new URL(endpoint.trim()).origin;
  } catch (_error) {
    origin = `https://${origin}.openai.azure.com`;
  }
  return {
    endpoint: `${origin}/openai`,
    apiPath: "/chat/completions"
  };
}
function formatNumber(num, unit = "") {
  if (num === 0) return `0${unit ? ` ${unit}` : ""}`;
  if (num >= 1e6) {
    return `${(num / 1e6).toFixed(1)}M${unit ? ` ${unit}` : ""}`;
  }
  if (num >= 1e3) {
    return `${(num / 1e3).toFixed(0)}K${unit ? ` ${unit}` : ""}`;
  }
  return `${num}${unit ? ` ${unit}` : ""}`;
}
function ProviderEditor($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const hostConfigProviderIds = /* @__PURE__ */ new Set([
      ModelProviderEnum.OpenAI,
      ModelProviderEnum.OpenAIResponses,
      ModelProviderEnum.Claude,
      ModelProviderEnum.Gemini,
      ModelProviderEnum.Ollama,
      ModelProviderEnum.LMStudio
    ]);
    const localProviderIds = /* @__PURE__ */ new Set([ModelProviderEnum.Ollama, ModelProviderEnum.LMStudio]);
    let { providerId } = $$props;
    const baseInfo = derived(() => getProviderBaseInfo(settingsStore.settings, providerCatalogStore.systemProviders, providerId));
    const providerSettings = derived(() => getProviderSettings(settingsStore.settings, providerId));
    const models = derived(() => baseInfo() ? getProviderModels(baseInfo(), providerSettings()) : []);
    const requiresApiKey = derived(() => baseInfo() ? !localProviderIds.has(baseInfo().id) : false);
    const showsCloudflareFields = derived(() => baseInfo() ? !localProviderIds.has(baseInfo().id) : false);
    const showsGenericHost = derived(() => baseInfo() ? hostConfigProviderIds.has(baseInfo().id) : false);
    const showsCustomHostPath = derived(() => Boolean(baseInfo()?.isCustom));
    const allowsProxySwitch = derived(() => baseInfo() ? baseInfo().isCustom || baseInfo().id === ModelProviderEnum.Ollama : false);
    const isAzureProvider = derived(() => baseInfo()?.id === ModelProviderEnum.Azure);
    const resolvedEndpointPreview = derived(() => baseInfo() ? getResolvedEndpointPreview(baseInfo(), providerSettings()) : "");
    function getResolvedEndpointPreview(baseInfo2, settings) {
      if (baseInfo2.isCustom) {
        return getNormalizedCustomEndpoint(baseInfo2.type, settings);
      }
      if (baseInfo2.id === ModelProviderEnum.Azure) {
        const endpoint = String(settings?.endpoint ?? baseInfo2.defaultSettings?.endpoint ?? "");
        const normalized2 = normalizeAzureEndpoint(endpoint);
        return `${normalized2.endpoint}${normalized2.apiPath}`;
      }
      const apiHost = String(settings?.apiHost ?? baseInfo2.defaultSettings?.apiHost ?? "");
      const apiPath = String(settings?.apiPath ?? baseInfo2.defaultSettings?.apiPath ?? "");
      if (baseInfo2.id === ModelProviderEnum.OpenAIResponses) {
        const normalized2 = normalizeOpenAIResponsesHostAndPath({ apiHost, apiPath });
        return `${normalized2.apiHost}${normalized2.apiPath}`;
      }
      if (baseInfo2.id === ModelProviderEnum.Claude) {
        const normalized2 = normalizeClaudeHost(apiHost);
        return `${normalized2.apiHost}${normalized2.apiPath}`;
      }
      if (baseInfo2.id === ModelProviderEnum.Gemini) {
        const normalized2 = normalizeGeminiHost(apiHost);
        return `${normalized2.apiHost}${normalized2.apiPath}`;
      }
      const normalized = normalizeOpenAIApiHostAndPath({ apiHost, apiPath });
      return `${normalized.apiHost}${normalized.apiPath}`;
    }
    function getNormalizedCustomEndpoint(type, settings) {
      const apiHost = settings?.apiHost ?? "";
      const apiPath = settings?.apiPath ?? "";
      switch (type) {
        case ModelProviderType.Claude: {
          const normalized = normalizeClaudeHost(apiHost);
          return `${normalized.apiHost}${apiPath || normalized.apiPath}`;
        }
        case ModelProviderType.Gemini: {
          const normalized = normalizeGeminiHost(apiHost);
          return `${normalized.apiHost}${apiPath || normalized.apiPath}`;
        }
        case ModelProviderType.OpenAIResponses: {
          const normalized = normalizeOpenAIResponsesHostAndPath({ apiHost, apiPath });
          return `${normalized.apiHost}${normalized.apiPath}`;
        }
        case ModelProviderType.OpenAI:
        default: {
          const normalized = normalizeOpenAIApiHostAndPath({ apiHost, apiPath });
          return `${normalized.apiHost}${normalized.apiPath}`;
        }
      }
    }
    if (baseInfo()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<section class="provider-editor svelte-uo7zgs"><div class="hero svelte-uo7zgs"><div><p class="eyebrow svelte-uo7zgs">Real Provider Flow</p> <div class="headline svelte-uo7zgs"><h1 class="svelte-uo7zgs">${escape_html(baseInfo().name)}</h1> <span class="kind-badge svelte-uo7zgs">${escape_html(baseInfo().isCustom ? "Custom" : "Built-in")}</span></div> `);
      if (baseInfo().description) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="lead svelte-uo7zgs">${escape_html(baseInfo().description)}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="hero-actions svelte-uo7zgs">`);
      if (baseInfo().urls?.website) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<a class="link-btn svelte-uo7zgs"${attr("href", baseInfo().urls.website)} target="_blank" rel="noreferrer">Website</a>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (baseInfo().urls?.docs) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<a class="link-btn svelte-uo7zgs"${attr("href", baseInfo().urls.docs)} target="_blank" rel="noreferrer">Docs</a>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (baseInfo().isCustom) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button class="danger-btn svelte-uo7zgs" type="button">${escape_html("Delete provider")}</button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="editor-grid svelte-uo7zgs"><div class="card svelte-uo7zgs"><div class="card-header svelte-uo7zgs"><div><h2 class="svelte-uo7zgs">Connection</h2> <p class="svelte-uo7zgs">Changes persist immediately to the shared settings store used by chat.</p></div></div> <div class="fields svelte-uo7zgs">`);
      if (baseInfo().isCustom) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="field-row svelte-uo7zgs"><label class="field svelte-uo7zgs"><span>Name</span> <input${attr("value", baseInfo().name)} class="svelte-uo7zgs"/></label> <label class="field svelte-uo7zgs"><span>API Mode</span> `);
        SelectMenu($$renderer2, {
          options: [
            {
              value: ModelProviderType.OpenAI,
              label: "OpenAI API Compatible"
            },
            {
              value: ModelProviderType.OpenAIResponses,
              label: "OpenAI Responses Compatible"
            },
            {
              value: ModelProviderType.Claude,
              label: "Claude API Compatible"
            },
            {
              value: ModelProviderType.Gemini,
              label: "Gemini API Compatible"
            }
          ],
          value: baseInfo().type,
          onChange: (value) => updateCustomProvider(providerId, { type: value })
        });
        $$renderer2.push(`<!----></label></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (requiresApiKey()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<label class="field svelte-uo7zgs"><span>API Key</span> <input type="password" placeholder="sk-..."${attr("value", providerSettings()?.apiKey ?? "")} class="svelte-uo7zgs"/></label>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (showsCloudflareFields()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="field-row svelte-uo7zgs"><label class="field svelte-uo7zgs"><span>Cloudflare Client ID</span> <input placeholder="Optional"${attr("value", providerSettings()?.cloudflareClientId ?? "")} class="svelte-uo7zgs"/></label> <label class="field svelte-uo7zgs"><span>Cloudflare Client Secret</span> <input type="password" placeholder="Optional"${attr("value", providerSettings()?.cloudflareClientSecret ?? "")} class="svelte-uo7zgs"/></label></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (showsGenericHost()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<label class="field svelte-uo7zgs"><span>API Host</span> <input${attr("placeholder", baseInfo().defaultSettings?.apiHost ?? "https://api.openai.com/v1")}${attr("value", providerSettings()?.apiHost ?? "")} class="svelte-uo7zgs"/></label>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (showsCustomHostPath()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="field-row svelte-uo7zgs"><label class="field svelte-uo7zgs"><span>API Host</span> <input placeholder="https://api.example.com/v1"${attr("value", providerSettings()?.apiHost ?? "")} class="svelte-uo7zgs"/></label> <label class="field svelte-uo7zgs"><span>API Path</span> <input placeholder="/chat/completions"${attr("value", providerSettings()?.apiPath ?? "")} class="svelte-uo7zgs"/></label></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (isAzureProvider()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="field-row svelte-uo7zgs"><label class="field svelte-uo7zgs"><span>Azure Endpoint</span> <input placeholder="https://resource-name.openai.azure.com"${attr("value", providerSettings()?.endpoint ?? "")} class="svelte-uo7zgs"/></label> <label class="field svelte-uo7zgs"><span>API Version</span> <input${attr("placeholder", baseInfo().defaultSettings?.apiVersion ?? "2024-05-01-preview")}${attr("value", providerSettings()?.apiVersion ?? "")} class="svelte-uo7zgs"/></label></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (allowsProxySwitch()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<label class="switch-field svelte-uo7zgs"><div><strong class="svelte-uo7zgs">Improve Network Compatibility</strong> <p class="svelte-uo7zgs">Keep the existing proxy-compatible setting path without exposing fake testing controls.</p></div> <input type="checkbox"${attr("checked", providerSettings()?.useProxy ?? false, true)} class="svelte-uo7zgs"/></label>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="resolved-endpoint svelte-uo7zgs"><span class="svelte-uo7zgs">Resolved endpoint</span> <code class="svelte-uo7zgs">${escape_html(resolvedEndpointPreview() || "Configure host details to see the final endpoint.")}</code></div></div></div> <div class="card svelte-uo7zgs"><div class="card-header svelte-uo7zgs"><div><h2 class="svelte-uo7zgs">Models</h2> <p class="svelte-uo7zgs">Add, edit, remove, or reset the model list that the Svelte chat shell consumes.</p></div> <div class="toolbar svelte-uo7zgs"><button class="ghost-btn svelte-uo7zgs" type="button">Reset</button> <button class="primary-btn svelte-uo7zgs" type="button">Add model</button></div></div> <div class="model-list svelte-uo7zgs">`);
      if (models().length > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<!--[-->`);
        const each_array = ensure_array_like(models());
        for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
          let model = each_array[$$index_1];
          $$renderer2.push(`<div class="model-row svelte-uo7zgs"><div class="model-copy svelte-uo7zgs"><div class="model-title-row svelte-uo7zgs"><strong${attr("title", model.nickname || model.modelId)} class="svelte-uo7zgs">${escape_html(model.nickname || model.modelId)}</strong> <span class="model-id svelte-uo7zgs">${escape_html(model.modelId)}</span></div> <div class="model-meta svelte-uo7zgs"><span class="meta-pill svelte-uo7zgs">${escape_html(model.type ?? "chat")}</span> `);
          if (model.capabilities?.length) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<!--[-->`);
            const each_array_1 = ensure_array_like(model.capabilities);
            for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
              let capability = each_array_1[$$index];
              $$renderer2.push(`<span class="meta-pill capability svelte-uo7zgs">${escape_html(capability.replace("_", " "))}</span>`);
            }
            $$renderer2.push(`<!--]-->`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> `);
          if (model.contextWindow) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="meta-pill subtle svelte-uo7zgs">ctx ${escape_html(formatNumber(model.contextWindow))}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> `);
          if (model.maxOutput) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="meta-pill subtle svelte-uo7zgs">out ${escape_html(formatNumber(model.maxOutput))}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div></div> <div class="row-actions svelte-uo7zgs"><button class="ghost-btn compact svelte-uo7zgs" type="button">Edit</button> <button class="danger-ghost compact svelte-uo7zgs" type="button">Remove</button></div></div>`);
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="empty-models svelte-uo7zgs"><strong class="svelte-uo7zgs">No models configured.</strong> <p class="svelte-uo7zgs">`);
        if (baseInfo().isCustom || baseInfo().id === ModelProviderEnum.Ollama || baseInfo().id === ModelProviderEnum.LMStudio) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`Add at least one model before this provider becomes available in chat.`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`Reset to defaults or add a custom model override for this provider.`);
        }
        $$renderer2.push(`<!--]--></p></div>`);
      }
      $$renderer2.push(`<!--]--></div> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div> <div class="scope-footnote svelte-uo7zgs"><span class="scope-badge svelte-uo7zgs">Out of scope</span> <p class="svelte-uo7zgs">Clipboard import, deep-link import, and model capability testing stay hidden until their Svelte paths are fully ported.</p></div></section>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<section class="provider-editor missing svelte-uo7zgs"><div class="card svelte-uo7zgs"><h2 class="svelte-uo7zgs">Provider not found</h2> <p>This provider no longer exists in the current settings state.</p> <a class="primary-inline svelte-uo7zgs" href="/settings/provider">Back to provider list</a></div></section>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    ProviderEditor($$renderer2, {
      providerId: store_get($$store_subs ??= {}, "$page", page).params.providerId
    });
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
