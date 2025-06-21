import { app } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createAfetch } from '../../shared/request/request'
import { ModelDependencies, ApiRequestOptions } from '../../shared/types/adapters'
import { isLocalHost } from '../../shared/utils/network_utils'
import { getSettings } from '../store-node'
import { sentry } from './sentry'

async function createMainFetchWithProxy(platformInfo: { type: string; platform: string; os: string; version: string }) {
  return async function fetchWithProxy(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let targetUrl = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url
    let headers = new Headers(init?.headers)

    // 检查是否需要使用代理
    const settings = getSettings()
    const shouldUseProxy = settings.proxy && !isLocalHost(targetUrl)

    if (shouldUseProxy) {
      // 使用 Chatbox 的代理服务
      headers.set('CHATBOX-TARGET-URI', targetUrl)
      headers.set('CHATBOX-PLATFORM', platformInfo.type)
      headers.set('CHATBOX-VERSION', platformInfo.version)
      targetUrl = 'https://cors-proxy.chatboxai.app/proxy-api/completions'
    }

    return fetch(targetUrl, {
      ...init,
      headers,
    })
  }
}

export async function createModelDependencies(): Promise<ModelDependencies> {
  // Main层的平台信息
  const platformInfo = {
    type: 'desktop',
    platform: process.platform,
    os: os.platform(),
    version: app.getVersion(),
  }

  const afetch = createAfetch(platformInfo)
  const fetchWithProxy = await createMainFetchWithProxy(platformInfo)

  return {
    storage: {
      async saveImage(folder: string, dataUrl: string): Promise<string> {
        // 将图片写入 /tmp 目录下的临时文件
        const fileName = `chatbox_${folder}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.img`
        const filePath = path.join(os.tmpdir(), fileName)
        // 支持 data URL 或纯 base64
        let base64Data = dataUrl
        if (base64Data.startsWith('data:')) {
          base64Data = base64Data.substring(base64Data.indexOf(',') + 1)
        }
        await fs.promises.writeFile(filePath, base64Data, 'base64')
        return filePath
      },
      async getImage(storageKey: string): Promise<string> {
        // 读取临时文件内容并返回 data URL
        const base64Data = await fs.promises.readFile(storageKey, 'base64')
        // 尝试推断 mimeType，默认 image/png
        const mimeType = 'image/png'
        return `data:${mimeType};base64,${base64Data}`
      },
    },
    request: {
      fetchWithOptions: async (
        url: string,
        init?: RequestInit,
        options?: { retry?: number; parseChatboxRemoteError?: boolean }
      ): Promise<Response> => {
        return afetch(url, init, options)
      },
      async apiRequest(options: ApiRequestOptions): Promise<any> {
        const fetchFn = options.useProxy ? fetchWithProxy : fetch
        const response = await fetchFn(options.url, {
          method: options.method || 'GET',
          headers: options.headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: options.signal,
        })
        return response
      },
      fetchWithProxy: fetchWithProxy,
    },
    sentry,
    getRemoteConfig: () => {
      // Main层的远程配置，暂时不需要用到
      throw new Error('Not implemented')
    },
  }
}
