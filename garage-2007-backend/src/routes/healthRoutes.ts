import { Router } from 'express'
import { prisma } from '../utils/prisma.js'

const router = Router()

router.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', db: 'connected', timestamp: Date.now() })
  } catch {
    res.status(503).json({ status: 'degraded', db: 'unreachable', timestamp: Date.now() })
  }
})

export default router
