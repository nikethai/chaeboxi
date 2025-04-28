import * as Sentry from '@sentry/react'
import { useAtomValue } from 'jotai'
import { StrictMode, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './i18n'
import { cn, getLogger } from './lib/utils'
import reportWebVitals from './reportWebVitals'
import { initData } from './setup/init_data'
import './static/globals.css'
import './static/index.css'
import { initLogAtom } from './stores/atoms/utilAtoms'
import * as migration from './stores/migration'
import { CHATBOX_BUILD_PLATFORM, CHATBOX_BUILD_TARGET } from './variables'
import { router } from './router'
import { RouterProvider } from '@tanstack/react-router'

const log = getLogger('index')

// ==========执行初始化==============
async function initializeApp() {
  log.info('initializeApp')
  // 按需加载 polyfill
  await import('./setup/load_polyfill')
  log.info('load_polyfill done')

  // Sentry 初始化
  await import('./setup/sentry_init')
  log.info('sentry_init done')

  // GA4 初始化
  await import('./setup/ga_init')
  log.info('ga_init done')

  // 引入保护代码
  await import('./setup/protect')
  log.info('protect done')

  // 引入移动端安全区域代码，主要为了解决异形屏幕的问题
  if (CHATBOX_BUILD_TARGET === 'mobile_app' && CHATBOX_BUILD_PLATFORM === 'ios') {
    await import('./setup/mobile_safe_area')
    log.info('mobile_safe_area done')
  }

  // 解决移动端浏览器地址栏导致高度计算问题
  await import('./setup/mobile_browser_viewport_height')
  log.info('mobile_browser_viewport_height done')

  // 初始化数据
  await initData()
  log.info('initData done')

  // 数据迁移

  try {
    await migration.migrate()
    log.info('migrate done')
  } catch (e) {
    log.error('migrate error', e)
    Sentry.captureException(e as Error)
  }

  // 最后执行 storage 清理，清理不 block 进入UI
  import('./setup/storage_clear')
}

// ==========渲染节点==============

function InitPage() {
  const log = useAtomValue(initLogAtom)
  const [showLoadingLog, setShowLoadingLog] = useState(false)
  return (
    <div className={cn('flex flex-col justify-center items-center', showLoadingLog ? 'pt-3' : 'h-80')}>
      <div className={cn('flex flex-col items-center', showLoadingLog ? 'hidden' : '')}>
        <h1 className="font-roboto font-bold text-3xl text-gray-800 m-0">Chatbox</h1>
        <p className="font-roboto font-normal text-gray-400 opacity-40">loading...</p>
      </div>
      <div className="mt-4">
        <div
          role="button"
          tabIndex={0}
          className="px-4 py-2 rounded-md cursor-pointer select-none text-sm text-blue-600 hover:bg-blue-100 active:bg-blue-200"
          onClick={() => setShowLoadingLog(!showLoadingLog)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setShowLoadingLog(!showLoadingLog)
              e.preventDefault()
            }
          }}
        >
          {showLoadingLog ? 'Hide Loading Log' : 'Show Loading Log'}
        </div>
      </div>
      {/* 倒叙展示，能够看到最新的日志 */}
      {showLoadingLog && <pre className="whitespace-pre-wrap">{[...log].reverse().join('\n')}</pre>}
    </div>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
root.render(
  <StrictMode>
    <InitPage />
  </StrictMode>
)

// 等待初始化完成后再渲染
initializeApp()
  .then(() => {
    root.render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>
    )
  })
  .catch((e) => {
    root.render(
      <StrictMode>
        <div className="pt-12 pl-3">
          <div>Error: {e.message}</div>
          <pre>{e.stack}</pre>
        </div>
      </StrictMode>
    )
  })

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
