interface PrismaErrorMeta {
  target?: string | string[]
}

interface PrismaKnownErrorLike {
  code?: string
  meta?: PrismaErrorMeta
}

function normalizeTargets(meta?: PrismaErrorMeta): string[] {
  const target = meta?.target
  if (Array.isArray(target)) {
    return target.map(String)
  }
  if (typeof target === 'string') {
    return [target]
  }
  return []
}

export function isPrismaUniqueConstraintError(err: unknown, fields?: string[]): boolean {
  if (!err || typeof err !== 'object') {
    return false
  }

  const prismaErr = err as PrismaKnownErrorLike
  if (prismaErr.code !== 'P2002') {
    return false
  }

  if (!fields || fields.length === 0) {
    return true
  }

  const targets = normalizeTargets(prismaErr.meta)
  return fields.some(field => targets.some(target => target.includes(field)))
}
