import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { FALLBACK_RELEASE_URL, mapReleaseAssets, matchAsset } from './latest-release'

const v170 = [
  { name: 'Chaeboxi_1.7.0_aarch64.dmg', browser_download_url: 'https://example.com/arm.dmg' },
  { name: 'Chaeboxi_1.7.0_x64.dmg', browser_download_url: 'https://example.com/intel.dmg' },
  { name: 'Chaeboxi_1.7.0_x64-setup.exe', browser_download_url: 'https://example.com/win.exe' },
  { name: 'Chaeboxi_1.7.0_amd64.AppImage', browser_download_url: 'https://example.com/appimage' },
  { name: 'Chaeboxi_1.7.0_amd64.deb', browser_download_url: 'https://example.com/deb' },
]

describe('matchAsset', () => {
  it('does not treat aarch64 dmg as intel', () => {
    assert.equal(matchAsset('mac-arm', 'Chaeboxi_1.7.0_aarch64.dmg'), true)
    assert.equal(matchAsset('mac-intel', 'Chaeboxi_1.7.0_aarch64.dmg'), false)
    assert.equal(matchAsset('mac-intel', 'Chaeboxi_1.7.0_x64.dmg'), true)
  })
})

describe('mapReleaseAssets', () => {
  it('maps the v1.7.0 suffix set', () => {
    const rows = mapReleaseAssets(v170)
    assert.equal(rows[0].href, 'https://example.com/arm.dmg')
    assert.equal(rows[1].href, 'https://example.com/intel.dmg')
    assert.equal(rows[2].href, 'https://example.com/win.exe')
    assert.equal(rows[3].href, 'https://example.com/appimage')
    assert.equal(rows[4].href, 'https://example.com/deb')
  })

  it('falls back when the API returns nothing', () => {
    for (const row of mapReleaseAssets([])) {
      assert.equal(row.href, FALLBACK_RELEASE_URL)
    }
  })
})
