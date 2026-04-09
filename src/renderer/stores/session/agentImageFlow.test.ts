import { describe, expect, it } from 'vitest'
import { extractDanbooruTagListFromText } from './agentImageFlow'

describe('extractDanbooruTagListFromText', () => {
  it('extracts a plain comma-separated Danbooru-style tag list', () => {
    expect(
      extractDanbooruTagListFromText(
        'masterpiece, best quality, cinematic lighting, dramatic perspective, city lights, night'
      )
    ).toBe('masterpiece, best quality, cinematic lighting, dramatic perspective, city lights, night')
  })

  it('extracts a labeled final tag list from prose', () => {
    expect(
      extractDanbooruTagListFromText(`
Research summary:
Strong trend toward clean lineart and moody neon city scenes.

Final tags: masterpiece, best quality, clean lineart, cinematic lighting, neon city, dramatic perspective, night
      `)
    ).toBe('masterpiece, best quality, clean lineart, cinematic lighting, neon city, dramatic perspective, night')
  })

  it('rejects JSON snippets instead of treating them as tag lists', () => {
    expect(
      extractDanbooruTagListFromText(`
ComfyUI JSON Snippet (Basic Node Setup)

\`\`\`json
{
  "prompt": "masterpiece, best_quality, ai-generated, official_style, clean_lineart",
  "negative_prompt": "lowres, bad_hands, text, watermark",
  "steps": 28,
  "cfg": 7.5
}
\`\`\`
      `)
    ).toBeNull()
  })

  it('rejects escaped JSON strings copied from tool arguments', () => {
    expect(
      extractDanbooruTagListFromText(
        '"{\\"prompt\\": \\"masterpiece, best_quality, clean_lineart\\", \\"steps\\": 28}"'
      )
    ).toBeNull()
  })
})
