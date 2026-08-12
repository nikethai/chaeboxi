import { describe, expect, it } from 'vitest'
import {
  clearComputerUiTargetApp,
  computerUiSpaceLockInstructions,
  filterToolsForComputerUiSpace,
  getComputerUiTargetApp,
  setComputerUiTargetApp,
} from './computer-ui-lock'

describe('filterToolsForComputerUiSpace', () => {
  const base = {
    computer_screenshot: {} as never,
    computer_open_app: {} as never,
    search_file_content: {} as never,
    read_file: {} as never,
    create_file: {} as never,
    edit_file: {} as never,
    delete_file: {} as never,
    terminal: {} as never,
    web_search: {} as never,
    memory_search: {} as never,
    browser_navigate: {} as never,
    browser_click: {} as never,
    browser_snapshot: {} as never,
  }

  it('always strips search_file_content and browser_* tools', () => {
    const out = filterToolsForComputerUiSpace(base, { agentCodingEnabled: true })
    expect(out.search_file_content).toBeUndefined()
    expect(out.browser_navigate).toBeUndefined()
    expect(out.browser_click).toBeUndefined()
    expect(out.browser_snapshot).toBeUndefined()
    expect(out.computer_screenshot).toBeDefined()
    expect(out.create_file).toBeDefined()
    expect(out.web_search).toBeDefined()
  })

  it('strips workspace write/terminal when coding off', () => {
    const out = filterToolsForComputerUiSpace(base, { agentCodingEnabled: false })
    expect(out.search_file_content).toBeUndefined()
    expect(out.create_file).toBeUndefined()
    expect(out.edit_file).toBeUndefined()
    expect(out.delete_file).toBeUndefined()
    expect(out.terminal).toBeUndefined()
    expect(out.read_file).toBeDefined()
    expect(out.computer_open_app).toBeDefined()
  })

  it('keeps coding tools when agent coding enabled', () => {
    const out = filterToolsForComputerUiSpace(base, { agentCodingEnabled: true })
    expect(out.create_file).toBeDefined()
    expect(out.terminal).toBeDefined()
    expect(out.search_file_content).toBeUndefined()
  })
})

describe('computer target app memory', () => {
  it('stores and clears last target app', () => {
    setComputerUiTargetApp('s1', 'WhatsApp')
    expect(getComputerUiTargetApp('s1')).toBe('WhatsApp')
    const text = computerUiSpaceLockInstructions({ sessionId: 's1' })
    expect(text).toContain('WhatsApp')
    expect(text).toContain('FORBIDDEN')
    expect(text).toContain('Finder')
    clearComputerUiTargetApp('s1')
    expect(getComputerUiTargetApp('s1')).toBeUndefined()
  })
})
