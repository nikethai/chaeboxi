import { Anchor, Box, Button, Container, Divider, Flex, Image, Stack, Text, Title } from '@mantine/core'
import {
  IconChevronRight,
  IconFileText,
  IconHome,
  IconMessage2,
  IconPencil,
} from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { Fragment, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { PRODUCT } from '@shared/product'
import BrandGithub from '@/components/icons/BrandGithub'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import Page from '@/components/layout/Page'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import useVersion from '@/hooks/useVersion'
import platform from '@/platform'
import iconPNG from '@/static/icon.png'

export const Route = createFileRoute('/about')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const version = useVersion()
  const isSmallScreen = useIsSmallScreen()

  return (
    <Page title={t('About')}>
      <Container size="md" p={0}>
        <Stack gap="xxl" px={isSmallScreen ? 'sm' : 'md'} py={isSmallScreen ? 'xl' : 'md'}>
          <Flex gap="xxl" p="md" className="rounded-lg bg-chatbox-background-secondary">
            <Image h={100} w={100} mah={'20vw'} maw={'20vw'} src={iconPNG} />
            <Stack flex={1} gap="xxs">
              <Flex justify="space-between" align="center" wrap="wrap" gap={isSmallScreen ? 'xs' : 'sm'} rowGap="xs">
                <Title order={5} lh={1.5} lineClamp={1} title={`${PRODUCT.name} v${version.version}`}>
                  {PRODUCT.name} {/\d/.test(version.version) ? `(v${version.version})` : ''}
                </Title>

                <Button
                  size="xs"
                  variant="default"
                  radius="xl"
                  className="flex-shrink-0"
                  onClick={() => platform.openLink(PRODUCT.releasesUrl)}
                >
                  {t('Check Update')}
                </Button>
              </Flex>
              <Text>{t('about-slogan')}</Text>
              <Text c="chatbox-tertiary">{t('about-introduction')}</Text>

              <Flex gap="sm">
                <Anchor size="sm" href={PRODUCT.privacyUrl} target="_blank" underline="hover" c="chatbox-tertiary">
                  {t('Privacy Policy')}
                </Anchor>
                <Anchor size="sm" href={PRODUCT.termsUrl} target="_blank" underline="hover" c="chatbox-tertiary">
                  {t('User Terms')}
                </Anchor>
              </Flex>
            </Stack>
          </Flex>

          <List>
            <ListItem
              icon={<BrandGithub className="w-full h-full" />}
              title={t('Github')}
              link={PRODUCT.githubRepo}
              value="nikethai/chaeboxi"
            />
          </List>

          <List>
            <ListItem icon={<IconHome className="w-full h-full" />} title={t('Homepage')} link={PRODUCT.homepage} />
            <ListItem
              icon={<IconPencil className="w-full h-full" />}
              title={t('Feedback')}
              link={PRODUCT.feedbackUrl}
            />
            <ListItem
              icon={<IconFileText className="w-full h-full" />}
              title={t('Changelog')}
              link={PRODUCT.changelogUrl}
            />
            <ListItem
              icon={<IconMessage2 className="w-full h-full" />}
              title={t('FAQs')}
              link={PRODUCT.githubRepo}
            />
          </List>
        </Stack>
      </Container>
    </Page>
  )
}

function List(props: { children: ReactElement | ReactElement[] }) {
  const children = Array.isArray(props.children) ? props.children : [props.children]
  return (
    <Stack gap={0} className="rounded-lg bg-chatbox-background-secondary">
      {children.map((child, index) => (
        <Fragment key={`child-${index}`}>
          {child}
          {index !== children.length - 1 && <Divider />}
        </Fragment>
      ))}
    </Stack>
  )
}

function ListItem({
  icon,
  title,
  link,
  value,
  right,
}: {
  icon: ReactElement
  title: string
  link?: string
  value?: string
  right?: ReactElement
}) {
  return (
    <Flex
      px="md"
      py="sm"
      gap="xs"
      align="center"
      className={link ? 'cursor-pointer' : ''}
      onClick={() => link && platform.openLink(link)}
      c="chatbox-tertiary"
    >
      <Box w={20} h={20} className="flex-shrink-0 " c="chatbox-primary">
        {icon}
      </Box>
      <Text flex={1} size="md">
        {title}
      </Text>

      {right ? (
        right
      ) : (
        <>
          {value && (
            <Text size="md" c="chatbox-tertiary">
              {value}
            </Text>
          )}
          {link && <ScalableIcon icon={IconChevronRight} size={20} className="!text-inherit" />}
        </>
      )}
    </Flex>
  )
}
