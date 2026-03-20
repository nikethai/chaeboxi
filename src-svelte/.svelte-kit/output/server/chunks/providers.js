import { a as ModelProviderEnum } from "./defaults.js";
function getAvailableProviders(settings, systemProviders = []) {
  const baseProviders = [...systemProviders, ...settings.customProviders || []];
  const resolvedProviders = baseProviders.map((provider) => {
    const providerSettings = settings.providers?.[provider.id];
    const models = providerSettings?.models ?? provider.defaultSettings?.models;
    const hasConfiguredAccess = !provider.isCustom && providerSettings?.apiKey || (provider.isCustom || provider.id === ModelProviderEnum.Ollama || provider.id === ModelProviderEnum.LMStudio) && Boolean(models?.length);
    if (!hasConfiguredAccess) {
      return null;
    }
    return {
      ...provider,
      ...providerSettings,
      models
    };
  });
  return resolvedProviders.filter((provider) => provider !== null);
}
function getChatModels(provider) {
  return (provider.models || provider.defaultSettings?.models || []).filter(
    (model) => !model.type || model.type === "chat"
  );
}
function getSelectedModelLabel(providers, selected) {
  if (!selected) {
    return "Select Model";
  }
  const provider = providers.find((candidate) => candidate.id === selected.provider);
  const model = provider ? getChatModels(provider).find((candidate) => candidate.modelId === selected.modelId) : void 0;
  return model?.nickname || selected.modelId;
}
export {
  getAvailableProviders as a,
  getChatModels as b,
  getSelectedModelLabel as g
};
