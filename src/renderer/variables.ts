// Vite define ， process.env.XXX

export const CHATBOX_BUILD_TARGET = (process.env.CHATBOX_BUILD_TARGET || 'unknown') as 'unknown' | 'mobile_app'
export const CHATBOX_BUILD_PLATFORM = (process.env.CHATBOX_BUILD_PLATFORM || 'unknown') as
  | 'unknown'
  | 'ios'
  | 'android'
  | 'web'

// Local/beta overrides for legacy cloud (dev only; disabled by default in product.ts)
export const USE_LOCAL_API = process.env.USE_LOCAL_API || ''
export const USE_BETA_API = process.env.USE_BETA_API || ''

export const USE_LOCAL_CHATBOX = process.env.USE_LOCAL_CHATBOX || ''
export const USE_BETA_CHATBOX = process.env.USE_BETA_CHATBOX || ''

export const NODE_ENV = process.env.NODE_ENV || 'development'
