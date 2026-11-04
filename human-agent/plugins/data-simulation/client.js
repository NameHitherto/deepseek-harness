window.__ModuleLoader__.load({
  id: '@local/data-simulation',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'data-simulation'
    const STATE_ROUTE = 'api/data-simulation.state'
    const ACTIVATE_ROUTE = 'api/data-simulation.activate'
    const SAVE_ROUTE = 'api/data-simulation.save'
    const REMOVE_ROUTE = 'api/data-simulation.remove'

    /**
     * This page's stylesheet. A dynamic bundle owns its own style tag instead of
     * importing a CSS module, and `ctx.effect` removes it with the plugin.
     */
    const CSS = `
      .dsim { display: flex; flex-direction: column; gap: 12px; font-size: 13px; color: var(--dsw-alias-label-primary); }
      .dsim-head { display: flex; flex-direction: column; gap: 4px; }
      .dsim-title { font-size: 14px; font-weight: 600; }
      .dsim-note { color: var(--dsw-alias-label-secondary); }
      .dsim-error { color: var(--dsw-alias-state-error-primary); }
      .dsim-list { display: flex; flex-direction: column; border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 8px; overflow: hidden; }
      .dsim-row { display: flex; gap: 10px; width: 100%; padding: 10px 12px; align-items: flex-start;
        background: var(--dsw-alias-bg-layer-1); border: 0; border-bottom: 1px solid var(--dsw-alias-border-l1);
        font: inherit; color: inherit; text-align: left; cursor: pointer; }
      .dsim-row:last-child { border-bottom: 0; }
      .dsim-row:hover, .dsim-row[aria-checked="true"] { background: var(--dsw-alias-bg-layer-2); }
      .dsim-row:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
      .dsim-row[disabled] { cursor: default; color: var(--dsw-alias-state-idle-primary); }
      .dsim-dot { flex: none; width: 14px; height: 14px; margin-top: 2px; border-radius: 50%;
        border: 1px solid var(--dsw-alias-border-l2); }
      .dsim-dot[data-active="true"] { border-color: var(--dsw-alias-brand-primary);
        background: var(--dsw-alias-brand-primary); box-shadow: inset 0 0 0 3px var(--dsw-alias-bg-layer-1); }
      .dsim-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .dsim-label { font-weight: 600; }
      .dsim-meta { color: var(--dsw-alias-label-secondary); }
      .dsim-field { color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; white-space: pre-wrap; }
      .dsim-field b { color: var(--dsw-alias-label-primary); font-weight: 600; }
      .dsim-expected-item { display: block; }
      .dsim-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .dsim-button { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l2);
        background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; cursor: pointer; }
      .dsim-button:hover { background: var(--dsw-alias-bg-layer-2); }
      .dsim-button[disabled] { color: var(--dsw-alias-state-idle-primary); cursor: default; }
      .dsim-select { padding: 4px 8px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l2);
        background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; }
      .dsim-form { display: flex; flex-direction: column; gap: 8px; padding: 12px;
        border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); }
      .dsim-form label { display: flex; flex-direction: column; gap: 4px; color: var(--dsw-alias-label-secondary); }
      .dsim-form input, .dsim-form textarea { padding: 5px 8px; border-radius: 6px;
        border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-base);
        color: var(--dsw-alias-label-primary); font: inherit; }
      .dsim-form textarea { min-height: 52px; resize: vertical; }
      .dsim-criteria { display: flex; flex-direction: column; gap: 8px; }
    `

    const EN = {
      title: 'Data simulation',
      description: 'Choose a scenario with a simulated clock, a task prompt, and criteria for scoring the answer.',
      active: 'Active scenario',
      prompt: 'Task prompt',
      expected: 'Expected results',
      expectedItem: 'Expected result {number}',
      addExpected: 'Add expected result',
      removeExpected: 'Remove expected result {number}',
      none: 'none',
      loading: 'Reading the scenario library…',
      readFailed: 'The scenario library could not be read.',
      saveFailed: 'The scenario could not be saved.',
      switchFailed: 'The scenario could not be switched.',
      removeFailed: 'The scenario could not be removed.',
      stored: 'Stored in this profile.',
      notStored: 'Not stored; the change lasts for this run only.',
      newScenario: 'New scenario',
      add: 'Add',
      edit: 'Edit',
      remove: 'Delete',
      save: 'Save',
      cancel: 'Cancel',
      id: 'Id',
      label: 'Name',
      time: 'Simulated time',
      timeZone: 'Zone',
      timeHint: 'ISO 8601 with an explicit offset, such as 2026-03-02T09:30:00+08:00',
      timeZoneHint: 'IANA zone name; leave empty to read the time in the offset written above',
      empty: 'No scenario yet. Add one below.',
      applyPreset: 'Preset',
    }
    const ZH = {
      title: '数据模拟',
      description: '选择实验场景，设置模拟时间、任务提示词和逐项评分的预期结果。',
      active: '当前场景',
      prompt: '任务提示词',
      expected: '预期结果',
      expectedItem: '预期结果 {number}',
      addExpected: '新增预期结果',
      removeExpected: '移除预期结果 {number}',
      none: '无',
      loading: '正在读取场景库…',
      readFailed: '无法读取场景库。',
      saveFailed: '场景保存失败。',
      switchFailed: '场景切换失败。',
      removeFailed: '场景删除失败。',
      stored: '已保存到当前配置档。',
      notStored: '未保存，改动仅在本次运行中生效。',
      newScenario: '新建场景',
      add: '新增',
      edit: '编辑',
      remove: '删除',
      save: '保存',
      cancel: '取消',
      id: '标识',
      label: '名称',
      time: '模拟时间',
      timeZone: '时区',
      timeHint: '带偏移的 ISO 8601 时间，例如 2026-03-02T09:30:00+08:00',
      timeZoneHint: 'IANA 时区名；留空则按上面写的偏移读取',
      empty: '暂无场景，请在下方新增。',
      applyPreset: '预置',
    }

    /**
     * Call one page route.
     * @param route - browser-relative path, such as `api/data-simulation.state`.
     * @param body - JSON body for a POST.
     * @param signal - abort signal for the read request.
     * @returns the parsed answer, or the rejection reason the Host reported.
     */
    async function call(route, body, signal) {
      const response = await fetch(route, body === undefined
        ? { signal, headers: { accept: 'application/json' } }
        : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) {
        let reason
        try {
          const failure = await response.json()
          if (typeof failure?.error === 'string') reason = failure.error
        } catch (_error) {
          // The Host answered without a JSON diagnostic; the status is all this page can show.
        }
        return { ok: false, reason }
      }
      return await response.json()
    }

    /**
     * One selectable scenario row.
     * @param props - scenario, active flag, translator, and the switch callback.
     * @returns the row element.
     */
    function ScenarioRow(props) {
      const { scenario, active, t, onSelect, busy } = props
      const reading = scenario.reading
      return h('button', {
        type: 'button',
        role: 'radio',
        class: 'dsim-row',
        'aria-checked': active ? 'true' : 'false',
        disabled: busy,
        onClick: () => { onSelect(scenario.id) },
      },
      h('span', { class: 'dsim-dot', 'data-active': active ? 'true' : 'false', 'aria-hidden': true }),
      h('span', { class: 'dsim-body' },
        h('span', { class: 'dsim-label' }, scenario.label),
        h('span', { class: 'dsim-meta' },
          `${reading.localTime} · ${reading.weekday} · ${reading.timeZone} (${reading.utcOffset})`),
        h('span', { class: 'dsim-field' }, h('b', null, `${t('prompt')}: `), scenario.prompt ?? t('none')),
        h('span', { class: 'dsim-field' }, h('b', null, `${t('expected')}: `),
          scenario.expected.length === 0 ? t('none') : scenario.expected.map((criterion, index) =>
            h('span', { class: 'dsim-expected-item', key: index }, `${index + 1}. ${criterion}`)))))
    }

    /**
     * Editor for one scenario's editable fields.
     * @param props - the draft, its setters, translator, and commit/cancel callbacks.
     * @returns the form element.
     */
    function ScenarioForm(props) {
      const { draft, t, onChange, onSave, onCancel, busy, creating } = props
      const field = (name, label, hint, multiline) => h('label', null,
        label,
        multiline === true
          ? h('textarea', {
            value: draft[name] ?? '',
            placeholder: hint ?? '',
            onChange: event => { onChange({ ...draft, [name]: event.target.value }) },
          })
          : h('input', {
            type: 'text',
            value: draft[name] ?? '',
            placeholder: hint ?? '',
            onChange: event => { onChange({ ...draft, [name]: event.target.value }) },
          }))
      return h('div', { class: 'dsim-form' },
        creating ? field('id', t('id'), 'release-review') : null,
        field('label', t('label')),
        field('time', t('time'), t('timeHint')),
        field('timeZone', t('timeZone'), t('timeZoneHint')),
        field('prompt', t('prompt'), undefined, true),
        h('div', { class: 'dsim-criteria' },
          draft.expected.map((criterion, index) => h('div', { class: 'dsim-criteria', key: index },
            h('label', null, t('expectedItem', { number: index + 1 }), h('textarea', {
              value: criterion,
              onChange: event => { onChange({ ...draft, expected: draft.expected.with(index, event.target.value) }) },
            })),
            h('div', null, h('button', {
              type: 'button', class: 'dsim-button', disabled: busy,
              onClick: () => { onChange({ ...draft, expected: draft.expected.toSpliced(index, 1) }) },
            }, t('removeExpected', { number: index + 1 }))))),
          h('div', null, h('button', {
            type: 'button', class: 'dsim-button', disabled: busy,
            onClick: () => { onChange({ ...draft, expected: [...draft.expected, ''] }) },
          }, t('addExpected')))),
        h('div', { class: 'dsim-bar' },
          h('button', { type: 'button', class: 'dsim-button', disabled: busy, onClick: onSave }, t('save')),
          h('button', { type: 'button', class: 'dsim-button', disabled: busy, onClick: onCancel }, t('cancel'))))
    }

    /**
     * The Plugins settings page: switch, add, edit, and delete scenarios.
     * @param props - the framework props plus the injected route callbacks.
     * @returns the page element.
     */
    function DataSimulationPage(props) {
      const { t, readState, activate, save, remove } = props
      const [state, setState] = React.useState(undefined)
      const [notice, setNotice] = React.useState(undefined)
      const [busy, setBusy] = React.useState(false)
      const [draft, setDraft] = React.useState(undefined)

      React.useEffect(() => {
        const controller = new AbortController()
        let live = true
        readState(controller.signal).then((answer) => {
          if (!live) return
          if (answer.ok === false) setNotice({ error: true, text: t('readFailed') })
          else setState(answer)
        }, () => {
          if (live) setNotice({ error: true, text: t('readFailed') })
        })
        return () => {
          live = false
          controller.abort()
        }
      }, [])

      const active = state === undefined ? undefined : state.scenarios.find(row => row.id === state.activeId)
      const available = state === undefined
        ? []
        : state.presets.filter(preset => !state.scenarios.some(row => row.id === preset.id))
      const [presetId, setPresetId] = React.useState('')

      /** Report one answer from a mutation route. */
      const settle = (answer, failedText) => {
        setBusy(false)
        if (answer.ok === false) {
          setNotice({ error: true, text: answer.reason ?? failedText })
          return
        }
        setState(answer.state)
        setNotice({ error: false, text: answer.state.storage.persisted ? t('stored') : t('notStored') })
        setDraft(undefined)
      }

      const select = (id) => {
        setBusy(true)
        activate(id).then(answer => settle(answer, t('switchFailed')), () => {
          setBusy(false)
          setNotice({ error: true, text: t('switchFailed') })
        })
      }

      const commit = () => {
        setBusy(true)
        const expected = draft.expected.map(criterion => criterion.trim()).filter(Boolean)
        save({ ...draft, expected }).then(answer => settle(answer, t('saveFailed')), () => {
          setBusy(false)
          setNotice({ error: true, text: t('saveFailed') })
        })
      }

      const drop = () => {
        if (active === undefined) return
        setBusy(true)
        remove(active.id).then(answer => settle(answer, t('removeFailed')), () => {
          setBusy(false)
          setNotice({ error: true, text: t('removeFailed') })
        })
      }

      const addPreset = () => {
        const preset = available.find(row => row.id === presetId) ?? available[0]
        if (preset === undefined) return
        setBusy(true)
        save(preset).then(answer => settle(answer, t('saveFailed')), () => {
          setBusy(false)
          setNotice({ error: true, text: t('saveFailed') })
        })
      }

      const header = h('div', { class: 'dsim-head' },
        h('div', { class: 'dsim-title' }, t('title')),
        h('div', { class: 'dsim-note' }, t('description')))

      if (state === undefined) {
        return h('div', { class: 'dsim' }, header,
          h('div', { class: notice?.error === true ? 'dsim-error' : 'dsim-note' }, notice?.text ?? t('loading')))
      }

      const rows = state.scenarios.length === 0
        ? h('div', { class: 'dsim-note' }, t('empty'))
        : h('div', { class: 'dsim-list', role: 'radiogroup', 'aria-label': t('active') },
          state.scenarios.map(row => h(ScenarioRow, {
            key: row.id,
            scenario: row,
            active: row.id === state.activeId,
            t,
            busy,
            onSelect: select,
          })))

      const controls = h('div', { class: 'dsim-bar' },
        h('button', {
          type: 'button',
          class: 'dsim-button',
          disabled: busy,
          onClick: () => { setDraft(blankScenario(active)) },
        }, t('newScenario')),
        h('button', {
          type: 'button',
          class: 'dsim-button',
          disabled: busy || active === undefined,
          onClick: () => { setDraft({ ...withoutReading(active) }) },
        }, t('edit')),
        h('button', {
          type: 'button',
          class: 'dsim-button',
          disabled: busy || active === undefined || state.scenarios.length === 1,
          onClick: drop,
        }, t('remove')),
        available.length === 0 ? null : h('span', { class: 'dsim-bar' },
          h('select', {
            class: 'dsim-select',
            value: presetId,
            'aria-label': t('applyPreset'),
            onChange: event => { setPresetId(event.target.value) },
          },
          h('option', { value: '' }, t('applyPreset')),
          available.map(preset => h('option', { key: preset.id, value: preset.id }, preset.label))),
          h('button', { type: 'button', class: 'dsim-button', disabled: busy, onClick: addPreset }, t('add'))))

      return h('div', { class: 'dsim' }, header,
        h('div', { class: 'dsim-note' }, storageNote(t, state.storage)),
        rows,
        controls,
        draft === undefined
          ? null
          : h(ScenarioForm, {
            draft,
            t,
            busy,
            creating: !state.scenarios.some(row => row.id === draft.id),
            onChange: setDraft,
            onSave: commit,
            onCancel: () => { setDraft(undefined) },
          }),
        notice === undefined
          ? null
          : h('div', { class: notice.error === true ? 'dsim-error' : 'dsim-note' }, notice.text))
    }

    /**
     * Keep only the fields a scenario stores, dropping the derived reading.
     * @param scenario - a scenario from the service state.
     * @returns the editable fields.
     */
    function withoutReading(scenario) {
      return {
        id: scenario.id,
        label: scenario.label,
        time: scenario.time,
        timeZone: scenario.timeZone,
        prompt: scenario.prompt,
        expected: scenario.expected,
      }
    }

    /**
     * Editable fields for a scenario the user is about to create.
     * @param seed - the active scenario, whose time and zone start the draft.
     * @returns an empty draft.
     */
    function blankScenario(seed) {
      return {
        id: '',
        label: '',
        time: seed?.time ?? '',
        timeZone: seed?.timeZone ?? '',
        prompt: '',
        expected: [],
      }
    }

    /**
     * Describe whether the library is durable.
     * @param t - translator bound to this page's namespace.
     * @param storage - the service's storage report.
     * @returns the sentence to show under the title.
     */
    function storageNote(t, storage) {
      return storage.persisted ? t('stored') : t('notStored')
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const style = document.createElement('style')
        style.dataset.plugin = 'data-simulation'
        style.textContent = CSS
        ctx.effect(() => {
          document.head.append(style)
          return () => { style.remove() }
        }, 'data-simulation: styles')

        ctx.effect(() => ctx.locale.register(NS, { en: EN, zh: ZH }), 'data-simulation: dictionaries')
        const translate = ctx.locale.bind(NS)

        ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
          name: 'settings.plugins.tab',
          id: 'data-simulation',
          order: 30,
          locale: NS,
          label: () => translate('title'),
          inject: () => ({
            readState: signal => call(STATE_ROUTE, undefined, signal),
            activate: id => call(ACTIVATE_ROUTE, { id }),
            save: scenario => call(SAVE_ROUTE, scenario),
            remove: id => call(REMOVE_ROUTE, { id }),
          }),
        }, DataSimulationPage))
      },
    }
  },
})
