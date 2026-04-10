import { Accordion, Badge, Button, Flex, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { IconCircleCheck, IconX } from '@tabler/icons-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from '@/components/common/ScalableIcon'

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'error'

interface GatewayHelloOk {
  type: 'hello-ok'
  stateVersion: string
  uptimeMs: number
  features: string[]
  policies: Record<string, string>
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ${hours % 24}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
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
  const [gatewayInfo, setGatewayInfo] = useState<GatewayHelloOk | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleTestConnection = useCallback(async () => {
    setConnectionStatus('testing')
    setGatewayInfo(null)
    setErrorMessage(null)

    // Normalize gateway URL - remove trailing slashes and /v1 path
    const baseUrl = gatewayUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
    const wsUrl = baseUrl.replace(/^http/, 'ws')

    return new Promise<void>((resolve) => {
      let ws: WebSocket | null = null
      let timeoutId: ReturnType<typeof setTimeout> | null = null

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        if (ws) {
          ws.close()
        }
      }

      // Timeout after 10 seconds
      timeoutId = setTimeout(() => {
        cleanup()
        setConnectionStatus('error')
        setErrorMessage(t('Connection timed out'))
        resolve()
      }, 10000)

      try {
        ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          // Send hello handshake
          const handshake = {
            type: 'hello',
            version: '1.0',
            auth: authToken || undefined,
          }
          ws!.send(JSON.stringify(handshake))
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)

            if (data.type === 'hello-ok') {
              cleanup()
              setConnectionStatus('connected')
              setGatewayInfo(data as GatewayHelloOk)
              resolve()
            } else if (data.type === 'error') {
              cleanup()
              setConnectionStatus('error')
              setErrorMessage(data.message || t('Connection failed'))
              resolve()
            }
          } catch {
            cleanup()
            setConnectionStatus('error')
            setErrorMessage(t('Invalid response from gateway'))
            resolve()
          }
        }

        ws.onerror = () => {
          cleanup()
          setConnectionStatus('error')
          setErrorMessage(t('WebSocket connection failed'))
          resolve()
        }

        ws.onclose = () => {
          if (connectionStatus === 'testing') {
            cleanup()
            setConnectionStatus('error')
            setErrorMessage(t('Connection closed unexpectedly'))
            resolve()
          }
        }
      } catch (err) {
        cleanup()
        setConnectionStatus('error')
        setErrorMessage(err instanceof Error ? err.message : t('Connection failed'))
        resolve()
      }
    })
  }, [gatewayUrl, authToken, t])

  return (
    <Stack gap="lg">
      {/* Gateway URL */}
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

      {/* Auth Token */}
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

      {/* Test Connection */}
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

      {/* Gateway Info */}
      {gatewayInfo && (
        <Stack gap="xxs">
          <Text span fw="600">
            {t('Gateway Info')}
          </Text>
          <Accordion variant="contained" defaultValue={['uptime', 'features']}>
            <Accordion.Item value="uptime">
              <Accordion.Control>
                <Flex justify="space-between" pr="md">
                  <Text size="sm">{t('Uptime')}</Text>
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
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="features">
              <Accordion.Control>
                <Text size="sm">{t('Features')}</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  {gatewayInfo.features.length > 0 ? (
                    gatewayInfo.features.map((feature, index) => (
                      <Badge key={index} variant="light" size="sm">
                        {feature}
                      </Badge>
                    ))
                  ) : (
                    <Text size="xs" c="chatbox-secondary">
                      {t('No features available')}
                    </Text>
                  )}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            {Object.keys(gatewayInfo.policies).length > 0 && (
              <Accordion.Item value="policies">
                <Accordion.Control>
                  <Text size="sm">{t('Policies')}</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    {Object.entries(gatewayInfo.policies).map(([key, value]) => (
                      <Flex key={key} justify="space-between">
                        <Text size="xs" c="chatbox-secondary">
                          {key}
                        </Text>
                        <Text size="xs">{value}</Text>
                      </Flex>
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            )}
          </Accordion>
        </Stack>
      )}
    </Stack>
  )
}
