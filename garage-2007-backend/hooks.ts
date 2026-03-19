import { resolve as resolvePath, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sharedDir = resolvePath(__dirname, '..', 'shared')

export async function resolve(
  specifier: string,
  context: { parentURL?: string; conditions: string[] },
  nextResolve: Function,
): Promise<{ url: string; shortCircuit?: boolean }> {
  // Handle @shared/* alias
  if (specifier.startsWith('@shared/')) {
    const rest = specifier.slice('@shared/'.length).replace(/\.js$/, '.ts')
    const resolved = resolvePath(sharedDir, rest)
    return { url: pathToFileURL(resolved).href, shortCircuit: true }
  }

  // Handle relative .js imports inside shared/ → rewrite to .ts
  if (specifier.endsWith('.js') && context.parentURL) {
    const parentPath = fileURLToPath(context.parentURL)
    if (parentPath.startsWith(sharedDir)) {
      const parentDir = dirname(parentPath)
      const tsPath = resolvePath(parentDir, specifier.replace(/\.js$/, '.ts'))
      if (existsSync(tsPath)) {
        return { url: pathToFileURL(tsPath).href, shortCircuit: true }
      }
    }
  }

  return nextResolve(specifier, context)
}
