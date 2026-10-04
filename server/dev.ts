import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'

const children: ChildProcess[] = [
  spawn(process.execPath, ['--experimental-strip-types', '--watch', 'server/index.ts'], { stdio: 'inherit' }),
  spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js')], { stdio: 'inherit' }),
]

let closing = false

function stop(code = 0) {
  if (closing) return
  closing = true
  for (const child of children) {
    if (!child.killed) child.kill()
  }
  process.exit(code)
}

for (const child of children) {
  child.on('exit', (code) => {
    if (!closing) stop(code ?? 0)
  })
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
