import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { COMPARE_COLUMNS, COMPARE_ROWS } from './compare.ts'
import { FAQS } from './faq.ts'
import { faqPageNode, jsonLdGraph, softwareApplicationNode } from './json-ld.ts'
import { assetUrl, DEFAULT_DESCRIPTION, pageUrl, SITE_HOME } from './site.ts'

describe('site urls', () => {
  it('builds pages under the project Pages origin', () => {
    assert.equal(pageUrl('/chaeboxi/'), SITE_HOME)
    assert.equal(pageUrl('/chaeboxi/download/'), `${SITE_HOME}download/`)
    assert.equal(assetUrl('/chaeboxi/', 'og.png'), `${SITE_HOME}og.png`)
  })

  it('keeps a citable default description', () => {
    assert.match(DEFAULT_DESCRIPTION, /not Chatbox AI/)
    assert.match(DEFAULT_DESCRIPTION, /local-first/i)
  })
})

describe('faq and compare copy', () => {
  it('answers the independence and desktop-only questions', () => {
    assert.equal(FAQS.length, 5)
    assert.ok(FAQS.some((item) => /Chatbox/i.test(item.question) && /independent/i.test(item.answer)))
    assert.ok(FAQS.some((item) => /desktop/i.test(item.question) && /MCP stdio/i.test(item.answer)))
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
