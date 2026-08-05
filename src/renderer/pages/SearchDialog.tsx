import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import type { Session } from '@shared/types'
import { useAtomValue } from 'jotai'
import { Loader2, ScanSearch, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Message from '@/components/chat/Message'
import Mark from '@/components/common/Mark'
import { BlockCodeCollapsedStateProvider } from '@/components/Markdown'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { cn } from '@/lib/utils'
import { currentSessionIdAtom } from '@/stores/atoms'
import { searchSessions } from '@/stores/sessionHelpers'
import { useUIStore } from '@/stores/uiStore'
import * as scrollActions from '../stores/scrollActions'
import { switchCurrentSession } from '../stores/sessionActions'

type Props = {}

export default function SearchDialog(_props: Props) {
  const isSmallScreen = useIsSmallScreen()
  const open = useUIStore((s) => s.openSearchDialog)
  const setOpen = useUIStore((s) => s.setOpenSearchDialog)
  const globalOnly = useUIStore((s) => s.searchDialogGlobalOnly)
  const [mode, setMode] = useState<'command' | 'search-result'>('command')
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchResult, setSearchResult] = useState<Session[]>([])
  const { t } = useTranslation()
  const ref = useRef<HTMLInputElement>(null)

  const currentSessionId = useAtomValue(currentSessionIdAtom)

  useEffect(() => {
    if (open) {
      setMode('command')
      setSearchResult([])
      setLoading(false)
      const timer = window.setTimeout(() => {
        ref.current?.focus()
        ref.current?.select()
      }, 120)
      return () => window.clearTimeout(timer)
    }
  }, [open])

  const onSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMode('command')
    setSearchInput(e.currentTarget.value)
  }

  const onSearchClick = (flag: 'current-session' | 'global') => {
    if (!searchInput.trim()) return
    setMode('search-result')
    setSearchResult([])
    setLoading(true)
    if (flag === 'current-session' && !currentSessionId) {
      setLoading(false)
      return
    }
    searchSessions(searchInput, flag === 'current-session' ? (currentSessionId ?? undefined) : undefined, (batches) => {
      setSearchResult((prev) => [...prev, ...batches])
    })
    setLoading(false)
    ref.current?.select()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchInput.trim()) {
      e.preventDefault()
      if (globalOnly || mode === 'search-result') {
        onSearchClick('global')
      }
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const placeholder = globalOnly
    ? `${t('Search conversations')}...`
    : `${t('Type a command or search')}...`

  return (
    <Dialog
      style={{ display: open ? 'block' : 'none' }}
      open={true}
      onClose={() => setOpen(false)}
      fullWidth
      maxWidth={mode === 'search-result' ? 'md' : 'sm'}
      slotProps={{
        backdrop: {
          className: 'search-dialog-backdrop',
        },
      }}
      PaperProps={{
        className: 'search-dialog-paper',
        elevation: 0,
        sx: {
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: 'var(--chatbox-background-primary)',
          border: '1px solid var(--chatbox-border-primary)',
          boxShadow:
            '0 24px 48px -12px rgba(0, 0, 0, 0.18), 0 8px 16px -8px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.03)',
        },
      }}
    >
      <DialogContent
        className="search-dialog-content"
        sx={{
          padding: 0,
          '&.MuiDialogContent-root': { paddingTop: 0 },
        }}
      >
        <Command shouldFilter={false} filter={() => 1} className="search-dialog-command bg-transparent">
          <div className="search-dialog-input-row" cmdk-input-wrapper="">
            <Search className="search-dialog-input-icon" aria-hidden />
            <input
              ref={ref}
              autoFocus={!isSmallScreen}
              value={searchInput}
              onChange={onSearchInput}
              onKeyDown={onKeyDown}
              className="search-dialog-input"
              placeholder={placeholder}
              aria-label={placeholder}
            />
          </div>

          {mode === 'command' && !globalOnly && (
            <CommandList className="search-dialog-list">
              <CommandEmpty className="search-dialog-empty">{t('No results found')}</CommandEmpty>
              <CommandGroup heading={t('Search')} className="search-dialog-group">
                <CommandItem
                  value="search-current-session"
                  className="search-dialog-item"
                  onSelect={() => onSearchClick('current-session')}
                >
                  <ScanSearch className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                  <span>
                    {t('Search in Current Conversation')}
                    {searchInput.length > 0 ? ` "${searchInput}"` : ''}
                  </span>
                </CommandItem>
                <CommandItem
                  value="search-global"
                  className="search-dialog-item"
                  onSelect={() => onSearchClick('global')}
                >
                  <ScanSearch className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                  <span>
                    {t('Search All Conversations')}
                    {searchInput.length > 0 ? ` "${searchInput}"` : ''}
                  </span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          )}

          {mode === 'command' && globalOnly && (
            <div className="search-dialog-hint">
              <p>{t('Press Enter to search all conversations')}</p>
            </div>
          )}

          {mode === 'search-result' && loading && (
            <div className="search-dialog-loading">
              <Loader2 className="h-5 w-5 animate-spin opacity-60" />
              <span>{t('Searching')}…</span>
            </div>
          )}

          {mode === 'search-result' && !loading && (
            <BlockCodeCollapsedStateProvider defaultCollapsed={true}>
              <Mark marks={[searchInput]}>
                <CommandList className="search-dialog-list search-dialog-list-results">
                  <CommandEmpty className="search-dialog-empty">{t('No results found')}</CommandEmpty>
                  {searchResult.map((result, i) => (
                    <CommandGroup
                      key={result.id}
                      heading={`${t('chat')} "${result.name}":`}
                      className={cn('search-dialog-group', '[&_[cmdk-group-heading]]:font-semibold')}
                    >
                      {result.messages.map((message, j) => (
                        <CommandItem
                          key={`${result.id}-${message.id}`}
                          value={`result-${i}-${j}-${message.id}`}
                          className="search-dialog-item search-dialog-result-item"
                          onSelect={() => {
                            const targetSessionId = result.id
                            const targetMessageId = message.id
                            const needsSwitch = currentSessionId !== targetSessionId

                            if (needsSwitch) {
                              switchCurrentSession(targetSessionId)
                            }

                            setOpen(false)

                            const tryScroll = async (attempt = 0, maxAttempts = 10) => {
                              const delay = needsSwitch ? (attempt === 0 ? 300 : 200) : 100
                              await new Promise((resolve) => setTimeout(resolve, delay))

                              const success = await scrollActions.scrollToMessage(targetSessionId, targetMessageId)

                              if (!success && attempt < maxAttempts) {
                                tryScroll(attempt + 1, maxAttempts)
                              }
                            }

                            tryScroll()
                          }}
                        >
                          <span className="hidden">
                            {result.id}-{message.id}-{i}-{j}
                          </span>
                          <Message
                            id={message.id}
                            sessionId={result.id}
                            sessionType={result.type || 'chat'}
                            msg={message}
                            className="w-full"
                            buttonGroup="none"
                            small
                            assistantAvatarKey={result.assistantAvatarKey}
                            sessionPicUrl={result.picUrl}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Mark>
            </BlockCodeCollapsedStateProvider>
          )}
        </Command>
      </DialogContent>
    </Dialog>
  )
}
