import { sentryVitePlugin } from '@sentry/vite-plugin'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'

const COMFYUI_PROXY_PREFIX = '/comfyui-proxy'
const COMFYUI_PROXY_TARGET_FALLBACK = 'http://127.0.0.1:8188'

function parseComfyUIProxyPath(requestPath?: string) {
  const match = requestPath?.match(/^\/comfyui-proxy\/([^/]+)(.*)$/)
  if (!match) return null

  try {
    const realHost = decodeURIComponent(match[1])
    const parsed = new URL(realHost)
    return {
      target: parsed.origin,
      path: match[2] || '/',
    }
  } catch (error) {
    console.error('[comfyui-proxy] Failed to parse host:', error)
    return null
  }
}

function comfyUIProxy(): Plugin {
  return {
    name: 'comfyui-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(`${COMFYUI_PROXY_PREFIX}/`)) {
          next()
          return
        }

        const parsedProxyPath = parseComfyUIProxyPath(req.url)
        if (!parsedProxyPath) {
          res.statusCode = 400
          res.end('Invalid ComfyUI proxy URL')
          return
        }

        try {
          const headers = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            if (!value || key.toLowerCase() === 'host') continue
            headers.set(key, Array.isArray(value) ? value.join(', ') : value)
          }

          const requestInit: RequestInit = {
            method: req.method,
            headers,
          }

          if (req.method && !['GET', 'HEAD'].includes(req.method.toUpperCase())) {
            const chunks: ArrayBuffer[] = []
            for await (const chunk of req) {
              const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
              chunks.push(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
            }
            requestInit.body = new Blob(chunks)
          }

          const response = await fetch(`${parsedProxyPath.target}${parsedProxyPath.path}`, requestInit)

          res.statusCode = response.status
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === 'transfer-encoding') return
            res.setHeader(key, value)
          })

          if (!response.body) {
            res.end()
            return
          }

          const body = Buffer.from(await response.arrayBuffer())
          res.end(body)
        } catch (error) {
          console.error('[comfyui-proxy] Request failed:', error)
          res.statusCode = 502
          res.end('Failed to reach ComfyUI server')
        }
      })
    },
  }
}

function injectBaseTag(): Plugin {
  return {
    name: 'inject-base-tag',
    transformIndexHtml() {
      return [
        {
          tag: 'base',
          attrs: { href: '/' },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

/** Plausible domain rewrite disabled — Chaeboxi ships without third-party analytics until owned accounts exist. */
function replacePlausibleDomain(): Plugin {
  return {
    name: 'replace-plausible-domain',
    transformIndexHtml(html) {
      return html
    },
  }
}

function dvhToVh(): Plugin {
  return {
    name: 'dvh-to-vh',
    transform(code, id) {
      if (id.endsWith('.css') || id.endsWith('.scss') || id.endsWith('.sass')) {
        return {
          code: code.replace(/(\\d+)dvh/g, '$1vh'),
          map: null,
        }
      }
      return null
    },
  }
}

const inferredRelease = process.env.SENTRY_RELEASE || process.env.npm_package_version || '0.0.0'
const inferredDist = process.env.SENTRY_DIST || undefined

process.env.SENTRY_RELEASE = inferredRelease
if (inferredDist) {
  process.env.SENTRY_DIST = inferredDist
}

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  const isWeb = process.env.CHATBOX_BUILD_PLATFORM === 'web'
  const tauriDevHost = process.env.TAURI_DEV_HOST
  const rendererRoot = path.resolve(__dirname, 'src/renderer')

  return {
    root: rendererRoot,
    resolve: {
      alias: {
        '@': rendererRoot,
        '@shared': path.resolve(__dirname, 'src/shared'),
      },
    },
    plugins: [
      TanStackRouterVite({
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory: './src/renderer/routes',
        generatedRouteTree: './src/renderer/routeTree.gen.ts',
      }),
      comfyUIProxy(),
      react({}),
      dvhToVh(),
      isWeb ? injectBaseTag() : undefined,
      isWeb ? replacePlausibleDomain() : undefined,
      // Telemetry disabled until Chaeboxi-owned Sentry project exists (require both token + explicit opt-in).
      process.env.SENTRY_AUTH_TOKEN && process.env.CHAEBOXI_SENTRY_ENABLED === '1'
        ? sentryVitePlugin({
            authToken: process.env.SENTRY_AUTH_TOKEN,
            org: process.env.SENTRY_ORG || 'sentry',
            project: process.env.SENTRY_PROJECT || 'chaeboxi',
            url: process.env.SENTRY_URL || 'https://sentry.io/',
            release: {
              name: inferredRelease,
              ...(inferredDist ? { dist: inferredDist } : {}),
            },
            sourcemaps: {
              assets: isProduction ? 'release/app/dist/renderer/**' : 'output/renderer/**',
            },
            telemetry: false,
          })
        : undefined,
    ].filter(Boolean),
    build: {
      outDir: path.resolve(__dirname, 'release/app/dist/renderer'),
      target: 'es2020',
      sourcemap: isProduction ? 'hidden' : true,
      minify: isProduction ? 'esbuild' : false,
      rollupOptions: {
        output: {
          entryFileNames: 'js/[name].[hash].js',
          chunkFileNames: 'js/[name].[hash].js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name?.endsWith('.css')) {
              return 'styles/[name].[hash][extname]'
            }
            if (/\.(woff|woff2|eot|ttf|otf)$/i.test(assetInfo.name || '')) {
              return 'fonts/[name].[hash][extname]'
            }
            if (/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(assetInfo.name || '')) {
              return 'images/[name].[hash][extname]'
            }
            return 'assets/[name].[hash][extname]'
          },
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@ai-sdk') || id.includes('ai/')) {
                return 'vendor-ai'
              }
              if (id.includes('@mantine') || id.includes('@tabler')) {
                return 'vendor-ui'
              }
              if (id.includes('mermaid') || id.includes('d3')) {
                return 'vendor-charts'
              }
            }
          },
        },
      },
    },
    css: {
      modules: {
        generateScopedName: '[name]__[local]___[hash:base64:5]',
      },
      postcss: path.resolve(__dirname, 'postcss.config.js'),
    },
    esbuild: {
      // Chrome 91 is the minimum WebView on Android API 30 emulators.
      // Use es2021 to avoid static class blocks (ES2022/Chrome 94+).
      target: 'es2021',
    },
    server: {
      host: tauriDevHost || '0.0.0.0',
      port: 1212,
      strictPort: true,
      hmr: tauriDevHost
        ? {
            protocol: 'ws',
            host: tauriDevHost,
            port: 1212,
          }
        : undefined,
    },
    define: {
      'process.type': '"renderer"',
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.CHATBOX_BUILD_TARGET': JSON.stringify(process.env.CHATBOX_BUILD_TARGET || 'unknown'),
      'process.env.CHATBOX_BUILD_PLATFORM': JSON.stringify(process.env.CHATBOX_BUILD_PLATFORM || 'unknown'),
      'process.env.USE_LOCAL_API': JSON.stringify(process.env.USE_LOCAL_API || ''),
      'process.env.USE_BETA_API': JSON.stringify(process.env.USE_BETA_API || ''),
    },
    optimizeDeps: {
      include: ['mermaid'],
      esbuildOptions: {
        target: 'es2015',
      },
    },
  }
})
