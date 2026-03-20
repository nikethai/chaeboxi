import { a as ModelProviderEnum, M as ModelProviderType } from "./defaults.js";
import { s as settingsStore } from "./settings.svelte.js";
const LOCAL_MODEL_ONLY_PROVIDER_IDS = /* @__PURE__ */ new Set([ModelProviderEnum.Ollama, ModelProviderEnum.LMStudio]);
[
  { value: ModelProviderType.OpenAI, label: "OpenAI API Compatible" },
  { value: ModelProviderType.OpenAIResponses, label: "OpenAI Responses Compatible" },
  { value: ModelProviderType.Claude, label: "Claude API Compatible" },
  { value: ModelProviderType.Gemini, label: "Gemini API Compatible" }
];
function getProviderBaseInfos(settings, systemProviders = []) {
  return [...systemProviders, ...settings.customProviders ?? []];
}
function getProviderBaseInfo(settings, systemProviders = [], providerId) {
  return getProviderBaseInfos(settings, systemProviders).find((provider) => provider.id === providerId) ?? null;
}
function getProviderSettings(settings, providerId) {
  return settings.providers?.[providerId];
}
function getProviderModels(baseInfo, providerSettings) {
  return providerSettings?.models ?? cloneModels(baseInfo.defaultSettings?.models);
}
function isProviderConfigured(baseInfo, settings) {
  const providerSettings = getProviderSettings(settings, baseInfo.id);
  const models = getProviderModels(baseInfo, providerSettings);
  if (baseInfo.isCustom || LOCAL_MODEL_ONLY_PROVIDER_IDS.has(baseInfo.id)) {
    return models.length > 0;
  }
  return Boolean(providerSettings?.apiKey?.trim());
}
function updateCustomProvider(providerId, updater) {
  settingsStore.update((draft) => {
    draft.customProviders = (draft.customProviders ?? []).map((provider) => {
      if (provider.id !== providerId) {
        return provider;
      }
      const patch = typeof updater === "function" ? updater(provider) : updater;
      return {
        ...provider,
        ...patch,
        id: provider.id,
        isCustom: true
      };
    });
  });
}
function cloneModels(models) {
  return models?.map((model) => ({
    ...model,
    labels: model.labels ? [...model.labels] : void 0,
    capabilities: model.capabilities ? [...model.capabilities] : void 0
  })) ?? [];
}
export {
  getProviderBaseInfo as a,
  getProviderSettings as b,
  getProviderModels as c,
  getProviderBaseInfos as g,
  isProviderConfigured as i,
  updateCustomProvider as u
};
