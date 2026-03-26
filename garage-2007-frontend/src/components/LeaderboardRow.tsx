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
      className={`flex items-center rounded-lg p-2 font-mono transition-all
        ${isMe
          ? 'border-2 border-orange-700 bg-orange-950/20'
          : 'border border-gray-800 bg-gray-900'
        }`}
    >
      <span className={`w-8 text-[9px] font-bold ${isMe ? 'text-orange-400' : rankColor}`}>
        #{entry.rank}
      </span>
      <span className={`flex-1 text-[9px] truncate ${isMe ? 'text-orange-400' : 'text-white'}`}>
        {isMe && '\u2B50 '}{entry.name}
      </span>
      <span className="text-cyan-400 text-[8px] tabular-nums">
        {formatLargeNumber(entry.totalEarned)} \u20BD
      </span>
    </div>
  )
}
