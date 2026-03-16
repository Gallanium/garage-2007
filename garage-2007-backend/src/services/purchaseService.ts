// Purchase service — Stars invoice creation + nut crediting
// Implementation in Phase 4

export const NUTS_PACKS = {
  nuts_100:  { stars: 50,  nuts: 100,  label: '100 гаек'  },
  nuts_500:  { stars: 200, nuts: 500,  label: '500 гаек'  },
  nuts_1500: { stars: 500, nuts: 1500, label: '1500 гаек' },
} as const

export const purchaseService = {
  // createStarsInvoice(userId, packId): call Telegram Bot API → return invoice URL
  // processPayment(payload): deduplicate, Prisma transaction, credit nuts, audit log
}
