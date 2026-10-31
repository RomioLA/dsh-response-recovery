import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const packages = resolve(process.env.DSH_MODULES
  ?? 'E:/AI/DeepSeek Harness/resources/app/dsh/node_modules/@deepseek-ai')
const cache = new Map()

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('@deepseek-ai/')) return nextResolve(specifier, context)
    const parts = specifier.slice('@deepseek-ai/'.length).split('/')
    const name = parts.shift()
    let pkg = cache.get(name)
    if (!pkg) {
      pkg = JSON.parse(readFileSync(join(packages, name, 'package.json'), 'utf8'))
      cache.set(name, pkg)
    }
    const key = parts.length ? './' + parts.join('/') : '.'
    const entry = pkg.exports?.[key]
    const target = typeof entry === 'string' ? entry
      : entry?.default ?? (key === '.' ? pkg.main : undefined)
    if (!target || target.includes('*')) return nextResolve(specifier, context)
    return { url: pathToFileURL(join(packages, name, target)).href, shortCircuit: true }
  },
})
