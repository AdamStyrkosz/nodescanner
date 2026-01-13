import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

type ProjectInfo = {
  path: string
  name: string
  hasDev: boolean
  hasStart: boolean
  status: 'running' | 'stopped' | 'error'
  command?: string
  exitCode?: number | null
}

type PortInfo = {
  port: number
  pid: number
  command: string
  address: string
}

type KillPortResponse = {
  status: 'killed' | 'error'
  message?: string
}

type CommandResult = {
  stdout: string
  stderr: string
  exitCode: number | null
}

type ProcessEntry = {
  process: ChildProcessWithoutNullStreams
  command: string
}

const runningProcesses = new Map<string, ProcessEntry>()
const projectLogs = new Map<string, string[]>()
const projectStates = new Map<string, { status: 'running' | 'stopped' | 'error'; command?: string; exitCode?: number | null }>()
const logLimit = 2000

const ignoredDirs = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '.idea',
  '.vscode',
  'dist',
  'build',
  'out',
  'coverage',
  'tmp',
  'temp',
  '.cache',
  '.next',
])

const nodeCommandIndicators = ['node', 'nodejs', 'npm', 'npx', 'pnpm', 'yarn', 'bun', 'deno', 'electron', 'vite']

let win: BrowserWindow | null

let hasEnsuredPath = false

const npmErrorMessage =
  'npm was not found. Install Node.js or ensure npm is available in your PATH (e.g. system install, nvm, volta, or asdf).'
const nodeErrorMessage =
  'node was not found. Install Node.js or ensure node is available in your PATH (e.g. system install, nvm, volta, or asdf).'

function isPathWithin(target: string, base: string) {
  if (!target || !base) {
    return false
  }
  return target === base || target.startsWith(`${base}${path.sep}`)
}

function getDefaultHomePath() {
  if (app.isReady()) {
    return app.getPath('home')
  }
  return process.env.HOME ?? process.env.USERPROFILE ?? ''
}

function getIgnoredPathPrefixes(root: string) {
  if (process.platform !== 'darwin') {
    return []
  }

  const prefixes = ['/System', '/Library', '/Applications', '/Volumes', '/private']
  const home = getDefaultHomePath()
  if (home) {
    prefixes.push(path.join(home, 'Library'))
  }

  return prefixes.filter((prefix) => !isPathWithin(root, prefix))
}

function shouldSkipPath(targetPath: string, ignoredPrefixes: string[]) {
  for (const prefix of ignoredPrefixes) {
    if (isPathWithin(targetPath, prefix)) {
      return true
    }
  }
  return false
}

function addToPath(entries: string[]) {
  if (entries.length === 0) {
    return process.env.PATH ?? ''
  }

  const envPath = process.env.PATH ?? ''
  const segments = envPath.split(path.delimiter).filter(Boolean)
  let changed = false

  for (const entry of entries) {
    if (!entry) {
      continue
    }
    if (!segments.includes(entry)) {
      segments.push(entry)
      changed = true
    }
  }

  if (changed) {
    process.env.PATH = segments.join(path.delimiter)
  }

  return process.env.PATH ?? ''
}

function ensurePath() {
  if (hasEnsuredPath) {
    return process.env.PATH ?? ''
  }

  const envPath = process.env.PATH ?? ''
  const segments = envPath.split(path.delimiter).filter(Boolean)
  const home = app.isReady()
    ? app.getPath('home')
    : (process.env.HOME ?? process.env.USERPROFILE ?? '')
  const extras: string[] = []

  if (home) {
    extras.push(
      path.join(home, '.local', 'bin'),
      path.join(home, '.npm-global', 'bin'),
      path.join(home, '.volta', 'bin'),
      path.join(home, '.asdf', 'bin'),
      path.join(home, '.asdf', 'shims'),
    )
  }

  if (process.platform !== 'win32') {
    extras.push('/usr/local/bin', '/usr/bin', '/bin', '/snap/bin')
  }

  if (process.platform === 'darwin') {
    extras.push('/opt/homebrew/bin', '/opt/homebrew/sbin')
  }

  addToPath([...segments, ...extras])
  hasEnsuredPath = true
  return process.env.PATH ?? ''
}

