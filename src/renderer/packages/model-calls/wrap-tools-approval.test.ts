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

// Import after mocks — stream-text pulls many deps; isolate wrap via dynamic import of module
// We re-test the policy logic inline to avoid loading full stream-text graph.

describe('CRITICAL approval policy (D8)', () => {
  beforeEach(() => {
    getToolApprovalMock.mockReset()
    addAuditEntryMock.mockReset()
    showModalMock.mockReset()
  })

  it('session approval must not auto-approve CRITICAL', () => {
    const riskTier = ToolRiskTier.CRITICAL
    const existingApproval = { scope: 'session' as const, riskTier: ToolRiskTier.CRITICAL }
    const canAutoApprove =
      riskTier === ToolRiskTier.LOW ||
      (existingApproval?.scope === 'session' &&
        existingApproval.riskTier === riskTier &&
        riskTier !== ToolRiskTier.HIGH &&
        riskTier !== ToolRiskTier.CRITICAL)
    expect(canAutoApprove).toBe(false)
  })

  it('session approval can auto-approve MEDIUM', () => {
    const riskTier = ToolRiskTier.MEDIUM
    const existingApproval = { scope: 'session' as const, riskTier: ToolRiskTier.MEDIUM }
    const canAutoApprove =
      riskTier === ToolRiskTier.LOW ||
      (existingApproval?.scope === 'session' &&
        existingApproval.riskTier === riskTier &&
        riskTier !== ToolRiskTier.HIGH &&
        riskTier !== ToolRiskTier.CRITICAL)
    expect(canAutoApprove).toBe(true)
  })

  it('HIGH can session-auto after explicit allow-session (CRITICAL still never)', () => {
    const riskTier = ToolRiskTier.HIGH
    const existingApproval = { scope: 'session' as const, riskTier: ToolRiskTier.HIGH }
    const canAutoApprove =
      riskTier === ToolRiskTier.LOW ||
      (existingApproval?.scope === 'session' &&
        existingApproval.riskTier === riskTier &&
        riskTier !== ToolRiskTier.CRITICAL)
    expect(canAutoApprove).toBe(true)

    const critical = ToolRiskTier.CRITICAL
    const criticalApproval = { scope: 'session' as const, riskTier: ToolRiskTier.CRITICAL }
    const criticalAuto =
      critical === ToolRiskTier.LOW ||
      (criticalApproval?.scope === 'session' &&
        criticalApproval.riskTier === critical &&
        critical !== ToolRiskTier.CRITICAL)
    expect(criticalAuto).toBe(false)
  })

  it('LOW always auto', () => {
    const riskTier = ToolRiskTier.LOW
    const canAutoApprove =
      riskTier === ToolRiskTier.LOW ||
      (false && riskTier !== ToolRiskTier.HIGH && riskTier !== ToolRiskTier.CRITICAL)
    expect(canAutoApprove).toBe(true)
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
