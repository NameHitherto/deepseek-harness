/** Canonical task lists for the research tool and its Session projection. */

export const STATUSES = ['pending', 'in_progress', 'completed']

/**
 * Validate a complete replacement before it can become visible.
 * @param todos - model input or saved task list.
 * @returns the list with trimmed text and one result per completed item.
 */
export function parsePlan(todos) {
  if (!Array.isArray(todos)) throw new Error('Provide the complete task list in the todos array.')
  const titles = new Set()
  return todos.map((todo, index) => {
    if (!todo || typeof todo.content !== 'string' || !todo.content.trim() || !STATUSES.includes(todo.status)) {
      throw new Error(`Provide a task title and a valid status for todo ${index + 1}.`)
    }
    if (Object.keys(todo).some(key => key !== 'content' && key !== 'status' && key !== 'completionSummary')) {
      throw new Error(`Use only content, status, and completionSummary for todo ${index + 1}.`)
    }
    const content = todo.content.trim()
    if (titles.has(content)) throw new Error(`Use a unique task title for todo ${index + 1}.`)
    titles.add(content)
    const { status, completionSummary } = todo
    if (status === 'completed') {
      const result = typeof completionSummary === 'string' ? completionSummary.trim() : ''
      if (!result || /[\r\n\u2028\u2029]/u.test(result)) {
        throw new Error(`Provide a one-sentence completionSummary on one line for todo ${index + 1}.`)
      }
      return { content, status, completionSummary: result }
    }
    if (completionSummary !== undefined) {
      throw new Error(`Omit completionSummary for todo ${index + 1} until it is completed.`)
    }
    return { content, status }
  })
}
