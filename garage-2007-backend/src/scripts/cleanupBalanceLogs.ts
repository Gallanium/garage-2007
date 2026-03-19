import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ECONOMY_ACTION_TYPES = ['click_income', 'passive_income', 'offline_income']
const ECONOMY_TTL_DAYS = 30
const TRANSACTION_TTL_DAYS = 90

async function cleanupBalanceLogs(): Promise<void> {
  const economyCutoff = new Date(Date.now() - ECONOMY_TTL_DAYS * 24 * 60 * 60 * 1000)
  const transactionCutoff = new Date(Date.now() - TRANSACTION_TTL_DAYS * 24 * 60 * 60 * 1000)

  // Delete economy logs older than 30 days
  const economyResult = await prisma.balanceLog.deleteMany({
    where: {
      actionType: { in: ECONOMY_ACTION_TYPES },
      createdAt: { lt: economyCutoff },
    },
  })

  // Delete transaction logs older than 90 days
  const transactionResult = await prisma.balanceLog.deleteMany({
    where: {
      actionType: { notIn: ECONOMY_ACTION_TYPES },
      createdAt: { lt: transactionCutoff },
    },
  })

  console.log(`Deleted ${economyResult.count} economy logs (older than ${ECONOMY_TTL_DAYS} days)`)
  console.log(`Deleted ${transactionResult.count} transaction logs (older than ${TRANSACTION_TTL_DAYS} days)`)
}

cleanupBalanceLogs()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