function isExecutable(filePath: string) {
  try {
    fsSync.accessSync(filePath, fsSync.constants.X_OK)
    return true
  } catch {
    return false
  }
}

function findExecutableInPath(command: string) {
  const envPath = ensurePath()
  const segments = envPath.split(path.delimiter).filter(Boolean)
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT?.split(';').filter(Boolean) ?? ['.EXE', '.CMD', '.BAT'])
    : ['']

  for (const segment of segments) {
    for (const extension of extensions) {
      const candidate = path.join(segment, `${command}${extension}`)
      if (fsSync.existsSync(candidate)) {
        return candidate
      }
    }
  }

  return null
}

function compareVersions(a: string, b: string) {
  const normalize = (value: string) => value.replace(/^v/, '').split('.').map((part) => Number(part))
  const left = normalize(a)
  const right = normalize(b)
  const length = Math.max(left.length, right.length)

  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0)
    if (diff !== 0) {
      return diff
    }
  }

  return 0
}

function resolveNpmExecutable() {
  ensurePath()
  const direct = findExecutableInPath('npm')
  if (direct && isExecutable(direct)) {
    addToPath([path.dirname(direct)])
    return direct
  }

  const home = app.getPath('home')
  const candidates = [
    path.join(home, '.volta', 'bin', 'npm'),
    path.join(home, '.asdf', 'shims', 'npm'),
  ]

  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate) && isExecutable(candidate)) {
      addToPath([path.dirname(candidate)])
      return candidate
    }
  }

  const nvmRoot = path.join(home, '.nvm', 'versions', 'node')
  if (fsSync.existsSync(nvmRoot)) {
    const entries = fsSync.readdirSync(nvmRoot)
      .filter((entry) => entry.startsWith('v'))
      .sort(compareVersions)

    const latest = entries[entries.length - 1]
    if (latest) {
      const candidate = path.join(nvmRoot, latest, 'bin', 'npm')
      if (fsSync.existsSync(candidate) && isExecutable(candidate)) {
        addToPath([path.dirname(candidate)])
        return candidate
      }
    }
  }

  return null
}

function resolveNodeExecutable() {
  ensurePath()
  const direct = findExecutableInPath('node')
  if (direct && isExecutable(direct)) {
    addToPath([path.dirname(direct)])
    return direct
  }

  const alt = findExecutableInPath('nodejs')
  if (alt && isExecutable(alt)) {
    addToPath([path.dirname(alt)])
    return alt
  }

  const home = app.isReady()
    ? app.getPath('home')
    : (process.env.HOME ?? process.env.USERPROFILE ?? '')

  if (home) {
    const candidates = [
      path.join(home, '.volta', 'bin', 'node'),
      path.join(home, '.asdf', 'shims', 'node'),
    ]

    for (const candidate of candidates) {
      if (fsSync.existsSync(candidate) && isExecutable(candidate)) {
        addToPath([path.dirname(candidate)])
        return candidate
      }
    }

    const nvmRoot = path.join(home, '.nvm', 'versions', 'node')
    if (fsSync.existsSync(nvmRoot)) {
      const entries = fsSync.readdirSync(nvmRoot)
        .filter((entry) => entry.startsWith('v'))
        .sort(compareVersions)

      const latest = entries[entries.length - 1]
      if (latest) {
        const candidate = path.join(nvmRoot, latest, 'bin', 'node')
        if (fsSync.existsSync(candidate) && isExecutable(candidate)) {
          addToPath([path.dirname(candidate)])
          return candidate
        }
      }
    }
  }

  return null
}

app.disableHardwareAcceleration()

// Hide menu bar
Menu.setApplicationMenu(null)

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    autoHideMenuBar: true,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })


  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function appendLog(projectPath: string, chunk: string) {
  const logs = projectLogs.get(projectPath) ?? []
  logs.push(chunk)
  if (logs.length > logLimit) {
    logs.splice(0, logs.length - logLimit)
  }
  projectLogs.set(projectPath, logs)
}

