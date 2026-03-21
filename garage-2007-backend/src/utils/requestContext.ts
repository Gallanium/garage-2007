import { AsyncLocalStorage } from 'node:async_hooks'
import crypto from 'node:crypto'

interface RequestContext {
  requestId: string
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>()

/** Get the current request ID (or 'unknown' outside a request context) */
export function getRequestId(): string {
  return asyncLocalStorage.getStore()?.requestId ?? 'unknown'
}

/** Express middleware that creates a request context with a unique ID */
export function requestContextMiddleware(
  req: { headers: Record<string, string | string[] | undefined> },
  _res: unknown,
  next: () => void,
): void {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID()
  asyncLocalStorage.run({ requestId }, next)
}
