import assert from 'node:assert/strict'
import test from 'node:test'
import { apply as registerProjection } from '../projection.js'
import { apply as registerTool } from '../tool.js'

function toolDefinition() {
  let tool
  registerTool({ tools: { register(definition) { tool = definition } } })
  return tool
}

const completed = { content: 'Check the baseline', status: 'completed' }
const active = { content: 'Run the follow-up', status: 'in_progress' }

test('completion requires a nonempty result on one line', async () => {
  const tool = toolDefinition()
  for (const item of [completed, { ...completed, completionSummary: ' ' },
    { ...completed, completionSummary: 'First line\nSecond line' }]) {
    await assert.rejects(tool.execute({ todos: [item, active] }), /Provide a one-sentence completionSummary/)
  }
  await assert.rejects(tool.execute({ todos: [{ ...active, completionSummary: 'Still working.' }] }), /Omit completionSummary/)
  await assert.rejects(tool.execute({ todos: [active, { ...active, content: ` ${active.content} ` }] }), /unique task title/)
})

test('replay uses successful tool result metadata and clears the list on a new turn', async () => {
  const tool = toolDefinition()
  const args = { todos: [{ ...completed, completionSummary: ' All three checks passed. ' }, active] }
  const value = await tool.execute(args)
  const meta = tool.output.presentationMeta(args, value)
  assert.deepEqual(meta.researchTodos, [{ ...completed, completionSummary: 'All three checks passed.' }, active])
  assert.deepEqual(tool.output.render(args, value), [{ type: 'text', text: 'Updated todo list: 0 pending, 1 in progress, 1 completed.' }])

  let projection
  await registerProjection({ sessionProjections: { async register(definition) { projection = definition } } })
  const initial = projection.init()
  const state = projection.apply(initial, { type: 'tool/result', data: { message: { isError: false }, meta } })
  assert.deepEqual(projection.wire.viewSchema.parse(projection.wire.view(state)), meta.researchTodos)
  assert.equal(projection.apply(state, { type: 'tool/result', data: { message: { isError: true }, meta } }), state)
  assert.equal(projection.apply(state, { type: 'tool/result', data: { message: { isError: false } } }), state)
  assert.equal(projection.apply(state, { type: 'turn/end' }), state)
  assert.equal(projection.apply(state, { type: 'turn/start' }), null)
})