function emitLog(projectPath: string, message: string, source: 'stdout' | 'stderr' = 'stdout') {
  appendLog(projectPath, message)
  win?.webContents.send('projects:output', { path: projectPath, data: message, source })
}

function attachProcessLogging(
  projectPath: string,
  child: ChildProcessWithoutNullStreams,
  initialMessage?: string,
) {
  if (initialMessage) {
    emitLog(projectPath, initialMessage, 'stdout')
  }

  child.stdout?.setEncoding('utf8')
  child.stderr?.setEncoding('utf8')

  child.stdout?.on('data', (data) => {
    emitLog(projectPath, data.toString(), 'stdout')
  })

  child.stderr?.on('data', (data) => {
    emitLog(projectPath, data.toString(), 'stderr')
  })

  child.on('error', (error) => {
    emitLog(projectPath, `\n[process error] ${error.message}\n`, 'stderr')
  })
}

function isNodeCommand(command: string) {
  const normalized = command.toLowerCase()
  return nodeCommandIndicators.some((indicator) => normalized.includes(indicator))
}

function parseAddressPort(value: string) {
  const cleaned = value.trim().replace(/\[|\]/g, '')
  const lastColon = cleaned.lastIndexOf(':')
  if (lastColon <= 0) {
    return null
  }

  const port = Number(cleaned.slice(lastColon + 1))
  if (!Number.isFinite(port)) {
    return null
  }

  const address = cleaned.slice(0, lastColon) || '*'
  return { address, port }
}

function parseLsofAddress(value: string) {
  const cleaned = value.replace(/^TCP\s+/i, '').replace(/\s*\(LISTEN\)\s*$/i, '')
  return parseAddressPort(cleaned)
}

function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    ensurePath()
    const child = spawn(command, args, { shell: process.platform === 'win32' })
    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => resolve({ stdout, stderr, exitCode: code }))
    child.on('error', () => resolve({ stdout, stderr, exitCode: null }))
  })
}

function parseCsvLine(line: string) {
  const results: string[] = []
  let current = ''
  let inQuotes = false

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      results.push(current)
      current = ''
      continue
    }

    current += char
  }

  results.push(current)
  return results
}

async function getPortsFromLsof(): Promise<PortInfo[]> {
  const { stdout } = await runCommand('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-F', 'pcn'])
  if (!stdout) {
    return []
  }

  const results: PortInfo[] = []
  const seen = new Set<string>()
  let currentPid: number | null = null
  let currentCommand = ''

  for (const line of stdout.split('\n')) {
    if (!line) {
      continue
    }

    const marker = line[0]
    const value = line.slice(1)

    if (marker === 'p') {
      currentPid = Number(value)
      continue
    }

    if (marker === 'c') {
      currentCommand = value
      continue
    }

    if (marker !== 'n' || !currentPid || !currentCommand) {
      continue
    }

    if (currentPid === process.pid || !isNodeCommand(currentCommand)) {
      continue
    }

    const parsed = parseLsofAddress(value)
    if (!parsed) {
      continue
    }

    const key = `${currentPid}:${parsed.port}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    results.push({ port: parsed.port, pid: currentPid, command: currentCommand, address: parsed.address })
  }

  return results
}

async function getPortsFromSs(): Promise<PortInfo[]> {
  const { stdout } = await runCommand('ss', ['-lptn'])
  if (!stdout) {
    return []
  }

  const results: PortInfo[] = []
  const seen = new Set<string>()

  for (const line of stdout.split('\n')) {
    if (!line.startsWith('LISTEN')) {
      continue
    }

    const parts = line.trim().split(/\s+/)
    const localAddress = parts[3]
    const processMatch = line.match(/users:\(\("?([^",]+)"?,pid=(\d+)/)

    if (!localAddress || !processMatch) {
      continue
    }

    const command = processMatch[1]
    const pid = Number(processMatch[2])
    if (!Number.isFinite(pid) || pid === process.pid || !isNodeCommand(command)) {
      continue
    }

    const parsed = parseAddressPort(localAddress)
    if (!parsed) {
      continue
    }

    const key = `${pid}:${parsed.port}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    results.push({ port: parsed.port, pid, command, address: parsed.address })
  }

  return results
}

