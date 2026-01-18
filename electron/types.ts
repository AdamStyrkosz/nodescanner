import type { ChildProcessWithoutNullStreams } from 'node:child_process'

export type ProjectInfo = {
  path: string
  name: string
  hasDev: boolean
  hasStart: boolean
  status: 'running' | 'stopped' | 'error'
  command?: string
  exitCode?: number | null
}

export type PortInfo = {
  port: number
  pid: number
  command: string
  address: string
}

export type KillPortResponse = {
  status: 'killed' | 'error'
  message?: string
}

export type CommandResult = {
  stdout: string
  stderr: string
  exitCode: number | null
}

export type ProcessEntry = {
  process: ChildProcessWithoutNullStreams
  command: string
}

export type ProjectState = {
  status: 'running' | 'stopped' | 'error'
  command?: string
  exitCode?: number | null
}

export type ProjectLogSource = 'stdout' | 'stderr'
