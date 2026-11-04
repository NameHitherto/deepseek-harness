/**
 * Scoped time tool for the Research Agent preset.
 *
 * Contributes the `get_current_time` tool. It reports the clock owned by the
 * `data-simulation` plugin when that plugin is active, and the real system clock
 * otherwise, so the model never has to infer the present moment.
 *
 * This file imports nothing: the plugin is linked into a profile, where a bare
 * package specifier would have to resolve against the profile's dependency
 * table rather than against this directory.
 *
 * @module @local/get-time
 */

/** Loader diagnostics name for this plugin. */
export const name = 'get-time'

/** Services that must exist before this tool can be declared. */
export const inject = ['tools', 'systemPrompt']

/** Tool name presented to the model. */
const TOOL_NAME = 'get_current_time'

/** Prompt-section name; unique within this deployment's prompt. */
const SECTION_NAME = 'tool:get-current-time'

const DESCRIPTION = [
  'Read the current date and time and the weekday.',
  'Call it whenever the answer depends on the present moment: a relative date, an elapsed interval,',
  'a deadline, or a timestamp to record. Do not infer the current time from memory or from the conversation.',
  'It reports the deployment\'s simulated clock when a data-simulation scenario is active,',
  'and the real system clock otherwise; the result says which one supplied the reading.',
].join(' ')

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Validate an IANA zone name.
 * @param timeZone - candidate zone.
 * @returns the zone name.
 * @throws {TypeError} when the runtime does not know it.
 */
function resolveZone(timeZone) {
  const candidate = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate })
  } catch {
    throw new TypeError(`get-time: timeZone "${String(candidate)}" is not an IANA zone name known to this runtime`)
  }
  return candidate
}

/**
 * Config as a Standard Schema, the interface the Loader validates a row with.
 * The plugin cannot import schemastery, so this declares the one field it reads
 * and rejects anything else rather than ignoring an unknown key.
 */
export const Config = {
  '~standard': {
    version: 1,
    vendor: 'local',
    validate(value) {
      const config = value ?? {}
      if (typeof config !== 'object' || Array.isArray(config)) {
        return { issues: [{ message: 'config must be an object', path: [] }] }
      }
      const unknown = Object.keys(config).filter(key => key !== 'timeZone')
      if (unknown.length > 0) {
        return { issues: unknown.map(key => ({ message: `unknown config field "${key}"`, path: [key] })) }
      }
      if (config.timeZone !== undefined && typeof config.timeZone !== 'string') {
        return { issues: [{ message: 'timeZone must be an IANA zone name', path: ['timeZone'] }] }
      }
      try {
        return { value: { timeZone: resolveZone(config.timeZone) } }
      } catch (error) {
        return { issues: [{ message: error.message, path: ['timeZone'] }] }
      }
    },
  },
}

/** Output schema in the registry's JSON Schema subset. */
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    simulated: { type: 'boolean', description: 'True when a data-simulation scenario supplied the reading.' },
    scenario: { type: 'string', description: 'Id of the simulation scenario, when one supplied the reading.' },
    instant: { type: 'string', description: 'The instant in UTC, ISO 8601.' },
    timeZone: { type: 'string', description: 'Zone label of the reading.' },
    utcOffset: { type: 'string', description: 'UTC offset of the reading, such as +08:00.' },
    localDate: { type: 'string', description: 'Local calendar date, YYYY-MM-DD.' },
    localTime: { type: 'string', description: 'Local date and clock time, YYYY-MM-DD HH:MM:SS.' },
    weekday: { type: 'string', description: 'Weekday name in English.' },
    source: { type: 'string', enum: ['data-simulation', 'system'], description: 'Which clock answered.' },
  },
  required: ['simulated', 'instant', 'timeZone', 'utcOffset', 'localDate', 'localTime', 'weekday', 'source'],
  additionalProperties: false,
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
 * Read the real system clock in the deployment's display zone.
 * @param zone - IANA zone name.
 * @returns the same reading fields the simulation service reports.
 */
function systemReading(zone) {
  const now = Date.now()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = {}
  for (const part of formatter.formatToParts(new Date(now))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  const date = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
  return {
    simulated: false,
    instant: new Date(now).toISOString(),
    timeZone: zone,
    utcOffset: offsetLabel(Math.round((asUtc - now) / 60_000)),
    localDate: date,
    localTime: `${date} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`,
    weekday: WEEKDAYS[new Date(asUtc).getUTCDay()],
    source: 'system',
  }
}

/**
 * Read the clock this deployment presents to the model.
 * @param ctx - plugin context; the simulation service is read through `ctx.get`.
 * @param zone - zone used when no simulation supplies the reading.
 * @returns the reading, naming its source.
 */
function readClock(ctx, zone) {
  const simulation = ctx.get('dataSimulation')
  if (simulation === undefined) return systemReading(zone)
  const reading = simulation.current()
  return {
    simulated: true,
    scenario: reading.scenarioId,
    instant: reading.instant,
    timeZone: reading.timeZone,
    utcOffset: reading.utcOffset,
    localDate: reading.localDate,
    localTime: reading.localTime,
    weekday: reading.weekday,
    source: 'data-simulation',
  }
}

/**
 * Render the one model-facing line for a reading. The source is always stated,
 * because "simulated" is a property of the deployment the model cannot infer.
 * @param _args - unused; the tool takes no arguments.
 * @param value - the reading.
 * @returns a single text block.
 */
function render(_args, value) {
  const source = value.source === 'data-simulation'
    ? `simulated by the "${value.scenario}" scenario`
    : 'the system clock'
  return [{
    type: 'text',
    text: `It is ${value.localTime} (${value.weekday}), ${value.timeZone} ${value.utcOffset} — ${source}.`,
  }]
}

/**
 * Register the tool and its prompt section.
 * @param ctx - plugin context.
 * @param config - validated plugin configuration.
 */
export function apply(ctx, config) {
  const zone = resolveZone(config?.timeZone)

  ctx.tools.register({
    name: TOOL_NAME,
    description: DESCRIPTION,
    parameters: { type: 'object', properties: {} },
    output: { schema: OUTPUT_SCHEMA, render },
    // Reading the clock observes a switchable value without changing it.
    isConcurrencySafe: () => true,
    execute: () => Promise.resolve(readClock(ctx, zone)),
  })

  // The tool description already states what the tool does, so this section
  // only states the policy a description cannot: when a call is mandatory.
  ctx.systemPrompt.section({
    name: SECTION_NAME,
    order: 2450,
    text: `Before you state today's date, the current time, or an interval measured from now, call ${TOOL_NAME}. `
      + 'Its answer is authoritative for this deployment even when it disagrees with your training data.',
  })
}