async function getPortsFromNetstat(): Promise<PortInfo[]> {
  const { stdout } = await runCommand('netstat', ['-lntp'])
  if (!stdout) {
    return []
  }

  const results: PortInfo[] = []
  const seen = new Set<string>()

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('tcp')) {
      continue
    }

    const parts = trimmed.split(/\s+/)
    if (parts.length < 7) {
      continue
    }

    const localAddress = parts[3]
    const pidInfo = parts[6]
    const [pidText, command] = pidInfo.split('/')
    const pid = Number(pidText)

    if (!Number.isFinite(pid) || pid === process.pid || !isNodeCommand(command ?? '')) {
      continue
    }

    const parsed = parseAddressPort(localAddress)
    if (!parsed) {
      continue
    }

    const key = `${pid}:${parsed.port}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    results.push({ port: parsed.port, pid, command, address: parsed.address })
  }

  return results
}

async function getWindowsProcessMap() {
  const { stdout } = await runCommand('tasklist', ['/FO', 'CSV', '/NH'])
  const map = new Map<number, string>()

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }

    const columns = parseCsvLine(trimmed)
    if (columns.length < 2) {
      continue
    }

    const pid = Number(columns[1])
    if (Number.isFinite(pid)) {
      map.set(pid, columns[0])
    }
  }

  return map
}

async function getWindowsNodePorts(): Promise<PortInfo[]> {
  const { stdout } = await runCommand('netstat', ['-ano', '-p', 'TCP'])
  if (!stdout) {
    return []
  }

  const processMap = await getWindowsProcessMap()
  const results: PortInfo[] = []
  const seen = new Set<string>()

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.toUpperCase().startsWith('TCP')) {
      continue
    }

    const parts = trimmed.split(/\s+/)
    if (parts.length < 5) {
      continue
    }

    const localAddress = parts[1]
    const state = parts[3]
    const pid = Number(parts[4])

    if (state.toUpperCase() !== 'LISTENING') {
      continue
    }

    if (!Number.isFinite(pid) || pid === process.pid) {
      continue
    }

    const command = processMap.get(pid) ?? ''
    if (!isNodeCommand(command)) {
      continue
    }

    const parsed = parseAddressPort(localAddress)
    if (!parsed) {
      continue
    }

    const key = `${pid}:${parsed.port}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    results.push({ port: parsed.port, pid, command, address: parsed.address })
  }

  return results
}

async function getNodePorts() {
  const results = process.platform === 'win32' ? await getWindowsNodePorts() : await getPortsFromLsof()

  if (results.length > 0) {
    return results.sort((a, b) => a.port - b.port)
  }

  if (process.platform !== 'win32') {
    const ssResults = await getPortsFromSs()
    if (ssResults.length > 0) {
      return ssResults.sort((a, b) => a.port - b.port)
    }

    const netstatResults = await getPortsFromNetstat()
    return netstatResults.sort((a, b) => a.port - b.port)
  }

  return []
}

async function killPortByPid(pid: number): Promise<KillPortResponse> {
  if (!Number.isFinite(pid)) {
    return { status: 'error', message: 'Invalid PID.' }
  }

  if (pid === process.pid) {
    return { status: 'error', message: 'Cannot terminate the application process.' }
  }

  if (process.platform === 'win32') {
    const result = await runCommand('taskkill', ['/pid', `${pid}`, '/t', '/f'])
    if (result.exitCode !== 0) {
      return { status: 'error', message: 'Failed to terminate the process.' }
    }

    return { status: 'killed' }
  }

  try {
    process.kill(pid, 'SIGTERM')
    return { status: 'killed' }
  } catch (error) {
    return { status: 'error', message: 'Failed to terminate the process.' }
  }
}

function getDefaultScanRoot() {
  if (process.platform === 'win32') {
    const systemDrive = process.env.SystemDrive ?? 'C:'
    return `${systemDrive}\\`
  }

  return '/'
}

