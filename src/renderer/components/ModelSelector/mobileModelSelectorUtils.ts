export function shouldShowProviderSetup({
  search,
  providerCount,
  showAuto,
}: {
  search: string
  providerCount: number
  showAuto?: boolean
}): boolean {
  return !search && providerCount === 0 && !showAuto
}
