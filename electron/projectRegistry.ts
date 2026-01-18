import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import type { ProcessEntry, ProjectLogSource, ProjectState } from './types'

const runningProcesses = new Map<string, ProcessEntry>()
const projectLogs = new Map<string, string[]>()
const projectStates = new Map<string, ProjectState>()
const logLimit = 2000

type LogSink = (payload: { path: string; data: string; source: ProjectLogSource }) => void

let logSink: LogSink | null = null

export function setProjectLogSink(sink: LogSink | null) {
  logSink = sink
}

export function getProjectLogs(projectPath: string) {
  return projectLogs.get(projectPath) ?? []
}

export function resetProjectLogs(projectPath: string) {
  projectLogs.set(projectPath, [])
}

function appendLog(projectPath: string, chunk: string) {
  const logs = projectLogs.get(projectPath) ?? []
  logs.push(chunk)
  if (logs.length > logLimit) {
    logs.splice(0, logs.length - logLimit)
  }
  projectLogs.set(projectPath, logs)
}

function emitLog(projectPath: string, message: string, source: ProjectLogSource = 'stdout') {
  appendLog(projectPath, message)
  logSink?.({ path: projectPath, data: message, source })
}

export function attachProcessLogging(
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

export function isProjectRunning(projectPath: string) {
  return runningProcesses.has(projectPath)
}

export function getRunningCommand(projectPath: string) {
  return runningProcesses.get(projectPath)?.command
}

export function getRunningProcessEntry(projectPath: string) {
  return runningProcesses.get(projectPath)
}

export function getProjectState(projectPath: string) {
  return projectStates.get(projectPath)
}

export function setProjectRunning(projectPath: string, entry: ProcessEntry) {
  runningProcesses.set(projectPath, entry)
  projectStates.set(projectPath, { status: 'running', command: entry.command, exitCode: null })
}

export function setProjectStopped(projectPath: string, command?: string, exitCode?: number | null) {
  runningProcesses.delete(projectPath)
  projectStates.set(projectPath, { status: 'stopped', command, exitCode: exitCode ?? null })
}

export function setProjectError(projectPath: string, command?: string) {
  runningProcesses.delete(projectPath)
  projectStates.set(projectPath, { status: 'error', command, exitCode: null })
}
