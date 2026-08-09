import { Badge, Button, Flex, Stack, Switch, Text } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { SettingsPrefRow } from '@/components/settings/SettingsPrefRow'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { AGENT_HOOK_CONFIGS } from '@/packages/hooks'
import platform from '@/platform'
import { useHooks } from '@/stores/hooksStore'
import { add as addToast } from '@/stores/toastActions'

export const Route = createFileRoute('/settings/hooks')({
  component: RouteComponent,
})

export function RouteComponent() {
  const { t } = useTranslation()
  const {
    hooks,
    agentRoots,
    agentHookCount,
    shellHooksEnabled,
    setShellHooksEnabled,
    setHookEnabled,
    rescanAgentHooks,
    audit,
  } = useHooks()
  const [rescanning, setRescanning] = useState(false)
  const isDesktop = platform.type === 'desktop'

  const handleRescan = async () => {
    setRescanning(true)
    try {
      const result = await rescanAgentHooks()
      const found = result.roots.filter((r) => r.exists).length
      addToast(
        t('Found {{count}} hooks from {{dirs}} configs', {
          count: result.count,
          dirs: found,
        })
      )
    } catch (e) {
      addToast((e as Error).message || t('Failed to scan hooks'))
    } finally {
      setRescanning(false)
    }
  }

  return (
    <SettingsPage wide>
      <SettingsPageHeader
        title={t('Hooks')}
        description={t(
          'Lifecycle automation that runs automatically — never tagged in chat. Import from Claude and Cursor setups. Shell hooks are opt-in and desktop-only.'
        )}
        actions={
          isDesktop ? (
            <Button
              variant="default"
              leftSection={<IconRefresh size={16} />}
              loading={rescanning}
              onClick={() => void handleRescan()}
            >
              {t('Rescan agent configs')}
            </Button>
          ) : undefined
        }
      />

      <SettingsSection title={t('Safety')}>
        <SettingsCard divided>
          <SettingsPrefRow
            title={t('Enable shell hooks')}
            description={t(
              'Off by default. When on, imported command hooks may run shell scripts with a timeout. Desktop only.'
            )}
            control={
              <Switch checked={shellHooksEnabled} onChange={(e) => setShellHooksEnabled(e.currentTarget.checked)} />
            }
          />
        </SettingsCard>
      </SettingsSection>

      {isDesktop && (
        <SettingsSection title={t('Agent hook configs')}>
          <SettingsCard>
            <div className="settings-card-fields">
              <Text size="xs" c="chatbox-tertiary">
                {agentHookCount > 0 ? `${agentHookCount} hooks` : t('No agent hooks scanned yet')}
              </Text>
              <Stack gap={4}>
                {(agentRoots.length
                  ? agentRoots
                  : AGENT_HOOK_CONFIGS.map((r) => ({ path: r.path, origin: r.origin, exists: false }))
                ).map((root) => (
                  <Text
                    key={root.path}
                    size="xs"
                    c={root.exists ? 'chatbox-secondary' : 'chatbox-tertiary'}
                    className="font-mono"
                  >
                    {root.exists ? '●' : '○'} {root.origin}: {root.path}
                  </Text>
                ))}
              </Stack>
            </div>
          </SettingsCard>
        </SettingsSection>
      )}

      <SettingsSection title={t('Catalog')}>
        <Stack gap="sm">
          {hooks.map((hook) => (
            <div
              key={hook.id}
              className="settings-list-row"
              style={{ background: 'var(--chatbox-background-secondary)', boxShadow: 'var(--settings-shadow)' }}
            >
              <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                <Flex gap="xs" align="center" wrap="wrap">
                  <Text fw={600}>{hook.name || hook.id}</Text>
                  <Badge size="xs" variant="light">
                    {hook.event}
                  </Badge>
                  <Badge size="xs" variant="outline">
                    {hook.kind}
                  </Badge>
                  <Badge size="xs" variant="light">
                    {hook.origin}
                  </Badge>
                  {hook.kind === 'command' && !shellHooksEnabled && (
                    <Badge size="xs" color="yellow">
                      {t('Shell off')}
                    </Badge>
                  )}
                </Flex>
                {hook.description && (
                  <Text size="sm" c="chatbox-secondary" lineClamp={2} className="font-mono">
                    {hook.description}
                  </Text>
                )}
                {hook.matcher && (
                  <Text size="xs" c="chatbox-tertiary">
                    matcher: {hook.matcher}
                  </Text>
                )}
              </Stack>
              <Switch
                checked={hook.enabled}
                onChange={(e) => setHookEnabled(hook.id, e.currentTarget.checked)}
                label={t('Enabled')}
                labelPosition="left"
              />
            </div>
          ))}
          {hooks.length === 0 && (
            <Text size="sm" c="chatbox-tertiary">
              {t('No hooks found. Rescan agent configs on desktop or wait for builtins.')}
            </Text>
          )}
        </Stack>
      </SettingsSection>

      {audit.length > 0 && (
        <SettingsSection title={t('Recent runs')}>
          <SettingsCard>
            <div className="settings-card-fields">
              {audit.slice(0, 10).map((r) => (
                <Text key={r.id} size="xs" c="chatbox-tertiary" className="font-mono">
                  {new Date(r.at).toLocaleTimeString()} · {r.event} · {r.hookId.slice(0, 40)}
                  {r.blocked ? ' · BLOCKED' : ''} · exit {r.exitCode ?? '-'}
                </Text>
              ))}
            </div>
          </SettingsCard>
        </SettingsSection>
      )}
    </SettingsPage>
  )
}
