import { afterEach, beforeEach, vi } from 'vitest'

// ── Test environment variables ───────────────────────────────────────────────
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/garage2007_test'
process.env.BOT_TOKEN = 'test_bot_token_1234567890:ABCDEFghijklmnop'
process.env.WEBHOOK_SECRET = 'test_webhook_secret_abc123'
process.env.JWT_SECRET = 'test_jwt_secret_at_least_32_characters_long!'
process.env.PORT = '3099'
process.env.NODE_ENV = 'test'
process.env.FRONTEND_URL = 'http://localhost:5173'
process.env.LOG_LEVEL = 'silent'

// ── Mock env.ts to prevent process.exit(1) on import ─────────────────────────
vi.mock('../src/config/env.js', () => ({
  env: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/garage2007_test',
    BOT_TOKEN: 'test_bot_token_1234567890:ABCDEFghijklmnop',
    WEBHOOK_SECRET: 'test_webhook_secret_abc123',
    JWT_SECRET: 'test_jwt_secret_at_least_32_characters_long!',
    PORT: 3099,
    NODE_ENV: 'test' as const,
    FRONTEND_URL: 'http://localhost:5173',
    LOG_LEVEL: 'silent' as const,
  },
}))

// ── Mock pino-http (suppress request logging in tests) ──────────────────────
vi.mock('pino-http', () => {
  const passthrough = (_req: unknown, _res: unknown, next: () => void) => next()
  return {
    default: vi.fn(() => passthrough),
    __esModule: true,
  }
})

// ── Mock pino logger (suppress output in tests) ─────────────────────────────
vi.mock('pino', () => {
  const noop = () => mockLogger
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => mockLogger),
    level: 'silent',
    levels: {
      values: { fatal: 60, error: 50, warn: 40, info: 30, debug: 20, trace: 10 },
      labels: { 60: 'fatal', 50: 'error', 40: 'warn', 30: 'info', 20: 'debug', 10: 'trace' },
    },
  }
  return { default: vi.fn(() => mockLogger) }
})

// ── Mock Prisma Client ──────────────────────────────────────────────────────
// Each test file that needs Prisma should import and configure prismaMock from helpers.ts.
// This global mock ensures no real DB connections are made.
vi.mock('@prisma/client', () => {
  const mockPrismaClient = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    gameSave: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    transaction: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    balanceLog: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $transaction: vi.fn((args: unknown) => {
      if (Array.isArray(args)) return Promise.resolve(args)
      if (typeof args === 'function') return (args as (tx: unknown) => unknown)(mockPrismaClient)
      return Promise.resolve()
    }),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  }

  // Must be a real constructor (new PrismaClient() must work)
  function MockPrismaClient() { return mockPrismaClient }
  Object.assign(MockPrismaClient, { prototype: mockPrismaClient })

  return {
    PrismaClient: MockPrismaClient,
    Prisma: { DbNull: Symbol('DbNull') },
    __mockClient: mockPrismaClient,
  }
})

// ── Global hooks ─────────────────────────────────────────────────────────────
beforeEach(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})

  // Clear initData replay cache between tests
  const { _resetReplayCache } = await import('../src/services/telegramAuthService.js')
  _resetReplayCache()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})
