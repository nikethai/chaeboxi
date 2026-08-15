import { ToolRiskTier } from '@shared/types/mcp'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getToolApprovalMock = vi.hoisted(() => vi.fn())
const addAuditEntryMock = vi.hoisted(() => vi.fn())
const showModalMock = vi.hoisted(() => vi.fn())

vi.mock('@/stores/toolApprovalStore', () => ({
  getToolApproval: getToolApprovalMock,
  toolApprovalStore: {
    getState: () => ({
      addAuditEntry: addAuditEntryMock,
    }),
  },
}))

vi.mock('@ebay/nice-modal-react', () => ({
  default: {
    show: showModalMock,
  },
}))

vi.mock('../tools/risk-engine', () => ({
  getToolRiskTier: (name: string) => {
    if (name.startsWith('computer_click') || name === 'computer_type') return ToolRiskTier.CRITICAL
    if (name === 'browser_click') return ToolRiskTier.HIGH
    if (name === 'browser_snapshot') return ToolRiskTier.LOW
    return ToolRiskTier.MEDIUM
  },
}))

vi.mock('i18next', () => ({
  t: (s: string) => s,
}))

// Mirrors stream-text wrap policy (D8): LOW always auto; session scope may auto
// MEDIUM/HIGH; CRITICAL must never session-auto. Typed helper keeps enum comparisons valid.

function canSessionAutoApprove(
  riskTier: ToolRiskTier,
  existingApproval?: { scope: 'session'; riskTier: ToolRiskTier },
): boolean {
  return (
    riskTier === ToolRiskTier.LOW ||
    (existingApproval?.scope === 'session' &&
      existingApproval.riskTier === riskTier &&
      riskTier !== ToolRiskTier.CRITICAL)
  )
}

describe('CRITICAL approval policy (D8)', () => {
  beforeEach(() => {
    getToolApprovalMock.mockReset()
    addAuditEntryMock.mockReset()
    showModalMock.mockReset()
  })

  it('session approval must not auto-approve CRITICAL', () => {
    expect(
      canSessionAutoApprove(ToolRiskTier.CRITICAL, {
        scope: 'session',
        riskTier: ToolRiskTier.CRITICAL,
      }),
    ).toBe(false)
  })

  it('session approval can auto-approve MEDIUM', () => {
    expect(
      canSessionAutoApprove(ToolRiskTier.MEDIUM, {
        scope: 'session',
        riskTier: ToolRiskTier.MEDIUM,
      }),
    ).toBe(true)
  })

  it('HIGH can session-auto after explicit allow-session (CRITICAL still never)', () => {
    expect(
      canSessionAutoApprove(ToolRiskTier.HIGH, {
        scope: 'session',
        riskTier: ToolRiskTier.HIGH,
      }),
    ).toBe(true)
    expect(
      canSessionAutoApprove(ToolRiskTier.CRITICAL, {
        scope: 'session',
        riskTier: ToolRiskTier.CRITICAL,
      }),
    ).toBe(false)
  })

  it('LOW always auto', () => {
    expect(canSessionAutoApprove(ToolRiskTier.LOW)).toBe(true)
  })
})

describe('risk engine browser/computer intents', () => {
  it('classifies browser and computer tools', async () => {
    vi.doUnmock('../tools/risk-engine')
    const { getToolRiskTier } = await import('../tools/risk-engine')
    // Prefer explicit name matches from updated intent patterns
    expect(getToolRiskTier('browser_snapshot')).toBe(ToolRiskTier.LOW)
    expect(getToolRiskTier('browser_click')).toBe(ToolRiskTier.HIGH)
    expect(getToolRiskTier('browser_navigate')).toBe(ToolRiskTier.HIGH)
    expect(getToolRiskTier('computer_screenshot')).toBe(ToolRiskTier.MEDIUM)
    expect(getToolRiskTier('computer_click')).toBe(ToolRiskTier.CRITICAL)
    expect(getToolRiskTier('computer_type')).toBe(ToolRiskTier.CRITICAL)
    expect(getToolRiskTier('computer_open_app')).toBe(ToolRiskTier.CRITICAL)
  })
})
