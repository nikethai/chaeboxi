import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { COMPARE_COLUMNS, COMPARE_ROWS } from './compare.ts'
import { AUDIENCE_NOT, DESKTOP_TOOLS, FIRST_MINUTES, HERO_SUB, WHY_SECTIONS } from './copy.ts'
import { FAQS } from './faq.ts'
import { faqPageNode, jsonLdGraph, softwareApplicationNode } from './json-ld.ts'
import { assetUrl, DEFAULT_DESCRIPTION, pageUrl, SITE_HOME } from './site.ts'

describe('site urls', () => {
  it('builds pages under the project Pages origin', () => {
    assert.equal(pageUrl('/chaeboxi/'), SITE_HOME)
    assert.equal(pageUrl('/chaeboxi/download/'), `${SITE_HOME}download/`)
    assert.equal(pageUrl('/chaeboxi/why/'), `${SITE_HOME}why/`)
    assert.equal(assetUrl('/chaeboxi/', 'og.png'), `${SITE_HOME}og.png`)
  })

  it('keeps a citable default description', () => {
    assert.match(DEFAULT_DESCRIPTION, /not Chatbox AI/)
    assert.match(DEFAULT_DESCRIPTION, /local-first/i)
  })
})

describe('faq and compare copy', () => {
  it('answers the independence and desktop-only questions', () => {
    assert.equal(FAQS.length, 7)
    assert.ok(FAQS.some((item) => /Chatbox/i.test(item.question) && /independent/i.test(item.answer)))
    assert.ok(FAQS.some((item) => /desktop/i.test(item.question) && /MCP stdio/i.test(item.answer)))
    assert.ok(FAQS.some((item) => /after I download/i.test(item.question) && /Ollama/i.test(item.answer)))
  })

  it('keeps landing copy factual and desktop-scoped', () => {
    assert.match(HERO_SUB, /not Chatbox AI/)
    assert.match(AUDIENCE_NOT.body, /subscription|hosted/i)
    assert.equal(DESKTOP_TOOLS.length, 6)
    assert.ok(DESKTOP_TOOLS.every((card) => /desktop/i.test(`${card.title} ${card.body}`)))
    assert.equal(FIRST_MINUTES.length, 3)
    const why = WHY_SECTIONS.map((section) => section.paragraphs.join(' ')).join(' ')
    assert.match(why, /NOTICE/)
    assert.doesNotMatch(why, /testimonial|customer said|5 stars/i)
  })

  it('does not invent Chatbox feature claims', () => {
    assert.deepEqual(COMPARE_COLUMNS, ['Chaeboxi', 'Chatbox AI', 'Hosted ChatGPT'])
    assert.equal(COMPARE_ROWS.length, 6)
    const chatboxCells = COMPARE_ROWS.map((row) => row.values[1]).join(' ')
    assert.doesNotMatch(chatboxCells, /MCP|computer use|keychain/i)
  })
})

describe('json-ld', () => {
  it('emits Organization, WebSite, app, and FAQ nodes that match visible facts', () => {
    const graph = jsonLdGraph([softwareApplicationNode(), faqPageNode()])
    const types = graph['@graph'].map((node) => node['@type'])
    assert.deepEqual(types, ['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage'])
    const app = softwareApplicationNode()
    assert.equal(app.offers.price, '0')
    assert.equal(app.applicationCategory, 'UtilitiesApplication')
    assert.equal(app.downloadUrl, `${SITE_HOME}download/`)
    const faq = faqPageNode()
    assert.equal(faq.mainEntity.length, FAQS.length)
    assert.equal(faq.mainEntity[0].name, FAQS[0].question)
    assert.equal(faq.mainEntity[0].acceptedAnswer.text, FAQS[0].answer)
  })
})
