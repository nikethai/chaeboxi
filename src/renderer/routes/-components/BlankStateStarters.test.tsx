/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react'
import BlankStateStarters from './BlankStateStarters'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('BlankStateStarters', () => {
  it('prefills the selected starter so a first-time user can begin in the composer', () => {
    const onSelect = vi.fn()
    render(<BlankStateStarters onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Help me plan something' }))

    expect(onSelect).toHaveBeenCalledWith('Help me plan ')
  })
})
