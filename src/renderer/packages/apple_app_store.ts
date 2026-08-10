import * as Sentry from '@sentry/react'
import { store as keypairStore } from './keypairs'
import { CHATBOX_BUILD_PLATFORM } from '../variables'
import NiceModal from '@ebay/nice-modal-react'

// (legacy comment)
let hasOpenAppStoreReviewPage = false

export async function tryOpenAppStoreReviewPage() {
  try {
    if (hasOpenAppStoreReviewPage) {
      return
    }
    if (await keypairStore.getItem<boolean>('appStoreRatingClicked')) {
      return
    }
    const lastAppStoreReviewTime = (await keypairStore.getItem<number>('lastAppStoreReviewTime')) || 0
    const now = Date.now()
    if (now - lastAppStoreReviewTime < 1000 * 60 * 60 * 24 * 30) {
      // (legacy comment removed)
      return
    }
    hasOpenAppStoreReviewPage = true
    await keypairStore.setItem('lastAppStoreReviewTime', now)
    NiceModal.show('app-store-rating')
  } catch (e) {
    console.error(e)
    Sentry.captureException(e)
  }
}

// App Store
export async function recordAppStoreRatingClick() {
  await keypairStore.setItem('appStoreRatingClicked', true)
}

let tickCount = 0
export function tickAfterMessageGenerated() {
  if (CHATBOX_BUILD_PLATFORM !== 'ios') {
    return
  }
  tickCount++
  if (tickCount % 4 === 0) {
    tryOpenAppStoreReviewPage()
  }
}
