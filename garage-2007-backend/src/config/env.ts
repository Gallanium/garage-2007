import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BOT_TOKEN: z.string().min(1),
  WEBHOOK_SECRET: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(3).default(1),
  REDIS_URL: z.string().url().optional(),
  DEV_BYPASS_AUTH: z.enum(['true', 'false']).default('false'),
  REWARDED_VIDEO_ENABLED: z.enum(['true', 'false']).default('false'),
})
.refine(
  (data) => data.NODE_ENV !== 'production' || data.REDIS_URL,
  { message: 'REDIS_URL is required in production for distributed rate limiting and replay cache', path: ['REDIS_URL'] },
)

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.format()
    console.error('Invalid environment variables:', formatted)
    process.exit(1)
  }
  return result.data
}

export const env = loadEnv()
