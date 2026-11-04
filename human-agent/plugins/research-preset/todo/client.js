window.__ModuleLoader__.load({
  id: '@local/research-preset',
  factory(require) {
    const { createElement: h } = require('react')
    const { StateDot } = require('@deepseek-ai/dsh-client-ui-primitives')
    const NS = 'research-todo'
    const dictionaries = {
      en: { title: 'Tasks', progress: '{done}/{total} completed', pending: 'Pending', in_progress: 'In progress', completed: 'Completed' },
      zh: { title: '任务', progress: '已完成 {done}/{total}', pending: '待处理', in_progress: '进行中', completed: '已完成' },
    }
    const dots = { pending: 'idle', in_progress: 'ongoing', completed: 'done' }
    const styles = `
      .research-todo {
        box-sizing: border-box;
        width: calc(100% - 2 * var(--dsh-composer-side-clearance) - 4 * var(--dsh-composer-dock-inset));
        max-width: calc(var(--dsh-composer-card-max-width) - 4 * var(--dsh-composer-dock-inset));
        margin: 0 auto;
        padding: 6px 12px;
        border-radius: var(--dsw-radius-lg);
        background: var(--dsw-specific-menu);
        box-shadow: var(--dsw-elevation-panel);
        color: var(--dsw-alias-label-primary);
        font-size: 13px;
        line-height: 20px;
      }
      .research-todo > summary { cursor: pointer; }
      .research-todo-progress { margin-inline-start: 10px; color: var(--dsw-alias-label-secondary); }
      .research-todo > ul { display: grid; gap: 8px; max-height: 180px; overflow-y: auto; margin: 8px 0 0; padding: 0; list-style: none; }
      .research-todo li { display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 10px; overflow-wrap: anywhere; }
      .research-todo-marker { display: grid; place-items: center; height: 20px; }
      .research-todo-result { color: var(--dsw-alias-label-secondary); }
    `

    function ResearchTodoDock({ useProjection, t }) {
      const todos = useProjection('researchTodos')
      if (!todos?.length) return null
      const done = todos.filter(todo => todo.status === 'completed').length
      return h('details', { className: 'research-todo', 'data-testid': 'research-todo-panel' },
        h('summary', null, t('title'), ' ', h('span', { className: 'research-todo-progress' }, t('progress', { done, total: todos.length }))),
        h('ul', null, todos.map(todo => h('li', { key: todo.content },
          h('span', { className: 'research-todo-marker', role: 'img', 'aria-label': t(todo.status) },
            h(StateDot, { state: dots[todo.status] })),
          h('div', null, h('div', null, todo.content),
            todo.completionSummary && h('div', { className: 'research-todo-result' }, todo.completionSummary))))))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => {
          const style = document.createElement('style')
          style.textContent = styles
          document.head.append(style)
          return () => { style.remove() }
        })
        ctx.effect(() => ctx.locale.register(NS, dictionaries))
        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock', id: 'research-todo', order: 0, locale: NS,
        }, ResearchTodoDock))
      },
    }
  },
})
