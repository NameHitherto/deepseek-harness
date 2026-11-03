/** Mock data access and caller-owned initialization lifecycle. */
import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import MockDataService, { MockDataError } from '../src/index.ts'

/** Create an isolated service owner and release it even after assertion failures. */
async function createContext(t: TestContext): Promise<Context> {
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  await ctx.plugin(MockDataService)
  return ctx
}

test('reading an uninitialized entry reports its key and failure code', async (t) => {
  const ctx = await createContext(t)
  assert.throws(() => ctx.studyMockData.read('currentTime'), {
    name: 'MockDataError',
    code: 'not-initialized',
    key: 'currentTime',
  })
})

test('duplicate initialization leaves the stored value intact', async (t) => {
  const ctx = await createContext(t)
  ctx.studyMockData.initialize('currentTime', '2026-11-02T00:00:00.000Z')
  assert.throws(
    () => ctx.studyMockData.initialize('currentTime', '2026-11-03T00:00:00.000Z'),
    new MockDataError('already-initialized', 'currentTime'),
  )
  assert.equal(ctx.studyMockData.read('currentTime'), '2026-11-02T00:00:00.000Z')
})

test('an old disposer cannot remove a replacement initialization', async (t) => {
  const ctx = await createContext(t)
  const dispose = ctx.studyMockData.initialize('currentTime', '2026-11-02T00:00:00.000Z')
  dispose()
  assert.throws(() => ctx.studyMockData.read('currentTime'), { code: 'not-initialized' })
  ctx.studyMockData.initialize('currentTime', '2026-11-03T00:00:00.000Z')
  dispose()
  assert.equal(ctx.studyMockData.read('currentTime'), '2026-11-03T00:00:00.000Z')
})

test('unloading the initializing plugin removes its data while the provider stays available', async (t) => {
  const ctx = await createContext(t)
  const consumer = await ctx.plugin({
    inject: ['studyMockData'],
    apply(inner: Context) {
      inner.studyMockData.initialize('currentTime', '2026-11-02T00:00:00.000Z')
    },
  })
  assert.equal(ctx.studyMockData.read('currentTime'), '2026-11-02T00:00:00.000Z')
  await consumer.dispose()
  assert.throws(() => ctx.studyMockData.read('currentTime'), { code: 'not-initialized' })
})

test('separate service instances retain independent values', async (t) => {
  const first = await createContext(t)
  const second = await createContext(t)
  first.studyMockData.initialize('currentTime', '2026-11-02T00:00:00.000Z')
  second.studyMockData.initialize('currentTime', '2026-11-03T00:00:00.000Z')
  assert.equal(first.studyMockData.read('currentTime'), '2026-11-02T00:00:00.000Z')
  assert.equal(second.studyMockData.read('currentTime'), '2026-11-03T00:00:00.000Z')
})
