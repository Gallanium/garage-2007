import type { NutsPackId, NutsPack } from '../types/purchase.js'

export const NUTS_PACKS: Record<NutsPackId, NutsPack> = {
  nuts_100:  { stars: 50,  nuts: 100,  label: '100 гаек'  },
  nuts_500:  { stars: 200, nuts: 500,  label: '500 гаек'  },
  nuts_1500: { stars: 500, nuts: 1500, label: '1500 гаек' },
} as const

export const NUTS_PACK_ORDER: NutsPackId[] = ['nuts_100', 'nuts_500', 'nuts_1500']
