import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import type { OpenDialogOptions } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { ensurePath } from './env'
import { getDefaultScanRoot, isMac } from './platform'
import { getNodePorts, killPortByPid } from './ports'
import { getProjectLogs, setProjectLogSink } from './projectRegistry'
import { startProject, stopProject, installProject } from './projectRunner'
import { scanProjects } from './projectScanner'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

setProjectLogSink((payload) => {
  win?.webContents.send('projects:output', payload)
})

app.disableHardwareAcceleration()

// Hide menu bar
Menu.setApplicationMenu(null)

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    autoHideMenuBar: true,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

ipcMain.handle('projects:default-root', () => getDefaultScanRoot())

ipcMain.handle('projects:scan', async (_event, root?: string) => {
  const scanRoot = typeof root === 'string' && root.trim().length > 0 ? root.trim() : getDefaultScanRoot()
  return scanProjects(scanRoot)
})

ipcMain.handle('projects:start', async (_event, projectPath: string) =>
  startProject(projectPath, (payload) => {
    win?.webContents.send('projects:exit', payload)
  }),
)

ipcMain.handle('projects:stop', (_event, projectPath: string) => stopProject(projectPath))

ipcMain.handle('projects:install', async (_event, projectPath: string) => installProject(projectPath))

ipcMain.handle('projects:logs', (_event, projectPath: string) => getProjectLogs(projectPath))

ipcMain.handle('ports:list', async () => getNodePorts())

ipcMain.handle('ports:kill', async (_event, pid: number) => killPortByPid(pid))

ipcMain.handle('dialog:select-folder', async () => {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? win ?? null
  const options: OpenDialogOptions = { properties: ['openDirectory'] }
  const result = targetWindow
    ? await dialog.showOpenDialog(targetWindow, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

ipcMain.handle('shell:open-folder', async (_event, projectPath: string) => {
  if (typeof projectPath !== 'string') {
    return
  }

  const trimmedPath = projectPath.trim()
  if (!trimmedPath) {
    return
  }

  try {
    const stats = await fs.stat(trimmedPath)
    if (!stats.isDirectory()) {
      return
    }
    await shell.openPath(trimmedPath)
  } catch {
    return
  }
})

ipcMain.handle('shell:open-external', async (_event, url: string) => {
  if (typeof url !== 'string') {
    return
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return
    }
    await shell.openExternal(parsed.toString())
  } catch {
    return
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  ensurePath()
  createWindow()
})
