import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { ensurePath } from './env'
import { getIgnoredPathPrefixes, isWindows, shouldSkipPath } from './platform'
import { getProjectState, getRunningCommand, isProjectRunning } from './projectRegistry'
import type { ProjectInfo } from './types'

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

export async function scanProjects(root: string): Promise<ProjectInfo[]> {
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
        const state = getProjectState(projectPath)
        const isRunning = isProjectRunning(projectPath)
        const status = state?.status ?? (isRunning ? 'running' : 'stopped')
        const command = state?.command ?? (isRunning ? getRunningCommand(projectPath) : undefined)

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
      } catch {
        return null
      }
    }),
  )

  const filtered = projects.filter((project): project is ProjectInfo => project !== null)
  return filtered.sort((a, b) => a.name.localeCompare(b.name))
}

async function findPackageJsons(root: string, ignoredPrefixes: string[] = []): Promise<string[]> {
  if (!isWindows && ignoredPrefixes.length === 0) {
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
    } catch {
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
