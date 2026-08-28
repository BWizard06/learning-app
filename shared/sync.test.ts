import { describe, expect, it } from 'vitest'
import { classifyResponse, isExpectedBody, looksLikeJson, toPlainPayload } from './sync'

const ID = '01a04792-62ad-7167-9bd7-af474e9a2f37'
const JSON_TYPE = 'application/json'

function res(status: number, contentType: string | null = JSON_TYPE) {
  return { ok: status >= 200 && status < 300, status, contentType }
}

describe('looksLikeJson', () => {
  it('accepts a charset suffix', () => {
    expect(looksLikeJson('application/json; charset=utf-8')).toBe(true)
  })

  it('rejects html and a missing header', () => {
    expect(looksLikeJson('text/html')).toBe(false)
    expect(looksLikeJson(null)).toBe(false)
  })
})

describe('isExpectedBody', () => {
  it('requires the id to match the session we sent', () => {
    expect(isExpectedBody({ id: ID, created: true }, ID)).toBe(true)
    expect(isExpectedBody({ id: 'other', created: true }, ID)).toBe(false)
  })

  it('rejects arrays, null and missing fields', () => {
    expect(isExpectedBody([], ID)).toBe(false)
    expect(isExpectedBody(null, ID)).toBe(false)
    expect(isExpectedBody({ id: ID }, ID)).toBe(false)
  })
})

describe('classifyResponse, the rule that protects results', () => {
  it('keeps the entry when Authelia answers 401', () => {
    const verdict = classifyResponse(res(401), null, ID)
    expect(verdict.outcome).toBe('unauthenticated')
    expect(verdict.removeFromOutbox).toBe(false)
  })

  it('keeps the entry when a redirect delivered the login page as html', () => {
    const verdict = classifyResponse(res(200, 'text/html'), '<!doctype html>', ID)
    expect(verdict.outcome).toBe('unauthenticated')
    expect(verdict.removeFromOutbox).toBe(false)
  })

  it('keeps the entry when the server errors', () => {
    expect(classifyResponse(res(503), {}, ID).removeFromOutbox).toBe(false)
    expect(classifyResponse(res(500), {}, ID).removeFromOutbox).toBe(false)
  })

  it('keeps the entry when the body does not match the session we sent', () => {
    const verdict = classifyResponse(res(201), { id: 'someone-else', created: true }, ID)
    expect(verdict.outcome).toBe('retry')
    expect(verdict.removeFromOutbox).toBe(false)
  })

  it('keeps the entry when a 200 carries no usable body', () => {
    expect(classifyResponse(res(200), null, ID).removeFromOutbox).toBe(false)
    expect(classifyResponse(res(200), 'ok', ID).removeFromOutbox).toBe(false)
    expect(classifyResponse(res(200), {}, ID).removeFromOutbox).toBe(false)
  })

  it('removes the entry only on a real, matching, json confirmation', () => {
    const verdict = classifyResponse(res(201), { id: ID, created: true }, ID)
    expect(verdict.outcome).toBe('stored')
    expect(verdict.removeFromOutbox).toBe(true)
  })

  it('treats an already stored session as done, so a retry settles', () => {
    const verdict = classifyResponse(res(200), { id: ID, created: false }, ID)
    expect(verdict.outcome).toBe('duplicate')
    expect(verdict.removeFromOutbox).toBe(true)
  })

  it('drops a payload the server will never accept, so it cannot block the queue', () => {
    const verdict = classifyResponse(res(400), { error: true }, ID)
    expect(verdict.outcome).toBe('rejected')
    expect(verdict.removeFromOutbox).toBe(true)
  })

  it('never removes anything outside the two accepted cases', () => {
    const cases: [number, string | null, unknown][] = [
      [301, JSON_TYPE, {}],
      [302, 'text/html', ''],
      [401, JSON_TYPE, {}],
      [403, 'text/html', ''],
      [404, JSON_TYPE, {}],
      [418, JSON_TYPE, {}],
      [500, JSON_TYPE, {}],
      [502, 'text/html', ''],
      [200, 'text/plain', 'ok'],
      [200, null, null],
      [201, JSON_TYPE, { id: 'wrong', created: true }],
    ]
    for (const [status, type, body] of cases) {
      const verdict = classifyResponse(res(status, type), body, ID)
      expect(verdict.removeFromOutbox, `status ${status} type ${type}`).toBe(false)
    }
  })
})

describe('toPlainPayload, the guard against DataCloneError', () => {
  it('turns a Vue reactive object into something IndexedDB can store', async () => {
    const { reactive, ref } = await import('vue')

    const reactivePayload = {
      id: ID,
      metrics: reactive({ attempted: 12, correct: 9 }),
      trials: reactive([{ idx: 0, params: reactive({ type: 'x', a: 1 }), correct: true }]),
      nested: ref(3),
    }

    expect(() => structuredClone(reactivePayload)).toThrow()
    expect(() => structuredClone(toPlainPayload(reactivePayload))).not.toThrow()
  })

  it('keeps the data identical', () => {
    const payload = {
      id: ID,
      metrics: { attempted: 12, correct: 9 },
      trials: [{ idx: 0, params: { type: 'x', a: 1 }, correct: true, response: null }],
    }
    expect(toPlainPayload(payload)).toEqual(payload)
  })

  it('survives a round trip through structured clone unchanged', () => {
    const payload = { id: ID, trials: [{ idx: 0, response: [1, 2, 3] }], metrics: {} }
    expect(structuredClone(toPlainPayload(payload))).toEqual(payload)
  })
})
