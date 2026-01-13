/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

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


// Used in Renderer process, expose in `preload.ts`
interface Window {
  api: {
    getDefaultRoot: () => Promise<string>
    scanProjects: (root?: string) => Promise<ProjectInfo[]>
    startProject: (projectPath: string) => Promise<StartResponse>
    stopProject: (projectPath: string) => Promise<StopResponse>
    getLogs: (projectPath: string) => Promise<string[]>
    listPorts: () => Promise<PortInfo[]>
    killPort: (pid: number) => Promise<KillPortResponse>
    onProcessOutput: (callback: (payload: ProcessOutput) => void) => void
    onProcessExit: (callback: (payload: ProcessExit) => void) => void
  }
}
