// src/services/apiService.ts
// API client for server-authoritative backend.
// All game state mutations go through the server.

const API_BASE = import.meta.env.VITE_API_URL || '/api'
let authToken: string | null = null
let isRefreshing = false

/** Get the API base URL (used by keepalive fetch on beforeunload) */
export function getApiBase(): string {
  return API_BASE
}

/** Whether we have an active backend connection */
export function isOnline(): boolean {
  return authToken !== null
}

/** Get current auth token (for keepalive fetch on page unload) */
export function getToken(): string | null {
  return authToken
}

/** Set auth token (used after successful authentication) */
export function setToken(token: string): void {
  authToken = token
}

/** Clear auth token (e.g. on logout or token expiry) */
export function clearToken(): void {
  authToken = null
}

/** Get Telegram initData for re-authentication */
function getInitData(): string | null {
  try {
    return window.Telegram?.WebApp?.initData ?? null
  } catch {
    return null
  }
}

/** Fetch with auto-re-auth on 401 */
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = authToken
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  })

  if (res.status === 401 && !isRefreshing) {
    isRefreshing = true
    try {
      const initData = getInitData()
      if (initData) {
        const ok = await authenticate(initData)
        if (ok) {
          isRefreshing = false
          // Retry with new token
          return fetch(url, {
            ...options,
            headers: { ...options.headers, Authorization: `Bearer ${authToken}` },
          })
        }
      }
    } finally {
      isRefreshing = false
    }
  }

  return res
}

/** Fetch with exponential backoff retry for network errors */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchWithAuth(url, options)
    } catch (err) {
      if (attempt === maxRetries) throw err
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
    }
  }
  throw new Error('Unreachable')
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  useRetry = false,
): Promise<T | null> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }

  const fetchOptions: RequestInit = { ...options, headers }
  const url = `${API_BASE}${path}`

  try {
    let res: Response
    if (authToken) {
      // Use fetchWithAuth (auto-re-auth on 401) or fetchWithRetry (+ backoff)
      res = useRetry
        ? await fetchWithRetry(url, fetchOptions)
        : await fetchWithAuth(url, fetchOptions)
    } else {
      res = await fetch(url, fetchOptions)
    }

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
  // authenticate does NOT use fetchWithAuth/fetchWithRetry to avoid circular dependency
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const res = await fetch(`${API_BASE}/auth/telegram`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ initData }),
    })
    if (!res.ok) return null
    const data = await res.json() as AuthResponse
    if (data?.token) {
      authToken = data.token
    }
    return data
  } catch {
    return null
  }
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
    body: JSON.stringify({
      clicksSinceLastSync,
      clientTimestamp: Date.now(),
      syncNonce: crypto.randomUUID(),
    }),
  }, true)
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
  // Auto-generate idempotencyKey if not provided.
  // Key is generated BEFORE fetchWithRetry — same key for all retries.
  const key = idempotencyKey ?? crypto.randomUUID()
  return apiFetch<ActionResponse>('/game/action', {
    method: 'POST',
    body: JSON.stringify({ type, payload, idempotencyKey: key }),
  }, true)
}

// ── Purchases ───────────────────────────────────────────────────────────────

export async function createInvoice(packId: string): Promise<string | null> {
  const data = await apiFetch<{ invoiceUrl: string }>('/purchase/create-invoice', {
    method: 'POST',
    body: JSON.stringify({ packId }),
  })
  return data?.invoiceUrl ?? null
}
