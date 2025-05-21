import { useProviders } from '@/hooks/useProviders'
import { FC, PropsWithChildren, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Combobox,
  ComboboxProps,
  Divider,
  Drawer,
  Flex,
  FloatingPosition,
  Stack,
  Text,
  useCombobox,
} from '@mantine/core'
import { ModelProvider } from 'src/shared/types'
import ProviderIcon from './icons/ProviderIcon'
import { useNavigate } from '@tanstack/react-router'
import { useDisclosure } from '@mantine/hooks'
import { useIsSmallScreen } from '@/hooks/useScreenChange'

export type ModelSelectorProps = PropsWithChildren<
  {
    showAuto?: boolean
    onSelect?: (provider: ModelProvider | string, model: string) => void
    onDropdownOpen?: () => void
  } & ComboboxProps
>

export const ModelSelector: FC<ModelSelectorProps> = ({
  showAuto,
  onSelect,
  onDropdownOpen,
  children,
  ...comboboxProps
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { providers } = useProviders()

  const [search, setSearch] = useState('')
  const filteredProviders = useMemo(
    () =>
      providers.map((provider) => {
        const models = (provider.models || provider.defaultSettings?.models)?.filter(
          (model) =>
            provider.id.includes(search) ||
            provider.name.includes(search) ||
            model.nickname?.includes(search) ||
            model.modelId?.includes(search)
        )
        return {
          ...provider,
          models,
        }
      }),
    [providers, search]
  )
  const isEmpty = useMemo(
    () => filteredProviders.reduce((pre, cur) => pre + (cur.models?.length || 0), 0) === 0,
    [filteredProviders]
  )
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption()
      combobox.focusTarget()
      setSearch('')
    },

    onDropdownOpen: () => {
      combobox.focusSearchInput()
      onDropdownOpen?.()
    },
  })

  const groups = filteredProviders.map((provider) => {
    provider
    const options = provider.models?.map((model) => (
      <Combobox.Option
        value={`${provider.id}/${model.modelId}`}
        key={model.modelId}
        c={model.labels?.includes('recommended') ? 'chatbox-brand' : 'chatbox-primary'}
        className="flex items-center"
      >
        {model.nickname || model.modelId}
        {model.labels?.includes('pro') && (
          <Badge color="chatbox-brand" size="xs" variant="light" ml="xxs">
            Pro
          </Badge>
        )}
      </Combobox.Option>
    ))

    return (
      <Combobox.Group
        label={
          <Flex align="center" gap="xs">
            {!provider.isCustom && <ProviderIcon size={12} provider={provider.id} />}
            <Text c="chatbox-tertiary" size="xs" fw={600}>
              {provider.name}
            </Text>
          </Flex>
        }
        key={provider.id}
      >
        {options}
      </Combobox.Group>
    )
  })

  const handleOptionSubmit = (val: string) => {
    if (!val) {
      onSelect?.('', '')
    } else {
      const selectedProvider = providers.find((p) =>
        (p.models || p.defaultSettings?.models)?.find((m) => val === `${p.id}/${m.modelId}`)
      )
      const selectedModel = (selectedProvider?.models || selectedProvider?.defaultSettings?.models)?.find(
        (m) => val === `${selectedProvider.id}/${m.modelId}`
      )

      if (selectedProvider && selectedModel) {
        onSelect?.(selectedProvider.id, selectedModel.modelId)
      }
    }
    combobox.closeDropdown()
  }

  const isSmallScreen = useIsSmallScreen()
  const [opened, { open, close }] = useDisclosure(false)

  return isSmallScreen ? (
    <>
      <button onClick={open} className="border-none bg-transparent p-0 flex">
        {children}
      </button>

      <Drawer
        opened={opened}
        onClose={close}
        position="bottom"
        title={t('Select Model')}
        classNames={{
          header: '!p-sm !min-h-0',
          body: '!px-xs',
          content: '!rounded-tl-lg !rounded-tr-lg',
        }}
        // className=' min-h-0'
        styles={{
          title: {
            flex: 1,
            marginLeft: 28,
            textAlign: 'center',
            fontWeight: 600,
          },
        }}
        size="80%"
        zIndex={3000}
        trapFocus={false}
      >
        <Stack gap="md">
          {showAuto && (
            <Flex
              component="button"
              align="center"
              gap="xs"
              px="md"
              py="sm"
              className="rounded-md border-solid border border-[var(--mantine-color-chatbox-border-secondary-outline)] outline-none bg-transparent"
              onClick={() => {
                handleOptionSubmit('')
                close()
              }}
            >
              <Text span size="md" c="chatbox-secondary" lineClamp={1} className="flex-grow-0 flex-shrink text-left">
                Auto
              </Text>
            </Flex>
          )}
          {filteredProviders.map((provider) => (
            <Stack key={provider.id} gap="xs">
              <Flex align="center" gap="xs" py="3xs">
                {!provider.isCustom && <ProviderIcon size={12} provider={provider.id} />}
                <Text c="chatbox-tertiary" fw={600}>
                  {provider.name}
                </Text>
              </Flex>
              {provider.models?.map((model) => (
                <Flex
                  component="button"
                  key={model.modelId}
                  align="center"
                  gap="xs"
                  px="md"
                  py="sm"
                  className="border-solid border border-[var(--mantine-color-chatbox-border-secondary-outline)] outline-none bg-transparent rounded-md"
                  onClick={() => {
                    handleOptionSubmit(`${provider.id}/${model.modelId}`)
                    close()
                  }}
                >
                  <Text
                    span
                    size="md"
                    c={model.labels?.includes('recommended') ? 'chatbox-brand' : 'chatbox-secondary'}
                    lineClamp={1}
                    className="flex-grow-0 flex-shrink text-left"
                  >
                    {model.nickname || model.modelId}
                  </Text>
                  {model.labels?.includes('pro') && (
                    <Badge color="chatbox-brand" size="xs" variant="light" className="flex-grow-0 flex-shrink-0">
                      Pro
                    </Badge>
                  )}
                </Flex>
              ))}
            </Stack>
          ))}
        </Stack>
      </Drawer>
    </>
  ) : (
    <Combobox
      store={combobox}
      width={260}
      position="top"
      withinPortal={true}
      {...comboboxProps}
      onOptionSubmit={handleOptionSubmit}
    >
      <Combobox.Target targetType="button">
        <button onClick={() => combobox.toggleDropdown()} className="border-none bg-transparent p-0 flex">
          {children}
        </button>
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Search
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder={t('Search models')!}
        />
        <Combobox.Options mah="50vh" style={{ overflowY: 'auto' }}>
          {showAuto && (
            <Combobox.Option value={''} c="chatbox-primary">
              Auto
            </Combobox.Option>
          )}
          {isEmpty && !showAuto ? (
            <Stack gap="xs" pt="xs" align="center" className="overflow-hidden">
              <Text c="chatbox-tertiary" size="xs">
                {t('No eligible models available')}
              </Text>
              <Button variant="transparent" size="xs" onClick={() => navigate({ to: '/settings/provider' })}>
                {t('Click here to set up')}
              </Button>
            </Stack>
          ) : (
            groups
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}

export default ModelSelector
