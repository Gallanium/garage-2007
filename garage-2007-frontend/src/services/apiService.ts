// src/services/apiService.ts
// API client for server-authoritative backend.
// All game state mutations go through the server.

const API_BASE = import.meta.env.VITE_API_URL || '/api'
let authToken: string | null = null

/** Whether we have an active backend connection */
export function isOnline(): boolean {
  return authToken !== null
}

/** Set auth token (used after successful authentication) */
export function setToken(token: string): void {
  authToken = token
}

/** Clear auth token (e.g. on logout or token expiry) */
export function clearToken(): void {
  authToken = null
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T | null> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
    if (!res.ok) {
      const errorBody = await res.json().catch(() => null)
      if (import.meta.env.DEV) {
        console.warn(`[API] ${options.method ?? 'GET'} ${path} → ${res.status}`, errorBody)
      }
      return null
    }
    return await res.json() as T
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[API] ${path} network error:`, err)
    }
    return null
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────

interface AuthResponse {
  token: string
  user: { id: number; firstName: string; isNew: boolean }
}

export async function authenticate(initData: string): Promise<AuthResponse | null> {
  const data = await apiFetch<AuthResponse>('/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ initData }),
  })
  if (data?.token) {
    authToken = data.token
  }
  return data
}

// ── Game State ──────────────────────────────────────────────────────────────

export interface GameStateResponse {
  gameState: Record<string, unknown> | null
  offlineEarnings?: { amount: number; timeAway: number }
  serverTime: number
}

export async function loadState(): Promise<GameStateResponse | null> {
  return apiFetch<GameStateResponse>('/game/state')
}

// ── Sync ────────────────────────────────────────────────────────────────────

export async function sync(clicksSinceLastSync: number): Promise<GameStateResponse | null> {
  return apiFetch<GameStateResponse>('/game/sync', {
    method: 'POST',
    body: JSON.stringify({ clicksSinceLastSync, clientTimestamp: Date.now() }),
  })
}

// ── Actions ─────────────────────────────────────────────────────────────────

export interface ActionResponse {
  success: boolean
  gameState?: Record<string, unknown>
  actionResult?: Record<string, unknown>
  error?: string
  message?: string
}

export async function performAction(
  type: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResponse | null> {
  return apiFetch<ActionResponse>('/game/action', {
    method: 'POST',
    body: JSON.stringify({ type, payload, idempotencyKey }),
  })
}

// ── Purchases ───────────────────────────────────────────────────────────────

export async function createInvoice(packId: string): Promise<string | null> {
  const data = await apiFetch<{ invoiceUrl: string }>('/purchase/create-invoice', {
    method: 'POST',
    body: JSON.stringify({ packId }),
  })
  return data?.invoiceUrl ?? null
}
