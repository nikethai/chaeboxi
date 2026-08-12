import { Combobox, type ComboboxProps, Divider, Text, useCombobox } from '@mantine/core'
import type { ModelProvider } from '@shared/types'
import { forwardRef, type PropsWithChildren, useMemo } from 'react'
import { useProviders } from '@/hooks/useProviders'
import { listAvailableImageModels } from '@/utils/available-image-models'

export type ImageModelSelectProps = PropsWithChildren<
  {
    onSelect?: (provider: ModelProvider, model: string) => void
  } & ComboboxProps
>

/**
 * Desktop Image Creator model picker.
 * Built from provider settings (including models fetched after login / Fetch),
 * not a hardcoded static catalog.
 */
export const ImageModelSelect = forwardRef<HTMLButtonElement, ImageModelSelectProps>(
  ({ onSelect, children, ...comboboxProps }, ref) => {
    const { providers } = useProviders()

    const modelGroups = useMemo(() => {
      const flat = listAvailableImageModels(providers)
      const groups: { label: string; providerId: string; models: { modelId: string; displayName: string }[] }[] = []
      for (const item of flat) {
        let group = groups.find((g) => g.providerId === item.providerId)
        if (!group) {
          group = { label: item.providerName, providerId: item.providerId, models: [] }
          groups.push(group)
        }
        if (!group.models.some((m) => m.modelId === item.modelId)) {
          group.models.push({ modelId: item.modelId, displayName: item.displayName })
        }
      }
      return groups
    }, [providers])

    const combobox = useCombobox({
      onDropdownClose: () => {
        combobox.resetSelectedOption()
        combobox.focusTarget()
      },
    })

    const handleOptionSubmit = (val: string) => {
      const sep = val.indexOf(':')
      if (sep <= 0) return
      const provider = val.slice(0, sep)
      const modelId = val.slice(sep + 1)
      onSelect?.(provider as ModelProvider, modelId)
      combobox.closeDropdown()
    }

    return (
      <Combobox
        store={combobox}
        width={280}
        position="top"
        withinPortal={true}
        {...comboboxProps}
        onOptionSubmit={handleOptionSubmit}
      >
        <Combobox.Target targetType="button">
          <button ref={ref} onClick={() => combobox.toggleDropdown()} className="border-none bg-transparent p-0 flex">
            {children}
          </button>
        </Combobox.Target>

        <Combobox.Dropdown className="!rounded-2xl !border-[var(--chatbox-border-primary)] !shadow-lg overflow-hidden">
          <Combobox.Options mah={400} style={{ overflowY: 'auto' }} className="p-1">
            {modelGroups.length === 0 ? (
              <Text size="sm" c="dimmed" px="sm" py="xs">
                No image models available. Sign in or fetch models in Settings → Providers.
              </Text>
            ) : (
              modelGroups.map((group, groupIndex) => (
                <div key={group.providerId}>
                  {groupIndex > 0 && <Divider my="xs" />}
                  <Combobox.Group
                    label={group.label}
                    classNames={{ groupLabel: '!text-xs !font-semibold !uppercase tracking-wide' }}
                  >
                    {group.models.map((model) => (
                      <Combobox.Option
                        key={`${group.providerId}:${model.modelId}`}
                        value={`${group.providerId}:${model.modelId}`}
                        className="!rounded-lg"
                      >
                        <Text size="sm">{model.displayName}</Text>
                      </Combobox.Option>
                    ))}
                  </Combobox.Group>
                </div>
              ))
            )}
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>
    )
  }
)

ImageModelSelect.displayName = 'ImageModelSelect'

export default ImageModelSelect
