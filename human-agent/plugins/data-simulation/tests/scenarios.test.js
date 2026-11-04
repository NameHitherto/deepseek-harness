import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { apply } from '../index.js'

function startService(dir) {
  let service
  const routes = new Map()
  apply({
    get: key => (key === 'profileContext' && dir !== undefined ? { dir } : undefined),
    provide: (_key, value) => { service = value },
    inject: (_services, mount) => mount({
      connection: { fetch: { register: route => routes.set(route.path, route.fetch) } },
    }),
    emit: () => {},
  })
  return { service, routes }
}

test('saving scenario criteria preserves order and rejects invalid items before changing the library', async () => {
  const { service, routes } = startService()
  const save = document => routes.get('/api/data-simulation.save')(
    new Request('http://localhost/api/data-simulation.save', { method: 'POST', body: JSON.stringify(document) }),
  )
  const initial = service.active()
  const scenario = { ...initial, expected: ['  First criterion  ', 'Second criterion\nwith a second line'] }
  const result = await save(scenario)
  assert.equal(result.status, 200)
  assert.deepEqual(service.active().expected, ['First criterion', 'Second criterion\nwith a second line'])
  assert.equal(Object.isFrozen(service.active().expected), true)
  assert.equal(Object.isFrozen(service.presets()[0].expected), true)

  for (const expected of ['single string', [17], ['   ']]) {
    const invalid = await save({ scenarios: [{ ...scenario, expected }], activeId: scenario.id })
    assert.equal(invalid.status, 400)
    assert.match((await invalid.json()).error, /expected/)
    assert.deepEqual(service.active().expected, ['First criterion', 'Second criterion\nwith a second line'])
  }
})

test('version 1 libraries refresh untouched presets and preserve custom tasks when saved as version 2', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-simulation-test-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const storage = join(dir, '.data-simulation')
  const file = join(storage, 'scenarios.json')
  mkdirSync(storage)

  const preset = {
    id: 'requirement-review',
    label: 'Requirement review',
    time: '2026-03-02T09:30:00+08:00',
    timeZone: 'Asia/Shanghai',
    prompt: 'Review the draft login requirement and list every unclear acceptance criterion.',
    expectedResult: 'A numbered list of unclear criteria, each with the question that resolves it.',
  }
  const edited = {
    id: 'offline-utc',
    label: 'UTC maintenance window',
    time: '2026-01-15T03:00:00Z',
    prompt: 'Schedule the maintenance window and state the local start time in Tokyo and Berlin.',
    expectedResult: 'The UTC window plus the two local start times, each with its offset.',
  }
  const custom = { id: 'custom-task', time: preset.time, prompt: 'Custom task', expectedResult: 'First line\nSecond line' }
  writeFileSync(file, JSON.stringify({ version: 1, activeId: edited.id, scenarios: [preset, edited, custom] }))

  const { service } = startService(dir)
  const [updated, kept, multiline] = service.list()
  assert.equal(service.activeId(), edited.id)
  assert.equal(updated.prompt, service.presets()[0].prompt)
  assert.ok(updated.expected.length > 1)
  assert.equal(kept.prompt, edited.prompt)
  assert.equal(kept.time, edited.time)
  assert.deepEqual(kept.expected, [edited.expectedResult])
  assert.deepEqual(multiline.expected, [custom.expectedResult])
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).version, 1)

  await service.activate(preset.id)
  const stored = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(stored.version, 2)
  assert.ok(stored.scenarios.every(row => !Object.hasOwn(row, 'expectedResult')))
  assert.deepEqual(startService(dir).service.list(), service.list())
})
