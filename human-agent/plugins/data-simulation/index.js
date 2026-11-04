/**
 * Host half of the data-simulation bundle.
 *
 * Owns a switchable library of simulation scenarios — each carrying a simulated
 * current time, a task prompt, and scoring criteria — and publishes them as
 * the `dataSimulation` service that other plugins read. The library lives in
 * the profile's own `.data-simulation` directory, so switching a scenario
 * survives a restart without touching the profile patch.
 *
 * This file imports nothing but Node builtins: the bundle is linked into a
 * profile, where a bare package specifier would have to resolve against the
 * profile's dependency table rather than against this directory.
 *
 * @module @local/data-simulation
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Loader diagnostics name for this plugin. */
export const name = 'data-simulation'

/** Service name other plugins read through `ctx.get('dataSimulation')`. */
const SERVICE = 'dataSimulation'

/** Event emitted on this context after the library or the selection changes. */
const CHANGE_EVENT = 'data-simulation/change'

/** Exact Fetch routes on the shared API channel; the browser fetches them relative to `/api`. */
const STATE_PATH = '/api/data-simulation.state'
const SAVE_PATH = '/api/data-simulation.save'
const ACTIVATE_PATH = '/api/data-simulation.activate'
const REMOVE_PATH = '/api/data-simulation.remove'

/** Directory name and file this plugin owns under the profile directory. */
const DATA_DIR = '.data-simulation'
const DATA_FILE = 'scenarios.json'

/** Library document version, so a future format can migrate rather than guess. */
const FORMAT_VERSION = 2

/** Task text and scoring references that identify unedited version 1 presets. */
const LEGACY_PRESETS = new Map([
  ['requirement-review', [
    'Review the draft login requirement and list every unclear acceptance criterion.',
    'A numbered list of unclear criteria, each with the question that resolves it.',
  ]],
  ['bug-triage', [
    'Sort these three defect reports by user impact and name the first one to fix.',
    'A ranked list with one sentence of impact per defect and a named first fix.',
  ]],
  ['release-notes', [
    'Write the release notes for this version from the merged change list.',
    'A grouped note with user-facing changes, fixes, and a known-issues section.',
  ]],
  ['offline-utc', [
    'Schedule the maintenance window and state the local start time in Tokyo and Berlin.',
    'The UTC window plus the two local start times, each with its offset.',
  ]],
])

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** An ISO 8601 date-time that names its own offset, which makes the instant unambiguous. */
const TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,9})?(Z|z|[+-]\d{2}:\d{2})$/

/** Scenario ids are used as row keys and in the file, so they stay simple. */
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Report one rejected input with the field that failed. */
class ScenarioError extends Error {}

/**
 * Read the UTC offset an instant declares.
 * @param text - the offset suffix of a validated instant.
 * @returns the offset in minutes, positive east of UTC.
 */
function parseOffset(text) {
  if (text === 'Z' || text === 'z') return 0
  const hours = Number(text.slice(1, 3))
  const minutes = Number(text.slice(4, 6))
  if (hours > 23 || minutes > 59) throw new ScenarioError(`"${text}" is not a UTC offset`)
  return (text[0] === '-' ? -1 : 1) * (hours * 60 + minutes)
}

/** Two-digit zero padding. */
function pad(value) {
  return String(value).padStart(2, '0')
}