async function scanProjects(root: string): Promise<ProjectInfo[]> {
  if (!fsSync.existsSync(root)) {
    return []
  }

  const ignoredPrefixes = getIgnoredPathPrefixes(root)

  const packageFiles = await findPackageJsons(root, ignoredPrefixes)
  const projects = await Promise.all(
    packageFiles.map(async (packagePath) => {
      try {
        const raw = await fs.readFile(packagePath, 'utf8')
        const packageJson = JSON.parse(raw)
        const scripts = packageJson.scripts ?? {}
        const hasDev = Boolean(scripts.dev)
        const hasStart = Boolean(scripts.start)

        if (!hasDev && !hasStart) {
          return null
        }

        const projectPath = path.dirname(packagePath)
        const state = projectStates.get(projectPath)
        const isRunning = runningProcesses.has(projectPath)
        const status = state?.status ?? (isRunning ? 'running' : 'stopped')
        const command = state?.command ?? (isRunning ? runningProcesses.get(projectPath)?.command : undefined)

        const folderName = path.basename(projectPath)
        const packageName = typeof packageJson.name === 'string' ? packageJson.name.trim() : ''

        const info: ProjectInfo = {
          path: projectPath,
          name: packageName || folderName,
          hasDev,
          hasStart,
          status,
          exitCode: state?.exitCode ?? null,
        }

        if (command) {
          info.command = command
        }

        return info
      } catch (error) {
        return null
      }
    }),
  )

  const filtered = projects.filter((project): project is ProjectInfo => project !== null)
  return filtered.sort((a, b) => a.name.localeCompare(b.name))
}

async function findPackageJsons(root: string, ignoredPrefixes: string[] = []): Promise<string[]> {
  if (process.platform !== 'win32' && ignoredPrefixes.length === 0) {
    const paths = await findWithCommand(root)
    if (paths.length) {
      return paths
    }
  }

  return walkForPackageJsons(root, ignoredPrefixes)
}

function findWithCommand(root: string): Promise<string[]> {
  return new Promise((resolve) => {
    ensurePath()
    const results: string[] = []
    const args = [
      root,
      '-type',
      'f',
      '-name',
      'package.json',
      '-not',
      '-path',
      '*/node_modules/*',
      '-not',
      '-path',
      '*/.*/*',
      '-not',
      '-path',
      '*/.git/*',
      '-not',
      '-path',
      '*/dist/*',
      '-not',
      '-path',
      '*/build/*',
    ]

    const child = spawn('find', args)
    let buffer = ''

    child.stdout.on('data', (data) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.length > 0) {
          results.push(trimmed)
        }
      }
    })

    child.stderr.on('data', () => undefined)

    child.on('close', () => {
      if (buffer.trim().length > 0) {
        results.push(buffer.trim())
      }
      resolve(results)
    })

    child.on('error', () => resolve(results))
  })
}

async function walkForPackageJsons(root: string, ignoredPrefixes: string[] = []): Promise<string[]> {
  const results: string[] = []
  const queue: string[] = [root]

  while (queue.length > 0) {
    const current = queue.pop()
    if (!current) {
      continue
    }

    let entries
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch (error) {
      continue
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const nextPath = path.join(current, entry.name)
        if (
          entry.name.startsWith('.') ||
          ignoredDirs.has(entry.name) ||
          shouldSkipPath(nextPath, ignoredPrefixes)
        ) {
          continue
        }
        queue.push(nextPath)
        continue
      }

      if (entry.isFile() && entry.name === 'package.json') {
        results.push(path.join(current, entry.name))
      }
    }
  }

  return results
}

