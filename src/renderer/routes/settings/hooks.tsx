import { Badge, Box, Button, Flex, Stack, Switch, Text, Title } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
    <Stack gap="lg" p="md">
      <Flex justify="space-between" align="flex-start" gap="md" wrap="wrap">
        <Stack gap={4}>
          <Title order={5}>{t('Hooks')}</Title>
          <Text size="sm" c="chatbox-tertiary">
            {t(
              'Lifecycle automation that runs automatically — never tagged in chat. Import from Claude and Cursor setups. Shell hooks are opt-in and desktop-only.'
            )}
          </Text>
        </Stack>
        {isDesktop && (
          <Button
            variant="default"
            leftSection={<IconRefresh size={16} />}
            loading={rescanning}
            onClick={() => void handleRescan()}
          >
            {t('Rescan agent configs')}
          </Button>
        )}
      </Flex>

      <Box
        p="md"
        style={{
          borderRadius: 12,
          background: 'var(--chatbox-background-secondary)',
          border: '1px solid var(--chatbox-border-primary)',
        }}
      >
        <Switch
          checked={shellHooksEnabled}
          onChange={(e) => setShellHooksEnabled(e.currentTarget.checked)}
          label={t('Enable shell hooks')}
          description={t(
            'Off by default. When on, imported command hooks may run shell scripts with a timeout. Desktop only.'
          )}
        />
      </Box>

      {isDesktop && (
        <Box
          p="md"
          style={{
            borderRadius: 12,
            background: 'var(--chatbox-background-secondary)',
            border: '1px solid var(--chatbox-border-primary)',
          }}
        >
          <Text size="sm" fw={600} mb={6}>
            {t('Agent hook configs')}
            {agentHookCount > 0 ? ` · ${agentHookCount}` : ''}
          </Text>
          <Stack gap={4}>
            {(agentRoots.length
              ? agentRoots
              : AGENT_HOOK_CONFIGS.map((r) => ({ path: r.path, origin: r.origin, exists: false }))
            ).map((root) => (
              <Text key={root.path} size="xs" c={root.exists ? 'chatbox-secondary' : 'chatbox-tertiary'} className="font-mono">
                {root.exists ? '●' : '○'} {root.origin}: {root.path}
              </Text>
            ))}
          </Stack>
        </Box>
      )}

      <Stack gap="sm">
        {hooks.map((hook) => (
          <Box
            key={hook.id}
            p="md"
            style={{
              border: '1px solid var(--chatbox-border-primary)',
              borderRadius: 12,
              background: 'var(--chatbox-background-secondary)',
            }}
          >
            <Flex justify="space-between" align="flex-start" gap="md">
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
            </Flex>
          </Box>
        ))}
        {hooks.length === 0 && (
          <Text size="sm" c="chatbox-tertiary">
            {t('No hooks found. Rescan agent configs on desktop or wait for builtins.')}
          </Text>
        )}
      </Stack>

      {audit.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            {t('Recent runs')}
          </Text>
          {audit.slice(0, 10).map((r) => (
            <Text key={r.id} size="xs" c="chatbox-tertiary" className="font-mono">
              {new Date(r.at).toLocaleTimeString()} · {r.event} · {r.hookId.slice(0, 40)}
              {r.blocked ? ' · BLOCKED' : ''} · exit {r.exitCode ?? '-'}
            </Text>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
