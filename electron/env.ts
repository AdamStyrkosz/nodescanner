import path from 'node:path'
import fsSync from 'node:fs'
import { getDefaultHomePath, isMac, isWindows } from './platform'

let hasEnsuredPath = false

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

export function ensurePath() {
  if (hasEnsuredPath) {
    return process.env.PATH ?? ''
  }

  const envPath = process.env.PATH ?? ''
  const segments = envPath.split(path.delimiter).filter(Boolean)
  const home = getDefaultHomePath()
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

  if (!isWindows) {
    extras.push('/usr/local/bin', '/usr/bin', '/bin', '/snap/bin')
  }

  if (isMac) {
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
  const extensions = isWindows
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

export function resolveNpmExecutable() {
  ensurePath()
  const direct = findExecutableInPath('npm')
  if (direct && isExecutable(direct)) {
    addToPath([path.dirname(direct)])
    return direct
  }

  const home = getDefaultHomePath()
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

export function resolveNodeExecutable() {
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

  const home = getDefaultHomePath()
  if (!home) {
    return null
  }

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

  return null
}
