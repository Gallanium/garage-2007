import crypto from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'
import { errorHandler } from './middleware/errorHandler.js'
import healthRoutes from './routes/healthRoutes.js'
import authRoutes from './routes/authRoutes.js'
import gameRoutes from './routes/gameRoutes.js'
import purchaseRoutes from './routes/purchaseRoutes.js'

const app = express()

// Security headers
app.use(helmet())

// CORS
app.use(cors({
  origin: env.NODE_ENV === 'production' ? [env.FRONTEND_URL] : true,
  credentials: true,
}))

// Body parsing
app.use(express.json({ limit: '16kb' }))

// HTTP request logging — ESM/CJS interop
const pinoHttpFn = typeof pinoHttp === 'function' ? pinoHttp : pinoHttp.default
const httpLogger = (pinoHttpFn as typeof pinoHttp.default)({
  logger,
  genReqId: () => crypto.randomUUID(),
  autoLogging: {
    ignore: (req: IncomingMessage) => req.url === '/api/health',
  },
  customProps: (req: IncomingMessage) => ({
    userId: (req as Express.Request).user?.id,
  }),
  serializers: {
    req: (req: Record<string, unknown>) => ({
      id: req['id'],
      method: req['method'],
      url: req['url'],
    }),
    res: (res: Record<string, unknown>) => ({
      statusCode: res['statusCode'],
    }),
  },
})
app.use(httpLogger)

// Routes
app.use('/api', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/game', gameRoutes)
app.use('/api/purchase', purchaseRoutes)

// Error handler (must be last)
app.use(errorHandler)

export default app
