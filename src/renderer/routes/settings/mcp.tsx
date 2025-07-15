import { Box, Title } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { BuiltinServersSection } from '@/components/settings/mcp/BuiltinServersSection'
import CustomServersSection from '@/components/settings/mcp/CustomServersSection'
import { parseServerFromJson } from '@/components/settings/mcp/utils'

const searchSchema = z.object({
  install: z.string().optional(), // b64 encoded config
})

export const Route = createFileRoute('/settings/mcp')({
  component: RouteComponent,
  validateSearch: zodValidator(searchSchema),
})

function RouteComponent() {
  const { t } = useTranslation()
  const searchParams = Route.useSearch()

  const installConfig = useMemo(() => {
    if (!searchParams.install) {
      return undefined
    }
    try {
      return parseServerFromJson(atob(searchParams.install))
    } catch (err) {
      console.error(err)
      return undefined
    }
  }, [searchParams.install])

  return (
    <Box p="md">
      <Title order={5}>{t('MCP Settings')}</Title>
      <Box className="mt-8">
        <BuiltinServersSection />
      </Box>
      <Box className="mt-8">
        <CustomServersSection installConfig={installConfig} />
      </Box>
    </Box>
  )
}
