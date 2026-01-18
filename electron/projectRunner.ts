import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { resolveNpmExecutable, resolveNodeExecutable } from './env'
import { isWindows, quoteCommandForShell } from './platform'
import {
  attachProcessLogging,
  getRunningCommand,
  getRunningProcessEntry,
  isProjectRunning,
  resetProjectLogs,
  setProjectError,
  setProjectRunning,
  setProjectStopped,
} from './projectRegistry'
import type { ProcessEntry } from './types'

const npmErrorMessage =
  'npm was not found. Install Node.js or ensure npm is available in your PATH (e.g. system install, nvm, volta, or asdf).'
const nodeErrorMessage =
  'node was not found. Install Node.js or ensure node is available in your PATH (e.g. system install, nvm, volta, or asdf).'

type ExitNotifier = (payload: { path: string; code: number | null; signal?: NodeJS.Signals | 'error'; command: string }) => void

export async function startProject(projectPath: string, notifyExit: ExitNotifier) {
  if (isProjectRunning(projectPath)) {
    return { status: 'running' as const, command: getRunningCommand(projectPath) }
  }

  const packagePath = path.join(projectPath, 'package.json')
  let packageJson
  try {
    const raw = await fs.readFile(packagePath, 'utf8')
    packageJson = JSON.parse(raw)
  } catch {
    return { status: 'error' as const, message: 'Cannot read package.json.' }
  }

  const scripts = packageJson.scripts ?? {}
  const hasDev = Boolean(scripts.dev)
  const hasStart = Boolean(scripts.start)

  if (!hasDev && !hasStart) {
    return { status: 'error' as const, message: 'Missing dev or start script in package.json.' }
  }

  const command = hasDev ? 'npm run dev' : 'npm start'
  const args = hasDev ? ['run', 'dev'] : ['start']
  const npmExecutable = resolveNpmExecutable()
  if (!npmExecutable) {
    return { status: 'error' as const, message: npmErrorMessage }
  }
  const nodeExecutable = resolveNodeExecutable()
  if (!nodeExecutable) {
    return { status: 'error' as const, message: nodeErrorMessage }
  }

  const child = spawn(quoteCommandForShell(npmExecutable), args, {
    cwd: projectPath,
    env: { ...process.env },
    shell: isWindows,
    detached: !isWindows,
  })

  const entry: ProcessEntry = { process: child, command }
  resetProjectLogs(projectPath)
  setProjectRunning(projectPath, entry)
  attachProcessLogging(projectPath, child)

  child.on('close', (code, signal) => {
    setProjectStopped(projectPath, command, code)
    notifyExit({ path: projectPath, code, signal: signal ?? undefined, command })
  })

  child.on('error', () => {
    setProjectError(projectPath, command)
    notifyExit({ path: projectPath, code: null, signal: 'error', command })
  })

  return { status: 'running' as const, command }
}

function terminateProcess(entry: ProcessEntry) {
  const child = entry.process
  if (!child.pid) {
    return
  }

  if (isWindows) {
    spawn('taskkill', ['/pid', `${child.pid}`, '/t', '/f'])
    return
  }

  const pid = child.pid
  const killTree = (signal: NodeJS.Signals) => {
    try {
      process.kill(-pid, signal)
    } catch {
      try {
        process.kill(pid, signal)
      } catch {
        return
      }
    }
  }

  killTree('SIGTERM')
  const timeout = setTimeout(() => killTree('SIGKILL'), 5000)
  child.once('exit', () => clearTimeout(timeout))
}

export function stopProject(projectPath: string) {
  const entry = getRunningProcessEntry(projectPath)
  if (!entry) {
    return { status: 'stopped' as const }
  }

  terminateProcess(entry)
  setProjectStopped(projectPath, entry.command, null)
  return { status: 'stopped' as const }
}

export async function installProject(projectPath: string) {
  if (isProjectRunning(projectPath)) {
    return { status: 'error' as const, message: 'Process is currently running. Stop it before installing.' }
  }

  const npmExecutable = resolveNpmExecutable()
  if (!npmExecutable) {
    return { status: 'error' as const, message: npmErrorMessage }
  }
  const nodeExecutable = resolveNodeExecutable()
  if (!nodeExecutable) {
    return { status: 'error' as const, message: nodeErrorMessage }
  }

  const child = spawn(quoteCommandForShell(npmExecutable), ['install'], {
    cwd: projectPath,
    env: { ...process.env },
    shell: isWindows,
  })

  resetProjectLogs(projectPath)
  attachProcessLogging(projectPath, child, '> npm install\n')

  return new Promise((resolve) => {
    child.on('close', (code) => {
      resolve({ status: code === 0 ? 'success' : 'error', code })
    })
    child.on('error', (err) => {
      resolve({ status: 'error', message: err.message })
    })
  })
}
