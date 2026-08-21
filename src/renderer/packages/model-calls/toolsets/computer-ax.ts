/**
 * Computer Use AX helpers (pure). Backend owns the tree walk.
 */

export const AX_ROLES = ['search', 'text_field', 'button', 'any'] as const
export type AxRoleFilter = (typeof AX_ROLES)[number]

export function normalizeAxRole(value: string | undefined | null): AxRoleFilter {
  const v = (value || '').trim().toLowerCase()
  if (v === 'search' || v === 'search_field' || v === 'axsearchfield') return 'search'
  if (v === 'text' || v === 'text_field' || v === 'textfield' || v === 'axtextfield') return 'text_field'
  if (v === 'button' || v === 'axbutton') return 'button'
  return 'any'
}

export function isAxVisionFallback(result: { fallback?: string; ok?: boolean; error?: string } | null | undefined): boolean {
  if (!result) return true
  if (result.fallback === 'vision') return true
  if (result.ok === false && result.error && result.error !== 'PERMISSION_DENIED') return true
  return false
}
