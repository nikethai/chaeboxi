import { getBuiltinServerConfig } from '@/packages/mcp/builtin'
import { mcpController } from '@/packages/mcp/controller'
import { initSettingsStore } from '@/stores/settingsStore'
import { CHATBOX_BUILD_PLATFORM, NODE_ENV } from '@/variables'

const isAndroid = CHATBOX_BUILD_PLATFORM === 'android'

function monitorServerStatus() {
  setInterval(() => {
    console.debug(
      'MCP Servers:',
      JSON.stringify(
        Array.from(mcpController.servers.values()).map(({ config, instance: server }) => {
          return {
            id: config.id,
            name: config.name,
            status: server.status,
          }
        }),
        null,
        2
      )
    )
  }, 10000)
}

initSettingsStore()
  .then((settings) => {
    const { mcp } = settings
    let servers = [
      ...(mcp.enabledBuiltinServers || []).map((id) => getBuiltinServerConfig(id)).filter((s) => !!s),
      ...(mcp.servers || []), // user defined servers
    ]
    // Android: stdio transport requires child process spawning which is
    // not available. Filter to HTTP-only to avoid persistent failed states.
    if (isAndroid) {
      const before = servers.length
      servers = servers.filter((s) => s.transport.type !== 'stdio')
      if (before !== servers.length) {
        console.warn(`mcp bootstrap: skipped ${before - servers.length} stdio server(s) on Android`)
      }
    }
    console.info(`mcp bootstrap ${servers.length} servers`)
    mcpController.bootstrap(servers)
    if (NODE_ENV === 'development') {
      monitorServerStatus()
    }
  })
  .catch((err) => {
    console.error('mcp bootstrap error', err)
  })
