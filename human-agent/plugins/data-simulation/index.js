/**
 * Host half of the data-simulation bundle.
 *
 * Owns a switchable library of simulation scenarios — each carrying a simulated
 * current time, a task prompt, and an expected result — and publishes them as
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
const FORMAT_VERSION = 1

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
 * @returns the stored fields with the parsed instant; the instant is not persisted.
 * @throws {ScenarioError} naming the first field that fails.
 */
function compileScenario(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new ScenarioError('a scenario must be an object')
  const { id, label, time, timeZone, prompt, expectedResult } = input
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
    expectedResult: optionalText(expectedResult, 'expectedResult'),
    ...timeZone === undefined || timeZone === null || timeZone === ''
      ? {}
      : { timeZone: checkZone(timeZone) },
  }
  return { fields: Object.freeze(fields), instant, offsetMinutes: parseOffset(match[7]) }
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
 * receive the scenario's task prompt or expected result.
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
 * Build the shipped scenario library. Every value is a reviewable fixture: a
 * simulated clock, the prompt a task would carry, and the result it should
 * produce, so a consumer can be exercised without a live clock.
 * @returns fresh preset scenarios, in presentation order.
 */
function presetLibrary() {
  return [
    {
      id: 'requirement-review',
      label: 'Requirement review',
      time: '2026-03-02T09:30:00+08:00',
      timeZone: 'Asia/Shanghai',
      prompt: 'Review the draft login requirement and list every unclear acceptance criterion.',
      expectedResult: 'A numbered list of unclear criteria, each with the question that resolves it.',
    },
    {
      id: 'bug-triage',
      label: 'Bug triage',
      time: '2026-07-18T14:05:00+08:00',
      timeZone: 'Asia/Shanghai',
      prompt: 'Sort these three defect reports by user impact and name the first one to fix.',
      expectedResult: 'A ranked list with one sentence of impact per defect and a named first fix.',
    },
    {
      id: 'release-notes',
      label: 'Release notes',
      time: '2026-11-30T18:00:00+08:00',
      timeZone: 'Asia/Shanghai',
      prompt: 'Write the release notes for this version from the merged change list.',
      expectedResult: 'A grouped note with user-facing changes, fixes, and a known-issues section.',
    },
    {
      id: 'offline-utc',
      label: 'UTC maintenance window',
      time: '2026-01-15T02:00:00Z',
      prompt: 'Schedule the maintenance window and state the local start time in Tokyo and Berlin.',
      expectedResult: 'The UTC window plus the two local start times, each with its offset.',
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
    if (document?.version !== FORMAT_VERSION || !Array.isArray(document.scenarios)) {
      throw new Error(`data-simulation: ${file} is not a version ${FORMAT_VERSION} simulation library`)
    }
    return document
  }

  /**
   * Replace the library in memory with validated scenarios.
   * @param list - library entries.
   * @param selected - id to select; falls back to the first entry.
   */
  function adopt(list, selected) {
    const compiled = list.map((row) => {
      try {
        return compileScenario(row)
      } catch (error) {
        throw new Error(`data-simulation: stored scenario "${String(row?.id)}" is invalid — ${error.message}`)
      }
    })
    const seen = new Set()
    for (const scenario of compiled) {
      if (seen.has(scenario.fields.id)) throw new Error(`data-simulation: the library repeats the id "${scenario.fields.id}"`)
      seen.add(scenario.fields.id)
    }
    entries = compiled
    activeId = seen.has(selected) ? selected : compiled[0].fields.id
  }

  const stored = readStored()
  if (stored === undefined) {
    adopt(presetLibrary(), presetLibrary()[0].id)
  } else if (stored.scenarios.length === 0) {
    // Every edit path keeps one scenario, so an empty file is an external edit
    // that would leave the clock reader with nothing to report.
    throw new Error(`data-simulation: ${file} lists no scenarios; restore one or delete the file to reload the presets`)
  } else {
    adopt(stored.scenarios, stored.activeId)
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
    presets: Object.freeze(presetLibrary().map(scenario => Object.freeze({ ...scenario }))),
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
    presets: () => Object.freeze(presetLibrary().map(scenario => Object.freeze({ ...scenario }))),
    /** Id of the selected scenario; the library always holds one. */
    activeId: () => activeId,
    /**
     * Read the simulated clock of the selected scenario.
     * @returns the reading.
     */
    current: () => readingOf(byId(activeId)),
    /**
     * Read the selected scenario including its prompt and expected result.
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
