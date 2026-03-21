import type { Request, Response } from 'express'
import { validateInitData } from '../services/telegramAuthService.js'
import { signToken } from '../utils/jwt.js'
import { prisma } from '../utils/prisma.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'
import { AppError } from '../middleware/errorHandler.js'

export async function telegramAuth(req: Request, res: Response): Promise<void> {
  const { initData } = req.body as { initData: string }

  const tgUser = validateInitData(initData, env.BOT_TOKEN)
  if (!tgUser) {
    throw new AppError(401, 'INVALID_INIT_DATA', 'Invalid or expired Telegram init data')
  }

  const user = await prisma.user.upsert({
    where: { telegramId: BigInt(tgUser.id) },
    update: {
      username: tgUser.username ?? null,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name ?? null,
      isPremium: tgUser.is_premium ?? false,
      languageCode: tgUser.language_code ?? null,
    },
    create: {
      telegramId: BigInt(tgUser.id),
      username: tgUser.username ?? null,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name ?? null,
      isPremium: tgUser.is_premium ?? false,
      languageCode: tgUser.language_code ?? null,
    },
  })

  const isNew = user.createdAt.getTime() === user.updatedAt.getTime()

  // Increment session count on each auth (moved from loadState for idempotency)
  if (!isNew) {
    await prisma.gameSave.updateMany({
      where: { userId: user.id },
      data: {
        sessionCount: { increment: 1 },
        lastSessionDate: new Date().toISOString().split('T')[0],
      },
    })
  }

  const token = signToken({ sub: user.id, tgId: tgUser.id })

  logger.info({ tgId: tgUser.id, userId: user.id, isNew }, 'auth_success')

  res.json({
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      isNew,
    },
  })
}
