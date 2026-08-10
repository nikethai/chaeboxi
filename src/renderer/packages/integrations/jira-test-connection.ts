import { ofetch } from 'ofetch'

export type JiraTestConnectionInput = {
  siteUrl: string
  email: string
  apiToken: string
}

export type JiraTestConnectionResult =
  | {
      ok: true
      accountId?: string
      displayName?: string
      emailAddress?: string
    }
  | {
      ok: false
      message: string
      status?: number
    }

function normalizeSiteUrl(siteUrl: string): string {
  const trimmed = siteUrl.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return trimmed
}

/**
 * Verify Jira API token via GET /rest/api/3/myself (Cloud) with Basic auth.
 */
export async function testJiraConnection(input: JiraTestConnectionInput): Promise<JiraTestConnectionResult> {
  const siteUrl = normalizeSiteUrl(input.siteUrl)
  const email = input.email.trim()
  const apiToken = input.apiToken.trim()

  if (!siteUrl || !email || !apiToken) {
    return { ok: false, message: 'Site URL, email, and API token are required.' }
  }

  const basic = typeof btoa === 'function' ? btoa(`${email}:${apiToken}`) : Buffer.from(`${email}:${apiToken}`).toString('base64')

  try {
    const data = await ofetch<{ accountId?: string; displayName?: string; emailAddress?: string }>(
      `${siteUrl}/rest/api/3/myself`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${basic}`,
          Accept: 'application/json',
        },
        timeout: 20_000,
      }
    )
    return {
      ok: true,
      accountId: data.accountId,
      displayName: data.displayName,
      emailAddress: data.emailAddress ?? email,
    }
  } catch (err: unknown) {
    const status = (err as { status?: number; response?: { status?: number } })?.status
      ?? (err as { response?: { status?: number } })?.response?.status
    if (status === 401 || status === 403) {
      return {
        ok: false,
        status,
        message: 'Authentication failed. Check email, API token, and site URL.',
      }
    }
    if (status === 404) {
      return {
        ok: false,
        status,
        message: 'Jira API not found at this URL. Use your site root (e.g. https://domain.atlassian.net).',
      }
    }
    const msg = err instanceof Error ? err.message : 'Connection failed'
    return { ok: false, status, message: msg }
  }
}

export { normalizeSiteUrl }
