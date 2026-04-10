import { Accordion, Badge, Button, Flex, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { IconCircleCheck, IconX } from '@tabler/icons-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { OpenClawGatewayClient } from '@shared/openclaw/gateway'
import type { GatewayInfo } from '@shared/openclaw/gateway/types'

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'error'

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

export function OpenClawGatewaySettings({
  gatewayUrl,
  authToken,
  onGatewayUrlChange,
  onAuthTokenChange,
}: {
  gatewayUrl: string
  authToken: string
  onGatewayUrlChange: (value: string) => void
  onAuthTokenChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle')
  const [gatewayInfo, setGatewayInfo] = useState<GatewayInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const testClientRef = useRef<OpenClawGatewayClient | null>(null)

  const handleTestConnection = useCallback(async () => {
    // Clean up previous test client
    testClientRef.current?.disconnect()

    setConnectionStatus('testing')
    setGatewayInfo(null)
    setErrorMessage(null)

    const baseUrl = gatewayUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
    const client = new OpenClawGatewayClient(baseUrl, authToken ? { token: authToken } : {})
    testClientRef.current = client

    try {
      await client.connect()
      setConnectionStatus('connected')
      setGatewayInfo(client.getGatewayInfo())
    } catch (err) {
      setConnectionStatus('error')
      setErrorMessage(err instanceof Error ? err.message : t('Connection failed'))
    } finally {
      client.disconnect()
      testClientRef.current = null
    }
  }, [gatewayUrl, authToken, t])

  return (
    <Stack gap="lg">
      <Stack gap="xxs">
        <Text span fw="600">
          {t('Gateway URL')}
        </Text>
        <TextInput
          flex={1}
          value={gatewayUrl}
          placeholder="http://127.0.0.1:18789"
          onChange={(e) => onGatewayUrlChange(e.currentTarget.value)}
        />
        <Text size="xs" c="chatbox-secondary">
          {t('OpenClaw gateway server URL')}
        </Text>
      </Stack>

      <Stack gap="xxs">
        <Text span fw="600">
          {t('Auth Token')}
        </Text>
        <PasswordInput
          flex={1}
          value={authToken}
          placeholder={t('Optional authentication token')}
          onChange={(e) => onAuthTokenChange(e.currentTarget.value)}
        />
        <Text size="xs" c="chatbox-secondary">
          {t('Optional token for gateway authentication')}
        </Text>
      </Stack>

      <Stack gap="xxs">
        <Flex justify="space-between" align="center">
          <Text span fw="600">
            {t('Connection Status')}
          </Text>
          <Button variant="light" size="sm" onClick={handleTestConnection} loading={connectionStatus === 'testing'}>
            {t('Test Connection')}
          </Button>
        </Flex>

        <Flex gap="xs" align="center">
          {connectionStatus === 'connected' && (
            <Badge color="green" variant="light" leftSection={<ScalableIcon icon={IconCircleCheck} size={12} />}>
              {t('Connected')}
            </Badge>
          )}
          {connectionStatus === 'error' && (
            <Badge color="red" variant="light" leftSection={<ScalableIcon icon={IconX} size={12} />}>
              {t('Disconnected')}
            </Badge>
          )}
          {connectionStatus === 'testing' && (
            <Badge color="yellow" variant="light">
              {t('Testing...')}
            </Badge>
          )}
        </Flex>

        {errorMessage && (
          <Text size="xs" c="chatbox-error">
            {errorMessage}
          </Text>
        )}
      </Stack>

      {gatewayInfo && (
        <Stack gap="xxs">
          <Text span fw="600">
            {t('Gateway Info')}
          </Text>
          <Accordion variant="contained" defaultValue={['info']}>
            <Accordion.Item value="info">
              <Accordion.Control>
                <Flex justify="space-between" pr="md">
                  <Text size="sm">{t('Gateway Details')}</Text>
                  <Text size="sm" c="chatbox-secondary">
                    {formatUptime(gatewayInfo.uptimeMs)}
                  </Text>
                </Flex>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  <Flex justify="space-between">
                    <Text size="xs" c="chatbox-secondary">
                      {t('State Version')}
                    </Text>
                    <Text size="xs">{gatewayInfo.stateVersion}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text size="xs" c="chatbox-secondary">
                      {t('Uptime')}
                    </Text>
                    <Text size="xs">{gatewayInfo.uptimeMs.toLocaleString()}ms</Text>
                  </Flex>
                  {gatewayInfo.features && (
                    <Flex gap={4} wrap="wrap" mt="xs">
                      {gatewayInfo.features.streaming && (
                        <Badge variant="light" size="xs">
                          streaming
                        </Badge>
                      )}
                      {gatewayInfo.features.agentInvocation && (
                        <Badge variant="light" size="xs">
                          agents
                        </Badge>
                      )}
                      {gatewayInfo.features.sessionManagement && (
                        <Badge variant="light" size="xs">
                          sessions
                        </Badge>
                      )}
                      {gatewayInfo.features.toolExecution && (
                        <Badge variant="light" size="xs">
                          tools
                        </Badge>
                      )}
                    </Flex>
                  )}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Stack>
      )}
    </Stack>
  )
}
