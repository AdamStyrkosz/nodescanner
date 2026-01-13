/// <reference types="vite/client" />

declare global {
  type ProjectInfo = {
    path: string
    name: string
    hasDev: boolean
    hasStart: boolean
    status: 'running' | 'stopped' | 'error'
    command?: string
    exitCode?: number | null
  }

  type StartResponse = {
    status: 'running' | 'error'
    command?: string
    message?: string
  }

  type StopResponse = {
    status: 'stopped'
  }

  type InstallResponse = {
    status: 'success' | 'error'
    message?: string
    code?: number | null
  }

  type ProcessOutput = {
    path: string
    data: string
    source: 'stdout' | 'stderr'
  }

  type ProcessExit = {
    path: string
    code: number | null
    signal: string | null
    command: string
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

  interface Window {
    api: {
      getDefaultRoot: () => Promise<string>
      scanProjects: (root?: string) => Promise<ProjectInfo[]>
      startProject: (projectPath: string) => Promise<StartResponse>
      stopProject: (projectPath: string) => Promise<StopResponse>
      install: (projectPath: string) => Promise<InstallResponse>
      getLogs: (projectPath: string) => Promise<string[]>
      listPorts: () => Promise<PortInfo[]>
      killPort: (pid: number) => Promise<KillPortResponse>
      selectFolder: () => Promise<string | null>
      openExternal: (url: string) => Promise<void>
      openFolder: (projectPath: string) => Promise<void>
      onProcessOutput: (callback: (payload: ProcessOutput) => void) => void
      onProcessExit: (callback: (payload: ProcessExit) => void) => void
    }
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

export {}
