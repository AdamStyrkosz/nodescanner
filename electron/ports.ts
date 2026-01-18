import { runCommand } from './commands'
import { isWindows } from './platform'
import type { KillPortResponse, PortInfo } from './types'

const nodeCommandIndicators = ['node', 'nodejs', 'npm', 'npx', 'pnpm', 'yarn', 'bun', 'deno', 'electron', 'vite']

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
    const processMatch = line.match(/users:\(\"?([^\",]+)\"?,pid=(\d+)/)

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

export async function getNodePorts() {
  const results = isWindows ? await getWindowsNodePorts() : await getPortsFromLsof()

  if (results.length > 0) {
    return results.sort((a, b) => a.port - b.port)
  }

  if (!isWindows) {
    const ssResults = await getPortsFromSs()
    if (ssResults.length > 0) {
      return ssResults.sort((a, b) => a.port - b.port)
    }

    const netstatResults = await getPortsFromNetstat()
    return netstatResults.sort((a, b) => a.port - b.port)
  }

  return []
}

export async function killPortByPid(pid: number): Promise<KillPortResponse> {
  if (!Number.isFinite(pid)) {
    return { status: 'error', message: 'Invalid PID.' }
  }

  if (pid === process.pid) {
    return { status: 'error', message: 'Cannot terminate the application process.' }
  }

  if (isWindows) {
    const result = await runCommand('taskkill', ['/pid', `${pid}`, '/t', '/f'])
    if (result.exitCode !== 0) {
      return { status: 'error', message: 'Failed to terminate the process.' }
    }

    return { status: 'killed' }
  }

  try {
    process.kill(pid, 'SIGTERM')
    return { status: 'killed' }
  } catch {
    return { status: 'error', message: 'Failed to terminate the process.' }
  }
}