async function startProject(projectPath: string) {
  if (runningProcesses.has(projectPath)) {
    return { status: 'running' as const, command: runningProcesses.get(projectPath)?.command }
  }

  const packagePath = path.join(projectPath, 'package.json')
  let packageJson
  try {
    const raw = await fs.readFile(packagePath, 'utf8')
    packageJson = JSON.parse(raw)
  } catch (error) {
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

  const useShell = process.platform === 'win32'
  const child = spawn(npmExecutable, args, {
    cwd: projectPath,
    env: { ...process.env },
    shell: useShell,
    detached: process.platform !== 'win32',
  }) as ChildProcessWithoutNullStreams

  projectLogs.set(projectPath, [])
  projectStates.set(projectPath, { status: 'running', command, exitCode: null })
  runningProcesses.set(projectPath, { process: child, command })

  attachProcessLogging(projectPath, child)

  child.on('close', (code, signal) => {
    runningProcesses.delete(projectPath)
    projectStates.set(projectPath, { status: 'stopped', command, exitCode: code })
    win?.webContents.send('projects:exit', { path: projectPath, code, signal, command })
  })

  child.on('error', () => {
    runningProcesses.delete(projectPath)
    projectStates.set(projectPath, { status: 'error', command, exitCode: null })
    win?.webContents.send('projects:exit', { path: projectPath, code: null, signal: 'error', command })
  })

  return { status: 'running' as const, command }
}

function terminateProcess(entry: ProcessEntry) {
  const child = entry.process
  if (!child.pid) {
    return
  }

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', `${child.pid}`, '/t', '/f'])
    return
  }

  const pid = child.pid
  const killTree = (signal: NodeJS.Signals) => {
    try {
      process.kill(-pid, signal)
    } catch (error) {
      try {
        process.kill(pid, signal)
      } catch (innerError) {
        return
      }
    }
  }

  killTree('SIGTERM')
  const timeout = setTimeout(() => killTree('SIGKILL'), 5000)
  child.once('exit', () => clearTimeout(timeout))
}

function stopProject(projectPath: string) {
  const entry = runningProcesses.get(projectPath)
  if (!entry) {
    return { status: 'stopped' as const }
  }

  terminateProcess(entry)
  runningProcesses.delete(projectPath)
  projectStates.set(projectPath, { status: 'stopped', command: entry.command, exitCode: null })

  return { status: 'stopped' as const }
}

async function installProject(projectPath: string) {
  if (runningProcesses.has(projectPath)) {
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

  const useShell = process.platform === 'win32'
  const child = spawn(npmExecutable, ['install'], {
    cwd: projectPath,
    env: { ...process.env },
    shell: useShell,
  }) as ChildProcessWithoutNullStreams

  projectLogs.set(projectPath, [])
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

ipcMain.handle('projects:default-root', () => getDefaultScanRoot())

ipcMain.handle('projects:scan', async (_event, root?: string) => {
  const scanRoot = typeof root === 'string' && root.trim().length > 0 ? root.trim() : getDefaultScanRoot()
  return scanProjects(scanRoot)
})

ipcMain.handle('projects:start', async (_event, projectPath: string) => startProject(projectPath))

ipcMain.handle('projects:stop', (_event, projectPath: string) => stopProject(projectPath))

ipcMain.handle('projects:install', async (_event, projectPath: string) => installProject(projectPath))

ipcMain.handle('projects:logs', (_event, projectPath: string) => projectLogs.get(projectPath) ?? [])

ipcMain.handle('ports:list', async () => getNodePorts())

ipcMain.handle('ports:kill', async (_event, pid: number) => killPortByPid(pid))

ipcMain.handle('dialog:select-folder', async () => {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? win ?? undefined
  const result = await dialog.showOpenDialog(targetWindow, {
    properties: ['openDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

ipcMain.handle('shell:open-folder', async (_event, projectPath: string) => {
  if (typeof projectPath !== 'string') {
    return
  }

  const trimmedPath = projectPath.trim()
  if (!trimmedPath) {
    return
  }

  try {
    const stats = await fs.stat(trimmedPath)
    if (!stats.isDirectory()) {
      return
    }
    await shell.openPath(trimmedPath)
  } catch {
    return
  }
})

ipcMain.handle('shell:open-external', async (_event, url: string) => {
  if (typeof url !== 'string') {
    return
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return
    }
    await shell.openExternal(parsed.toString())
  } catch {
    return
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  ensurePath()
  createWindow()
})
