import { Shield, Wrench, Settings, HardHat, Zap, Star, Gem, Crown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const TIER_ICONS: Record<string, LucideIcon> = {
  Shield, Wrench, Settings, HardHat, Zap, Star, Gem, Crown,
}

interface TierIconProps {
  icon: string
  className?: string
}

export function TierIcon({ icon, className = 'w-4 h-4' }: TierIconProps) {
  const Icon = TIER_ICONS[icon] ?? Shield
  return <Icon className={className} />
}
