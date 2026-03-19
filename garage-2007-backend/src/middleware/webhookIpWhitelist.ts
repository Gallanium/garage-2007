import type { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger.js'

// Telegram Bot API webhook IP ranges
// https://core.telegram.org/bots/webhooks#the-short-version
const TELEGRAM_CIDRS = [
  { base: ipToNum('149.154.160.0'), mask: 20 },
  { base: ipToNum('91.108.4.0'), mask: 22 },
]

function ipToNum(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
}

function isInCidr(ip: string, cidr: { base: number; mask: number }): boolean {
  const num = ipToNum(ip)
  const shift = 32 - cidr.mask
  return (num >>> shift) === (cidr.base >>> shift)
}

function extractIPv4(raw: string): string {
  // Handle ::ffff: prefix for IPv6-mapped IPv4
  if (raw.startsWith('::ffff:')) return raw.slice(7)
  return raw
}

export function webhookIpWhitelist(req: Request, res: Response, next: NextFunction): void {
  // Skip in development
  if (process.env.NODE_ENV !== 'production') {
    next()
    return
  }

  const rawIp = req.ip ?? ''
  const ip = extractIPv4(rawIp)

  const allowed = TELEGRAM_CIDRS.some(cidr => isInCidr(ip, cidr))
  if (!allowed) {
    logger.warn({ ip: rawIp }, 'webhook_ip_rejected')
    res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'IP not allowed' })
    return
  }

  next()
}
