import { SegmentedControl as MantineSegmentedControl, type SegmentedControlProps } from '@mantine/core'

export default function SegmentedControl({
  value,
  onChange,
  data,
  className,
  ...props
}: {
  value: string
  onChange: (value: string) => void
  data: { label: string; value: string }[]
} & Omit<SegmentedControlProps, 'value' | 'onChange' | 'data'>) {
  return (
    <MantineSegmentedControl
      value={value}
      onChange={onChange}
      data={data}
      fullWidth
      transitionDuration={200}
      transitionTimingFunction="ease"
      color="chatbox-brand"
      className={className}
      styles={{
        root: { padding: 0 },
        indicator: { borderRadius: 0 },
      }}
      {...props}
    />
  )
}
