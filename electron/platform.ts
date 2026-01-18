import { app } from 'electron'
import path from 'node:path'

export const isWindows = process.platform === 'win32'
export const isMac = process.platform === 'darwin'
export const isLinux = !isWindows && !isMac

export function isPathWithin(target: string, base: string) {
  if (!target || !base) {
    return false
  }
  const resolvedTarget = path.resolve(target)
  const resolvedBase = path.resolve(base)
  const normalizedTarget = isWindows ? resolvedTarget.toLowerCase() : resolvedTarget
  const normalizedBase = isWindows ? resolvedBase.toLowerCase() : resolvedBase
  return normalizedTarget === normalizedBase || normalizedTarget.startsWith(`${normalizedBase}${path.sep}`)
}

export function getDefaultHomePath() {
  if (app.isReady()) {
    return app.getPath('home')
  }
  return process.env.HOME ?? process.env.USERPROFILE ?? ''
}

export function getDefaultScanRoot() {
  if (isWindows) {
    const systemDrive = process.env.SystemDrive ?? 'C:'
    return `${systemDrive}\\`
  }

  return '/'
}

export function getIgnoredPathPrefixes(root: string) {
  if (isMac) {
    const prefixes = ['/System', '/Library', '/Applications', '/Volumes', '/private']
    const home = getDefaultHomePath()
    if (home) {
      prefixes.push(path.join(home, 'Library'))
    }

    return prefixes.filter((prefix) => !isPathWithin(root, prefix))
  }

  if (isWindows) {
    const prefixes: string[] = []
    const systemDrive = process.env.SystemDrive ?? 'C:'
    const systemRoot = process.env.SystemRoot
    const programFiles = process.env.ProgramFiles
    const programFilesX86 = process.env['ProgramFiles(x86)']
    const programData = process.env.ProgramData
    const home = getDefaultHomePath()

    if (systemRoot) {
      prefixes.push(systemRoot)
    } else {
      prefixes.push(path.join(systemDrive, 'Windows'))
    }
    if (programFiles) {
      prefixes.push(programFiles)
    }
    if (programFilesX86) {
      prefixes.push(programFilesX86)
    }
    if (programData) {
      prefixes.push(programData)
    }
    if (home) {
      prefixes.push(path.join(home, 'AppData'))
      prefixes.push(path.join(home, 'Saved Games'))
      prefixes.push(path.join(home, 'Pictures'))
      prefixes.push(path.join(home, 'Music'))
      prefixes.push(path.join(home, 'Documents', 'My Games'))
    }

    prefixes.push(path.join(systemDrive, 'AMD'))
    prefixes.push(path.join(systemDrive, 'Python313'))

    return prefixes.filter((prefix) => !isPathWithin(root, prefix))
  }

  return []
}

export function shouldSkipPath(targetPath: string, ignoredPrefixes: string[]) {
  for (const prefix of ignoredPrefixes) {
    if (isPathWithin(targetPath, prefix)) {
      return true
    }
  }
  return false
}

export function quoteCommandForShell(command: string) {
  if (!isWindows) {
    return command
  }
  if (!command.includes(' ') || command.startsWith('"') || command.startsWith("'")) {
    return command
  }
  return `"${command}"`
}
