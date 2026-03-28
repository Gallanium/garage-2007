import { prisma } from '../../utils/prisma.js'
import { AppError } from '../../middleware/errorHandler.js'
import { updateGameSaveWithLock, withOccRetry } from '../../utils/occ.js'
import { gsToNumbers } from '../../utils/decimal.js'
import { buildGameState } from '../gameStateService.js'
import { DECORATION_CATALOG } from '@shared/constants/decorations.js'
import { toggleDecorationPayload } from '../../validation/gameSchemas.js'
import {
  checkIdempotencyInTx,
  type ActionResult,
} from '../helpers/actionHelpers.js'

// ── 5. toggle_decoration ────────────────────────────────────────────────────

export async function handleToggleDecoration(
  userId: number,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const { decorationId } = toggleDecorationPayload.parse(payload)
    const gs = gsToNumbers(await tx.gameSave.findUnique({ where: { userId } }))
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')
    await checkIdempotencyInTx(tx, idempotencyKey)

    if (!gs.decorationsOwned.includes(decorationId)) {
      throw new AppError(400, 'DECORATION_NOT_FOUND', 'Decoration not owned')
    }

    const isActive = gs.decorationsActive.includes(decorationId)
    let newActive: string[]

    if (isActive) {
      // Deactivate
      newActive = gs.decorationsActive.filter(id => id !== decorationId)
    } else {
      // Activate — deactivate others in same slot
      const dec = DECORATION_CATALOG[decorationId]
      newActive = gs.decorationsActive.filter(id => {
        const d = DECORATION_CATALOG[id]
        return d && dec && d.slot !== dec.slot
      })
      newActive.push(decorationId)
    }

    const updated = await updateGameSaveWithLock(tx, userId, gs, {
      decorationsActive: newActive,
    })

    if (idempotencyKey) {
      await tx.balanceLog.create({
        data: {
          userId, actionType: 'toggle_decoration', currency: 'rubles',
          amount: 0, balanceBefore: gs.balance, balanceAfter: gs.balance,
          metadata: { decorationId, active: !isActive }, idempotencyKey,
        },
      })
    }

    return {
      success: true,
      gameState: buildGameState(updated),
      actionResult: { decorationId, active: !isActive },
    }
  }))
}
