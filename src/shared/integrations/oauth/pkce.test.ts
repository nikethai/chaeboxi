import { describe, expect, it } from 'vitest'
import { createPkceAuthSession, parseOAuthRedirect } from './pkce'

describe('oauth pkce', () => {
  it('builds auth url with challenge', async () => {
    const session = await createPkceAuthSession({
      connectorId: 'jira',
      authorizationUrl: 'https://auth.example/authorize',
      clientId: 'cid',
      redirectUri: 'http://127.0.0.1:19847/oauth/callback',
      scopes: ['a', 'b'],
      usesPkce: true,
    })
    expect(session.authUrl).toContain('code_challenge=')
    expect(session.authUrl).toContain('client_id=cid')
    expect(session.verifier.length).toBeGreaterThan(10)
  })

  it('parses redirect url', () => {
    const r = parseOAuthRedirect('http://127.0.0.1:19847/oauth/callback?code=abc&state=xyz')
    expect(r.code).toBe('abc')
    expect(r.state).toBe('xyz')
  })
})
