import { expect, it } from 'vitest'
import { RETRY_DELAYS_MS } from './background'

it('RETRY_DELAYS_MS matches the roadmap', () => {
  expect([...RETRY_DELAYS_MS]).toEqual([10_000, 60_000, 300_000])
})
