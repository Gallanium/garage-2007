import type { IncomingMessage } from 'node:http'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { requestContextMiddleware, getRequestId } from './utils/requestContext.js'
import healthRoutes from './routes/healthRoutes.js'
import authRoutes from './routes/authRoutes.js'
import gameRoutes from './routes/gameRoutes.js'
import purchaseRoutes from './routes/purchaseRoutes.js'

const app = express()

// Trust proxy (required for express-rate-limit behind reverse proxy / ngrok)
app.set('trust proxy', env.TRUST_PROXY)

// Security headers
app.use(helmet())

// CORS
app.use(cors({
  origin: env.NODE_ENV === 'production' ? [env.FRONTEND_URL] : true,
  credentials: true,
}))

// Request context (AsyncLocalStorage — requestId for audit logs)
app.use(requestContextMiddleware as express.RequestHandler)

// Body parsing
app.use(express.json({ limit: '16kb' }))

// HTTP request logging
// pino-http must create its own logger (not reuse app logger) because
// pino loggers created with `transport` option lose internal symbols
// that pino-http relies on (stringifySym).
const pinoHttpFn = typeof pinoHttp === 'function' ? pinoHttp : pinoHttp.default
const httpLogger = (pinoHttpFn as typeof pinoHttp.default)({
  level: env.LOG_LEVEL,
  transport: env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  genReqId: () => getRequestId(),
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
