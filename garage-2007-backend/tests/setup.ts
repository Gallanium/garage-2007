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
      create: vi.fn(),
    },
    $transaction: vi.fn((args: unknown) => {
      if (Array.isArray(args)) return Promise.resolve(args)
      if (typeof args === 'function') return (args as (tx: unknown) => unknown)(mockPrismaClient)
      return Promise.resolve()
    }),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  }

  return {
    PrismaClient: vi.fn(() => mockPrismaClient),
    __mockClient: mockPrismaClient,
  }
})

// ── Global hooks ─────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})
