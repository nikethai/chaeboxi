import { FAQS } from './faq.ts'
import { DEFAULT_DESCRIPTION, SITE_HOME, SITE_NAME } from './site.ts'

export const ORG_ID = `${SITE_HOME}#org`
export const WEBSITE_ID = `${SITE_HOME}#website`
export const APP_ID = `${SITE_HOME}#app`

export function organizationNode() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    url: SITE_HOME,
    logo: `${SITE_HOME}favicon.png`,
    sameAs: ['https://github.com/nikethai/chaeboxi'],
  }
}

export function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: SITE_HOME,
    description: DEFAULT_DESCRIPTION,
    inLanguage: 'en',
    publisher: { '@id': ORG_ID },
  }
}

export function softwareApplicationNode() {
  return {
    '@type': 'SoftwareApplication',
    '@id': APP_ID,
    name: SITE_NAME,
    url: SITE_HOME,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'macOS, Windows, Linux',
    license: 'https://www.gnu.org/licenses/gpl-3.0.html',
    isAccessibleForFree: true,
    image: `${SITE_HOME}screenshot-shell.png`,
    downloadUrl: `${SITE_HOME}download/`,
    description: DEFAULT_DESCRIPTION,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    publisher: { '@id': ORG_ID },
  }
}

export function faqPageNode() {
  return {
    '@type': 'FAQPage',
    '@id': `${SITE_HOME}#faq`,
    mainEntity: FAQS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

export function jsonLdGraph(extra: Record<string, unknown>[] = []) {
  return {
    '@context': 'https://schema.org',
    '@graph': [organizationNode(), websiteNode(), ...extra],
  }
}