/** Render a UTC offset in minutes as `+08:00`. */
function offsetLabel(offsetMinutes) {
  const sign = offsetMinutes < 0 ? '-' : '+'
  const total = Math.abs(offsetMinutes)
  return `${sign}${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

/**
 * Check that an IANA zone name is one this runtime knows.
 * @param timeZone - candidate zone name.
 * @returns the zone name.
 */
function checkZone(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.trim() === '') throw new ScenarioError('timeZone must be an IANA zone name')
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
  } catch {
    throw new ScenarioError(`timeZone "${timeZone}" is not an IANA zone name known to this runtime`)
  }
  return timeZone.trim()
}

/**
 * Validate one editable scenario and compile its instant.
 * @param input - scenario fields from the library file, a preset, or the Web page.
 * @param legacy - whether the stored row uses the version 1 scoring field.
 * @returns the stored fields with the parsed instant; the instant is not persisted.
 * @throws {ScenarioError} naming the first field that fails.
 */
function compileScenario(input, legacy = false) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new ScenarioError('a scenario must be an object')
  const { id, label, time, timeZone, prompt } = input
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    throw new ScenarioError('id must be lowercase words joined by hyphens, such as "release-review"')
  }
  const text = typeof time === 'string' ? time.trim() : ''
  const match = TIME_PATTERN.exec(text)
  if (match === null) {
    throw new ScenarioError('time must be an ISO 8601 date-time with an explicit offset, such as 2026-03-02T09:30:00+08:00')
  }
  const instant = Date.parse(text)
  if (!Number.isFinite(instant)) throw new ScenarioError('time is not a real calendar instant')
  const fields = {
    id,
    label: optionalText(label, 'label') ?? id,
    time: text,
    prompt: optionalText(prompt, 'prompt'),
    expected: compileExpected(input, legacy),
    ...timeZone === undefined || timeZone === null || timeZone === ''
      ? {}
      : { timeZone: checkZone(timeZone) },
  }
  return { fields: Object.freeze(fields), instant, offsetMinutes: parseOffset(match[7]) }
}

/**
 * Read immutable scoring criteria. A version 1 result remains a single item.
 * @param input - scenario fields, including the old field on version 1 rows.
 * @param legacy - whether the row comes from a version 1 library.
 * @returns the normalized criteria in scoring order.
 */
function compileExpected(input, legacy) {
  if (legacy) {
    const result = optionalText(input.expectedResult, 'expectedResult')
    return Object.freeze(result === undefined ? [] : [result])
  }
  if (Object.hasOwn(input, 'expectedResult')) throw new ScenarioError('use expected with an array of strings in place of expectedResult')
  const { expected } = input
  if (expected === undefined) return Object.freeze([])
  if (!Array.isArray(expected)) throw new ScenarioError('expected must be an array of strings')
  return Object.freeze(Array.from(expected, (criterion, index) => {
    if (typeof criterion !== 'string' || criterion.trim() === '') {
      throw new ScenarioError(`expected item ${index + 1} must be non-empty text`)
    }
    return criterion.trim()
  }))
}

/**
 * Read one optional text field.
 * @param value - candidate value.
 * @param field - field name for the diagnostic.
 * @returns the trimmed text, or `undefined` when empty.
 */
function optionalText(value, field) {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new ScenarioError(`${field} must be text`)
  const text = value.trim()
  return text === '' ? undefined : text
}

/**
 * Wall-clock fields of one instant in a fixed offset.
 * @param instant - epoch milliseconds.
 * @param offsetMinutes - offset east of UTC.
 * @returns the local clock fields.
 */
function shiftedParts(instant, offsetMinutes) {
  const shifted = new Date(instant + offsetMinutes * 60_000)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  }
}

/**
 * Wall-clock fields of one instant in an IANA zone.
 * @param instant - epoch milliseconds.
 * @param timeZone - IANA zone name.
 * @returns the local clock fields.
 */
function zonedParts(instant, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = {}
  for (const part of formatter.formatToParts(new Date(instant))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, second: parts.second }
}

/**
 * Report the simulated clock of one compiled scenario.
 *
 * Only clock fields are returned: a consumer that asks for the time must not
 * receive the scenario's task prompt or scoring criteria.
 * @param scenario - compiled scenario.
 * @returns a detached, frozen reading.
 */
function readingOf(scenario) {
  const { instant, fields } = scenario
  const parts = fields.timeZone === undefined
    ? shiftedParts(instant, scenario.offsetMinutes)
    : zonedParts(instant, fields.timeZone)
  const offsetMinutes = fields.timeZone === undefined
    ? scenario.offsetMinutes
    : Math.round((Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant) / 60_000)
  const date = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
  const time = `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`
  return Object.freeze({
    scenarioId: fields.id,
    label: fields.label,
    simulated: true,
    timeZone: fields.timeZone ?? `UTC${offsetLabel(offsetMinutes)}`,
    utcOffset: offsetLabel(offsetMinutes),
    utcOffsetMinutes: offsetMinutes,
    localDate: date,
    localTime: `${date} ${time}`,
    wallClock: time,
    weekday: WEEKDAYS[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()],
    instant: new Date(instant).toISOString(),
  })
}

/**
 * Build the shipped scenarios with self-contained task inputs and criteria
 * for scoring each requested deliverable.
 * @returns fresh preset scenarios, in presentation order.
 */
function presetLibrary() {
  return [
    {
      id: 'requirement-review',
      label: 'Requirement review',
      time: '2026-03-02T09:30:00+08:00',
      timeZone: 'Asia/Shanghai',
      prompt: [
        'Review this login requirement before today’s 11:00 Shanghai sign-off. “Lock the account for 15 minutes after five failed password attempts. Users can reset their password by email.”',
        'Tell me how much review time we have from now. I need decisions on which failures count and what clears them, exactly when a locked user can sign in again, and how email resets work during a lockout. For each area, ask the product owner a concrete question and give a test case with an observable outcome. Tell me which decision must be made first and why.',
      ].join('\n\n'),
      expected: [
        'From 09:30 to 11:00 Shanghai time on March 2, 2026, the team has 90 minutes to review.',
        'The failure-count review asks whether attempts from different devices count toward the same account and whether a successful login clears the count. A test checks that the fourth failure leaves the account unlocked and the fifth triggers lockout under the agreed policy.',
        'The lockout review asks when the 15 minutes start and whether attempts during lockout extend them. A boundary test checks rejection just before the agreed expiry and acceptance of valid credentials at expiry.',
        'The reset review asks whether a locked user can complete an email reset and whether that clears the lock. A test completes a reset during lockout and checks sign-in with the new password against the stated policy.',
        'The review prioritizes a decision and explains its downstream impact, such as settling account-wide counting first because it determines which attempts trigger the lockout tests.',
      ],
    },
    {
      id: 'bug-triage',
      label: 'Bug triage',
      time: '2026-07-18T14:05:00+08:00',
      timeZone: 'Asia/Shanghai',
      prompt: [
        'Triage three reports before today’s 15:00 Shanghai incident handoff. A: After the latest checkout deploy, 30% of buyers are charged without an order, and retries can charge them again. A rollback takes 15 minutes. B: The admin XLSX export times out for reports over 10,000 rows, but CSV export works. C: Safari shifts the account avatar by 4 pixels without blocking clicks.',
        'Rank the reports by user impact and explain each rank. For the first report you would address, tell me what to do immediately, how to verify checkout is safe again, and what to hand off about affected payments. Use the time remaining to say whether the rollback fits and how much time would be left for verification if it starts now.',
      ].join('\n\n'),
      expected: [
        'A ranks first because buyers lose money without receiving an order and retries can cause duplicate charges.',
        'B ranks second because large admin exports fail but CSV preserves access to the data.',
        'C ranks third because the Safari alignment issue is cosmetic and the avatar remains usable.',
        'Start the checkout rollback immediately. At 14:05 Shanghai time, 55 minutes remain before handoff. A 15-minute rollback finishes at 14:20 and leaves 40 minutes for verification.',
        'Verify that a successful payment creates exactly one order and a retry cannot produce a second charge.',
        'At handoff, include the status of payment-to-order reconciliation and follow-up for missing orders, duplicate charges, and any refunds due.',
      ],
    },
    {
      id: 'release-notes',
      label: 'Release notes',
      time: '2026-11-30T18:00:00+08:00',
      timeZone: 'Asia/Shanghai',
      prompt: [
        'Prepare the customer-facing notes for version 2.4. We publish today at 18:30 Shanghai time. The merged changes let workspace admins export selected invoices in bulk, fix duplicate support tickets caused by retrying a submission in Safari, and reorganize internal logging without changing behavior. XLSX exports of more than 10,000 invoices can still time out. CSV supports the full export.',
        'Give me the dated publication time and how long we have from now. Draft the notes so customers can tell what they can do now, which problem was fixed, and what limitation still affects them and how to work around it. Include only changes that affect customers.',
      ].join('\n\n'),
      expected: [
        'Version 2.4 is scheduled for November 30, 2026 at 18:30 Shanghai time (UTC+08:00), 30 minutes after the current time.',
        'The new feature identifies workspace admins as the users who can export selected invoices in bulk.',
        'The fix explains that retrying a support ticket submission in Safari no longer creates duplicate tickets.',
        'The known issue states that XLSX exports over 10,000 invoices can time out and gives CSV as the workaround for a full export.',
        'The customer-facing notes omit the internal logging reorganization.',
      ],
    },
    {
      id: 'offline-utc',
      label: 'UTC maintenance window',
      time: '2026-01-15T02:00:00Z',
      prompt: [
        'Plan a 45-minute maintenance window starting 90 minutes from now. The operations teams in Tokyo and Berlin need the full local window as well as the UTC schedule. Deployments must freeze 15 minutes before the window starts. If the health check is still failing 20 minutes after the start, initiate rollback.',
        'Give the date, start, end, and UTC offset for all three windows. Also give the freeze and rollback decision times in UTC and state what the operator should do at the rollback checkpoint.',
      ].join('\n\n'),
      expected: [
        'The UTC window is January 15, 2026 from 03:30 to 04:15 (UTC+00:00).',
        'The Tokyo window is January 15, 2026 from 12:30 to 13:15 (UTC+09:00).',
        'The Berlin window is January 15, 2026 from 04:30 to 05:15 (UTC+01:00).',
        'Freeze deployments at 03:15 UTC on January 15.',
        'At 03:50 UTC on January 15, initiate rollback if the health check is still failing.',
      ],
    },
  ]
}

/**
 * Own one switchable scenario library for this plugin activation.
 * @param ctx - plugin context, used for logging and change notifications.
 * @returns the frozen `dataSimulation` service.
 */
function createService(ctx) {
  const directory = ctx.get('profileContext')?.dir
  const file = directory === undefined ? undefined : join(directory, DATA_DIR, DATA_FILE)

  /** Compiled scenarios by id, in presentation order. */
  let entries = []
  let activeId
  let writeQueue = Promise.resolve()
  let lastPersisted = { persisted: file !== undefined, reason: undefined }
  const presets = Object.freeze(presetLibrary().map(scenario => compileScenario(scenario).fields))

  /**
   * Refresh an unedited version 1 preset. A change to any scenario field
   * keeps the saved task and its scoring reference together.
   * @param row - version 1 scenario fields.
   * @returns the updated preset, if the row matches the version 1 preset.
   */
  function updatedPreset(row) {
    const prior = LEGACY_PRESETS.get(row?.id)
    if (prior === undefined || row.prompt !== prior[0] || row.expectedResult !== prior[1]) return undefined
    const preset = presets.find(entry => entry.id === row.id)
    if (preset !== undefined && row.label === preset.label && row.time === preset.time && row.timeZone === preset.timeZone) return preset
    return undefined
  }

  /**
   * Read the stored document.
   * @returns the stored document, or `undefined` when this profile has none yet.
   */
  function readStored() {
    if (file === undefined) return undefined
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') return undefined
      throw new Error(`data-simulation: ${file} could not be read: ${String(error?.message ?? error)}`)
    }
    const document = JSON.parse(text)
    if ((document?.version !== 1 && document?.version !== FORMAT_VERSION) || !Array.isArray(document.scenarios)) {
      throw new Error(`data-simulation: ${file} must contain a version 1 or ${FORMAT_VERSION} simulation library`)
    }
    return document
  }

  /**
   * Replace the library in memory with validated scenarios.
   * @param list - library entries.
   * @param selected - id to select; falls back to the first entry.
   * @param legacy - whether the list comes from a version 1 library.
   */
  function adopt(list, selected, legacy = false) {
    const compiled = list.map((row) => {
      try {
        const update = legacy ? updatedPreset(row) : undefined
        return update === undefined ? compileScenario(row, legacy) : compileScenario(update)
      } catch (error) {
        if (!(error instanceof ScenarioError)) throw error
        throw new ScenarioError(`scenario "${String(row?.id)}" is invalid: ${error.message}`)
      }
    })
    const seen = new Set()
    for (const scenario of compiled) {
      if (seen.has(scenario.fields.id)) throw new ScenarioError(`the library repeats the id "${scenario.fields.id}"`)
      seen.add(scenario.fields.id)
    }
    entries = compiled
    activeId = seen.has(selected) ? selected : compiled[0].fields.id
  }

  const stored = readStored()
  if (stored === undefined) {
    adopt(presets, presets[0].id)
  } else if (stored.scenarios.length === 0) {
    // Every edit path keeps one scenario, so an empty file is an external edit
    // that would leave the clock reader with nothing to report.
    throw new Error(`data-simulation: ${file} lists no scenarios; restore one or delete the file to reload the presets`)
  } else {
    try {
      adopt(stored.scenarios, stored.activeId, stored.version === 1)
    } catch (error) {
      if (!(error instanceof ScenarioError)) throw error
      throw new Error(`data-simulation: ${file}: ${error.message}`, { cause: error })
    }
  }

  /**
   * Store the current library, keeping writes in submission order.
   * @returns fulfillment after this write settled, with whether it landed.
   */
  function persist() {
    if (file === undefined) {
      lastPersisted = { persisted: false, reason: 'This profile has no profile directory, so the library is not stored.' }
      return Promise.resolve(lastPersisted)
    }
    const document = {
      version: FORMAT_VERSION,
      activeId,
      scenarios: entries.map(scenario => scenario.fields),
    }
    const write = writeQueue.then(() => {
      mkdirSync(join(file, '..'), { recursive: true })
      writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
      return { persisted: true, reason: undefined }
    }, (error) => {
      // A previous write failed; this document still deserves an attempt.
      ctx.logger.warn(`data-simulation: an earlier library write failed: ${String(error?.message ?? error)}`)
      mkdirSync(join(file, '..'), { recursive: true })
      writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
      return { persisted: true, reason: undefined }
    }).catch((error) => {
      ctx.logger.warn('data-simulation: the scenario library could not be stored')
      ctx.logger.warn(String(error))
      return { persisted: false, reason: String(error?.message ?? error) }
    })
    writeQueue = write
    return write.then((outcome) => {
      lastPersisted = outcome
      return outcome
    })
  }

  const byId = id => entries.find(scenario => scenario.fields.id === id)

  /** The published scenario list: the stored fields plus a nested derived reading. */
  const list = () => Object.freeze(entries.map(scenario => Object.freeze({
    ...scenario.fields,
    reading: readingOf(scenario),
  })))

  /** The complete page state. */
  const snapshot = () => Object.freeze({
    activeId,
    scenarios: list(),
    presets,
    storage: Object.freeze({ path: file, ...lastPersisted }),
  })

  /** Announce the new state to in-process consumers and the Web page. */
  function changed() {
    ctx.emit(CHANGE_EVENT, snapshot())
  }

  /** Reject an edit that would leave the library empty. */
  function requireScenario(id) {
    const scenario = typeof id === 'string' ? byId(id) : undefined
    if (scenario === undefined) throw new ScenarioError(`unknown scenario "${String(id)}"`)
    return scenario
  }

  return Object.freeze({
    /** Every scenario, with its derived simulated reading. */
    list,
    /** The current page state. */
    state: snapshot,
    /** The shipped presets, which a user can re-add after deleting. */
    presets: () => presets,
    /** Id of the selected scenario; the library always holds one. */
    activeId: () => activeId,
    /**
     * Read the simulated clock of the selected scenario.
     * @returns the reading.
     */
    current: () => readingOf(byId(activeId)),
    /**
     * Read the selected scenario including its prompt and scoring criteria.
     * @returns the scenario fields plus its reading.
     */
    active() {
      const scenario = byId(activeId)
      return Object.freeze({ ...scenario.fields, reading: readingOf(scenario) })
    },
    /**
     * Select a scenario and store the selection.
     * @param id - scenario id.
     * @returns the new state and whether the selection was stored.
     * @throws {ScenarioError} when no scenario has that id.
     */
    async activate(id) {
      const scenario = requireScenario(id)
      const changedSelection = activeId !== scenario.fields.id
      activeId = scenario.fields.id
      const outcome = changedSelection ? await persist() : lastPersisted
      if (changedSelection) changed()
      return Object.freeze({
        activeId,
        stored: outcome.persisted,
        ...outcome.reason === undefined ? {} : { reason: outcome.reason },
      })
    },
    /**
     * Create or update one scenario, then store the library.
     * @param input - complete scenario fields; `id` selects the row to replace.
     * @returns the new state after the write settled.
     * @throws {ScenarioError} when a field is invalid.
     */
    async upsert(input) {
      const scenario = compileScenario(input)
      const index = entries.findIndex(entry => entry.fields.id === scenario.fields.id)
      if (index < 0) entries = [...entries, scenario]
      else entries = entries.map((entry, at) => (at === index ? scenario : entry))
      if (activeId === undefined) activeId = scenario.fields.id
      await persist()
      changed()
      return snapshot()
    },
    /**
     * Drop one scenario, refusing to empty the library.
     * @param id - scenario id.
     * @returns the new state after the write settled.
     * @throws {ScenarioError} for an unknown id or the last remaining scenario.
     */
    async remove(id) {
      requireScenario(id)
      if (entries.length === 1) throw new ScenarioError('the library must keep at least one scenario')
      entries = entries.filter(scenario => scenario.fields.id !== id)
      if (activeId === id) activeId = entries[0].fields.id
      await persist()
      changed()
      return snapshot()
    },
    /**
     * Replace the whole library, which is how a page saves a reordered list.
     * @param document - `{ scenarios, activeId }`.
     * @returns the new state after the write settled.
     * @throws {ScenarioError} when the list is not a valid library.
     */
    async replace(document) {
      const scenarios = document?.scenarios
      if (!Array.isArray(scenarios) || scenarios.length === 0) throw new ScenarioError('the library must list at least one scenario')
      adopt(scenarios, document.activeId)
      await persist()
      changed()
      return snapshot()
    },
  })
}

/** Answer one JSON request body, or the 400 that explains why it cannot. */
async function readJson(request, what) {
  try {
    return await request.json()
  } catch {
    throw new ScenarioError(`${what} expects a JSON body`)
  }
}

/**
 * Register the simulation service and the Web page routes.
 * @param ctx - plugin context.
 */
export function apply(ctx) {
  const service = createService(ctx)
  ctx.provide(SERVICE, service)

  /** Map a rejected edit onto the status the page reports. */
  const rejection = error => (error instanceof ScenarioError
    ? new Response(JSON.stringify({ ok: false, error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } })
    : undefined)

  // The page routes need the browser carrier; the service itself works headless.
  ctx.inject(['connection'], (child) => {
    const route = (path, methods, fetch) => {
      child.connection.fetch.register({ path, methods, requestBody: 'buffered', fetch })
    }
    route(STATE_PATH, ['GET'], () => Promise.resolve(Response.json(service.state(), { headers: { 'cache-control': 'no-store' } })))
    route(ACTIVATE_PATH, ['POST'], async (request) => {
      try {
        const body = await readJson(request, 'activate')
        await service.activate(body?.id)
        return Response.json({ ok: true, state: service.state() }, { headers: { 'cache-control': 'no-store' } })
      } catch (error) {
        const failure = rejection(error)
        if (failure !== undefined) return failure
        throw error
      }
    })
    route(SAVE_PATH, ['POST'], async (request) => {
      try {
        const body = await readJson(request, 'save')
        const state = Array.isArray(body?.scenarios) ? await service.replace(body) : await service.upsert(body)
        return Response.json({ ok: true, state }, { headers: { 'cache-control': 'no-store' } })
      } catch (error) {
        const failure = rejection(error)
        if (failure !== undefined) return failure
        throw error
      }
    })
    route(REMOVE_PATH, ['POST'], async (request) => {
      try {
        const body = await readJson(request, 'remove')
        return Response.json({ ok: true, state: await service.remove(body?.id) }, { headers: { 'cache-control': 'no-store' } })
      } catch (error) {
        const failure = rejection(error)
        if (failure !== undefined) return failure
        throw error
      }
    })
  })
}
