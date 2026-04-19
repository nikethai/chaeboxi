import { CHATBOX_BUILD_PLATFORM } from '@/variables'

export const FORCE_ENABLE_DEV_PAGES = process.env.NODE_ENV === 'development' && CHATBOX_BUILD_PLATFORM !== 'android'