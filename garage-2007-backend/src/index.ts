import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'
import { errorHandler } from './middleware/errorHandler.js'
import healthRoutes from './routes/healthRoutes.js'
import authRoutes from './routes/authRoutes.js'
import gameRoutes from './routes/gameRoutes.js'
import purchaseRoutes from './routes/purchaseRoutes.js'

const app = express()

// Global middleware
app.use(cors({
  origin: env.NODE_ENV === 'production' ? [env.FRONTEND_URL] : true,
  credentials: true,
}))
app.use(express.json({ limit: '16kb' }))

// Routes
app.use('/api', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/game', gameRoutes)
app.use('/api/purchase', purchaseRoutes)

// Error handler (must be last)
app.use(errorHandler)

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started')
})

export default app
