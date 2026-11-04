/** Publish the current Research plan from settled tool results. */

import { parsePlan } from './plan.js'

export const name = 'research-todo-panel'
export const inject = ['sessionProjections']

const planSchema = { parse: value => value === null ? null : parsePlan(value) }

/**
 * Keep the projection mounted at Host level so a read-only Session can replay it.
 * @param ctx - plugin context carrying the Session projection registry.
 * @returns when the plan projection is ready.
 */
export async function apply(ctx) {
  await ctx.sessionProjections.register({
    key: 'researchTodos',
    stateVersion: 1,
    stateSchema: planSchema,
    init: () => null,
    apply(state, event) {
      if (event.type === 'turn/start') return null
      if (event.type === 'tool/result' && !event.data.message.isError && event.data.meta?.researchTodos !== undefined) {
        return planSchema.parse(event.data.meta.researchTodos)
      }
      return state
    },
    wire: { viewSchema: planSchema, view: state => state, summary: false },
  })
}
