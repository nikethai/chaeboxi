import { d as derived } from "../../../../chunks/index2.js";
import { S as SelectMenu } from "../../../../chunks/SelectMenu.js";
import { b as getChatModels, a as getAvailableProviders } from "../../../../chunks/providers.js";
import { p as providerCatalogStore } from "../../../../chunks/provider-catalog.svelte.js";
import { s as settingsStore } from "../../../../chunks/settings.svelte.js";
function SettingsModelSelect($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      providers = [],
      selected = null,
      autoLabel = "Auto",
      placeholder = "Choose a model",
      modelFilter,
      onSelect,
      class: className = ""
    } = $$props;
    const options = derived(() => {
      const nextOptions = [
        {
          value: "",
          label: autoLabel,
          hint: "Use the existing default behavior"
        }
      ];
      for (const provider of providers) {
        for (const model of getChatModels(provider)) {
          if (modelFilter && !modelFilter(model)) {
            continue;
          }
          nextOptions.push({
            value: `${provider.id}::${model.modelId}`,
            label: model.nickname || model.modelId,
            hint: provider.name
          });
        }
      }
      return nextOptions;
    });
    const selectedValue = derived(() => selected ? `${selected.provider}::${selected.model}` : "");
    function handleChange(value) {
      if (!value) {
        onSelect?.(null);
        return;
      }
      const [provider, model] = value.split("::");
      if (!provider || !model) {
        onSelect?.(null);
        return;
      }
      onSelect?.({ provider, model });
    }
    SelectMenu($$renderer2, {
      options: options(),
      value: selectedValue(),
      placeholder,
      onChange: handleChange,
      class: className
    });
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const providers = derived(() => getAvailableProviders(settingsStore.settings, providerCatalogStore.systemProviders));
    $$renderer2.push(`<section class="settings-page svelte-jtk69z"><header class="page-header svelte-jtk69z"><p class="eyebrow svelte-jtk69z">Default Models</p> <h1 class="svelte-jtk69z">Choose the default model paths</h1> <p class="svelte-jtk69z">These selectors write to the same provider/model metadata already consumed by chat and image flows.</p></header> <div class="card-grid svelte-jtk69z"><section class="card svelte-jtk69z"><h2 class="svelte-jtk69z">Default chat model</h2> <p class="svelte-jtk69z">Used for new chats unless the draft session overrides it.</p> `);
    SettingsModelSelect($$renderer2, {
      providers: providers(),
      selected: settingsStore.settings.defaultChatModel ? {
        provider: settingsStore.settings.defaultChatModel.provider,
        model: settingsStore.settings.defaultChatModel.model
      } : null,
      autoLabel: "Auto (use last used)",
      onSelect: (selection) => settingsStore.update({
        defaultChatModel: selection ? { provider: selection.provider, model: selection.model } : void 0
      })
    });
    $$renderer2.push(`<!----></section> <section class="card svelte-jtk69z"><h2 class="svelte-jtk69z">Default thread naming model</h2> <p class="svelte-jtk69z">Falls back to the current chat model when left on auto.</p> `);
    SettingsModelSelect($$renderer2, {
      providers: providers(),
      selected: settingsStore.settings.threadNamingModel ? {
        provider: settingsStore.settings.threadNamingModel.provider,
        model: settingsStore.settings.threadNamingModel.model
      } : null,
      autoLabel: "Auto (use chat model)",
      onSelect: (selection) => settingsStore.update({
        threadNamingModel: selection ? { provider: selection.provider, model: selection.model } : void 0
      })
    });
    $$renderer2.push(`<!----></section> <section class="card svelte-jtk69z"><h2 class="svelte-jtk69z">Search term construction model</h2> <p class="svelte-jtk69z">Used when search-enabled chats need a separate search-term model.</p> `);
    SettingsModelSelect($$renderer2, {
      providers: providers(),
      selected: settingsStore.settings.searchTermConstructionModel ? {
        provider: settingsStore.settings.searchTermConstructionModel.provider,
        model: settingsStore.settings.searchTermConstructionModel.model
      } : null,
      autoLabel: "Auto (use chat model)",
      onSelect: (selection) => settingsStore.update({
        searchTermConstructionModel: selection ? { provider: selection.provider, model: selection.model } : void 0
      })
    });
    $$renderer2.push(`<!----></section> <section class="card svelte-jtk69z"><h2 class="svelte-jtk69z">OCR model</h2> <p class="svelte-jtk69z">Only vision-capable chat models are shown here. Leave it empty to disable OCR fallback.</p> `);
    SettingsModelSelect($$renderer2, {
      providers: providers(),
      selected: settingsStore.settings.ocrModel ? {
        provider: settingsStore.settings.ocrModel.provider,
        model: settingsStore.settings.ocrModel.model
      } : null,
      autoLabel: "None",
      modelFilter: (model) => model.capabilities?.includes("vision") ?? false,
      onSelect: (selection) => settingsStore.update({
        ocrModel: selection ? { provider: selection.provider, model: selection.model } : void 0
      })
    });
    $$renderer2.push(`<!----></section></div></section>`);
  });
}
export {
  _page as default
};
