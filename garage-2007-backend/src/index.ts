import app from './app.js'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'
import { prisma } from './utils/prisma.js'

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started')
})

// Graceful shutdown
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, 'Shutting down gracefully')
    server.close(async () => {
      await prisma.$disconnect()
      process.exit(0)
    })
  })
}

export default app
