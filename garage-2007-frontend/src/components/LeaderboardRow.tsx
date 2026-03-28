import { formatLargeNumber } from '../store/gameStore'
import type { LeaderboardEntry } from '@shared/types/leagues'

interface LeaderboardRowProps {
  entry: LeaderboardEntry
}

const RANK_COLORS: Record<number, string> = {
  1: 'text-amber-400',
  2: 'text-gray-300',
  3: 'text-amber-700',
}

export function LeaderboardRow({ entry }: LeaderboardRowProps) {
  const isMe = entry.isCurrentUser
  const rankColor = RANK_COLORS[entry.rank] ?? 'text-gray-500'

  return (
    <div
      className={`flex items-center rounded-lg p-3 font-mono transition-all
        ${isMe
          ? 'bg-gradient-to-br from-orange-950/15 to-gray-900 border border-orange-700/30'
          : 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50'
        }`}
    >
      <span className={`w-8 text-[10px] font-bold ${isMe ? 'text-orange-400' : rankColor}`}>
        #{entry.rank}
      </span>
      <span className={`flex-1 text-[9px] truncate ${isMe ? 'text-orange-400' : 'text-white'}`}>
        {isMe && '\u2B50 '}{entry.name}
      </span>
      <span className="text-cyan-400 text-[9px] font-bold tabular-nums">
        {formatLargeNumber(entry.totalEarned)} ₽
      </span>
    </div>
  )
}
