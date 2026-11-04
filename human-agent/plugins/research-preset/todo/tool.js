/** Research-scoped task updates settle through the ordinary tool result. */

import { parsePlan, STATUSES } from './plan.js'

export const name = 'research-todo-tool'
export const inject = ['tools']

const listSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['todos'],
  properties: {
    todos: {
      type: 'array',
      description: 'The full replacement list, including completed tasks and their results.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['content', 'status'],
        properties: {
          content: { type: 'string', description: 'A short task title.' },
          status: { type: 'string', enum: STATUSES },
          completionSummary: {
            type: 'string',
            description: 'Required for completed tasks only. State the concrete result in one sentence on one line.',
          },
        },
      },
    },
  },
}

/**
 * Register the tool in the current Research Agent scope.
 * @param ctx - plugin context carrying the tool registry.
 */
export function apply(ctx) {
  ctx.tools.register({
    name: 'research_todo_write',
    description: 'Track the stages of multi-step work. Start with one task per concrete stage. '
      + 'Update the full list as work progresses. When you mark a task completed, include a one-sentence '
      + 'completionSummary of its concrete result and keep the summary in later updates.',
    parameters: listSchema,
    output: {
      schema: listSchema,
      render(_args, { todos }) {
        const [pending, active, completed] = STATUSES.map(status => todos.filter(todo => todo.status === status).length)
        return [{ type: 'text', text: `Updated todo list: ${pending} pending, ${active} in progress, ${completed} completed.` }]
      },
      presentationMeta: (_args, { todos }) => ({ researchTodos: todos }),
    },
    async execute(args) {
      if (args && Object.keys(args).some(key => key !== 'todos')) {
        throw new Error('Provide only the todos array.')
      }
      return { todos: parsePlan(args?.todos) }
    },
  })
}
