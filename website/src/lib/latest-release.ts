export const FALLBACK_RELEASE_URL = 'https://github.com/nikethai/chaeboxi/releases/latest'

export type PlatformId = 'mac-arm' | 'mac-intel' | 'windows' | 'linux-appimage' | 'linux-deb'

export type DownloadRow = {
  id: PlatformId
  label: string
  detail: string
  href: string
}

export type ReleaseAsset = {
  name: string
  browser_download_url: string
}

const ROWS: Omit<DownloadRow, 'href'>[] = [
  { id: 'mac-arm', label: 'macOS (Apple Silicon)', detail: 'Disk image · aarch64' },
  { id: 'mac-intel', label: 'macOS (Intel)', detail: 'Disk image · x64' },
  { id: 'windows', label: 'Windows', detail: 'NSIS installer · x64' },
  { id: 'linux-appimage', label: 'Linux AppImage', detail: 'AppImage · amd64' },
  { id: 'linux-deb', label: 'Linux .deb', detail: 'Debian package · amd64' },
]

export function matchAsset(id: PlatformId, name: string): boolean {
  const n = name.toLowerCase()
  switch (id) {
    case 'mac-arm':
      return n.endsWith('_aarch64.dmg') || n.endsWith('aarch64.dmg')
    case 'mac-intel':
      return n.endsWith('_x64.dmg') && !n.includes('aarch64')
    case 'windows':
      return n.endsWith('_x64-setup.exe') || n.endsWith('x64-setup.exe')
    case 'linux-appimage':
      return n.endsWith('_amd64.appimage') || n.endsWith('amd64.appimage')
    case 'linux-deb':
      return n.endsWith('_amd64.deb') || n.endsWith('amd64.deb')
  }
}

export function mapReleaseAssets(assets: ReleaseAsset[]): DownloadRow[] {
  return ROWS.map((row) => {
    const asset = assets.find((item) => matchAsset(row.id, item.name))
    return {
      ...row,
      href: asset?.browser_download_url ?? FALLBACK_RELEASE_URL,
    }
  })
}

export async function getLatestDownloads(): Promise<{ tag: string; rows: DownloadRow[] }> {
  try {
    const res = await fetch('https://api.github.com/repos/nikethai/chaeboxi/releases/latest', {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'chaeboxi-website',
      },
    })
    if (!res.ok) {
      return { tag: 'latest', rows: mapReleaseAssets([]) }
    }
    const data = (await res.json()) as { tag_name?: string; assets?: ReleaseAsset[] }
    return {
      tag: data.tag_name ?? 'latest',
      rows: mapReleaseAssets(data.assets ?? []),
    }
  } catch {
    return { tag: 'latest', rows: mapReleaseAssets([]) }
  }
}
