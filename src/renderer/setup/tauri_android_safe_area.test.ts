import fs from 'node:fs'
import path from 'node:path'

describe('Tauri Android safe-area setup', () => {
  it('does not invoke an unregistered native system-bar-insets command', () => {
    const source = fs.readFileSync(path.join(__dirname, 'tauri_android_safe_area.ts'), 'utf8')

    expect(source).not.toContain('get_system_bar_insets')
    expect(source).not.toContain('@tauri-apps/api/core')
    expect(source).not.toMatch(/\binvoke\s*\(/)
  })
})
