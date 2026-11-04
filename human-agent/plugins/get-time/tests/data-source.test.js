import assert from 'node:assert/strict'
import test from 'node:test'
import { apply as applySimulation } from '../../data-simulation/index.js'
import { apply as applyGetTime } from '../index.js'

function registerTimeTool(timeZone, simulation) {
  let tool
  let prompt
  applyGetTime({
    get: key => key === 'dataSimulation' ? simulation : undefined,
    tools: { register: definition => { tool = definition } },
    systemPrompt: { section: section => { prompt = section } },
  }, { timeZone })
  return { tool, prompt }
}

async function assertClockParity(timeZone, scenarioZone) {
  const system = registerTimeTool(timeZone)
  const reading = await system.tool.execute({})

  let simulation
  applySimulation({
    get: () => undefined,
    provide: (_key, service) => { simulation = service },
    inject: () => {},
    emit: () => {},
  })
  await simulation.replace({
    activeId: 'parity-scenario',
    scenarios: [{
      id: 'parity-scenario',
      label: 'Parity scenario',
      time: reading.instant,
      timeZone: scenarioZone,
      prompt: 'Task prompt',
      expectedResult: 'Scoring reference',
    }],
  })

  const simulated = registerTimeTool(timeZone, simulation)
  assert.deepEqual(simulated.prompt, system.prompt)
  for (const key of ['name', 'description', 'parameters']) {
    assert.deepEqual(simulated.tool[key], system.tool[key])
  }
  assert.deepEqual(simulated.tool.output.schema, system.tool.output.schema)

  const fields = ['instant', 'timeZone', 'utcOffset', 'localDate', 'localTime', 'weekday'].sort()
  assert.deepEqual(Object.keys(simulated.tool.output.schema.properties).sort(), fields)
  assert.deepEqual(Object.keys(reading).sort(), fields)
  const result = await simulated.tool.execute({})
  assert.deepEqual(result, reading)
  assert.deepEqual(simulated.tool.output.render({}, result), system.tool.output.render({}, reading))
  const modelContext = JSON.stringify([simulated.tool.description, simulated.prompt, simulated.tool.output.render({}, result)])
  assert.doesNotMatch(modelContext, /simulat|scenario|source|system clock|scoring reference/i)
}

test('system and simulated clocks expose identical tool context and results in the same IANA zone', async () => {
  await assertClockParity('Asia/Shanghai', 'Asia/Shanghai')
})

test('system and simulated clocks use the same label for a fixed UTC offset', async () => {
  await assertClockParity('+00:00', undefined)
})
