/** Instance-scoped, in-memory simulation data for research plugins. */
import { Service, type Context } from '@deepseek-ai/cordis'

/** Available simulation data and its value types. */
export interface MockDataValues {
  /** Current time as an ISO 8601 timestamp. */
  currentTime: string
  /** Prompt text for the study task. */
  taskPrompt: string
  /** Expected outcome summaries for scoring, stored as a frozen copy. */
  expectedResults: readonly string[]
}

const copyValue: { [K in keyof MockDataValues]?: (value: MockDataValues[K]) => MockDataValues[K] } = {
  expectedResults: (value) => Object.freeze([...value]),
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** In-memory simulation data provided in this isolation scope. */
    studyMockData: MockDataService
  }
}

/** Identifies invalid initialization or access. */
export class MockDataError extends Error {
  /**
   * Describe the rejected data operation.
   * @param code - Initialization or access failure.
   * @param key - Entry involved in the failure.
   */
  constructor(
    public readonly code: 'already-initialized' | 'not-initialized',
    public readonly key: keyof MockDataValues,
  ) {
    super(`Mock data "${key}": ${code}`)
    this.name = 'MockDataError'
  }
}

/** Stores data until its initializing plugin unloads. */
export default class MockDataService extends Service {
  private readonly values: Partial<MockDataValues> = {}

  /**
   * Publish an empty data store in the provider's isolation scope.
   * @param ctx - Context owning the service registration.
   */
  constructor(ctx: Context) {
    super(ctx, 'studyMockData')
  }

  /**
   * Initialize one entry until the calling plugin unloads or disposes it early.
   * @param key - Entry to initialize.
   * @param value - Initial value. The service stores a frozen copy of `expectedResults`.
   * @returns An idempotent disposer that removes this initialization.
   * @throws {MockDataError} If the entry is already initialized; its value is unchanged.
   */
  initialize<K extends keyof MockDataValues>(
    key: K,
    value: MockDataValues[K],
  ): () => void {
    if (Object.hasOwn(this.values, key)) {
      throw new MockDataError('already-initialized', key)
    }

    const copy = copyValue[key]
    return this.ctx.effect(() => {
      this.values[key] = copy ? copy(value) : value
      return () => { delete this.values[key] }
    })
  }

  /**
   * Read initialized data; missing initialization fails without changes.
   * @param key - Entry to read.
   * @returns The stored value.
   * @throws {MockDataError} If the entry has not been initialized or was disposed.
   */
  read<K extends keyof MockDataValues>(key: K): MockDataValues[K] {
    const value = this.values[key]
    if (value === undefined) {
      throw new MockDataError('not-initialized', key)
    }
    return value
  }
}
