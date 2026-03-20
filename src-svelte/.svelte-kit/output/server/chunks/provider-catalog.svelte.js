import "clsx";
class ProviderCatalogStore {
  systemProviders = [];
  ready = false;
  initializing = null;
  constructor() {
  }
  async init() {
    {
      return this.systemProviders;
    }
  }
}
const providerCatalogStore = new ProviderCatalogStore();
export {
  providerCatalogStore as p
};
