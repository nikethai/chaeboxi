import type React from 'react'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import { useTranslation } from 'react-i18next'

export default function TextFieldReset(
  props: {
    defaultValue?: string
    value: string
    onValueChange: (value: string) => void
  } & Omit<React.ComponentProps<typeof TextField>, 'defaultValue' | 'value' | 'onChange'>
) {
  const { t } = useTranslation()
  const { onValueChange, defaultValue = '', value, ...rest } = props
  const handleReset = () => onValueChange(defaultValue)
  const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
  }
  return (
    <TextField
      {...rest}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      InputProps={
        defaultValue === props.value
          ? {}
          : {
              endAdornment: (
                <Button variant="text" onClick={handleReset} onMouseDown={handleMouseDown}>
                  {t('reset')}
                </Button>
              ),
            }
      }
      helperText={props.helperText}
    />
  )
}
