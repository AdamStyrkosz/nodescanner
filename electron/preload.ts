import { ipcRenderer, contextBridge } from 'electron'

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


contextBridge.exposeInMainWorld('api', {
  getDefaultRoot: () => ipcRenderer.invoke('projects:default-root'),
  scanProjects: (root?: string) => ipcRenderer.invoke('projects:scan', root),
  startProject: (projectPath: string) => ipcRenderer.invoke('projects:start', projectPath),
  stopProject: (projectPath: string) => ipcRenderer.invoke('projects:stop', projectPath),
  install: (projectPath: string) => ipcRenderer.invoke('projects:install', projectPath),
  getLogs: (projectPath: string) => ipcRenderer.invoke('projects:logs', projectPath),
  listPorts: (): Promise<PortInfo[]> => ipcRenderer.invoke('ports:list'),
  killPort: (pid: number): Promise<KillPortResponse> => ipcRenderer.invoke('ports:kill', pid),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:select-folder'),
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  openFolder: (projectPath: string) => ipcRenderer.invoke('shell:open-folder', projectPath),
  onProcessOutput: (callback: (payload: ProcessOutput) => void) => {
    ipcRenderer.on('projects:output', (_event, payload: ProcessOutput) => callback(payload))
  },
  onProcessExit: (callback: (payload: ProcessExit) => void) => {
    ipcRenderer.on('projects:exit', (_event, payload: ProcessExit) => callback(payload))
  },
})
