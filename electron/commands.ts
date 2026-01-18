import { spawn } from 'node:child_process'
import { ensurePath } from './env'
import { isWindows } from './platform'
import type { CommandResult } from './types'

export function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    ensurePath()
    const child = spawn(command, args, { shell: isWindows })
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
