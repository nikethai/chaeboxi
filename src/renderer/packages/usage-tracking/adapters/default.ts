import type { ProviderQuotaAdapter } from '@shared/providers/usage'
import { unsupportedQuota } from '@shared/providers/usage'

export const defaultQuotaAdapter: ProviderQuotaAdapter = {
  id: 'default',
  supports() {
    return true
  },
  getPlan() {
    return undefined
  },
  async fetchQuota() {
    return unsupportedQuota()
  },
  getLinks() {
    return {}
  },
}
