import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, nativeTheme, dialog, protocol, net, Notification, type NativeImage } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null
// 多小组件：每个事件可以钉一个自己的小组件窗口
const widgetWindows = new Map<string, BrowserWindow>()  // wid -> window
const widgetEventMap = new Map<string, string>()        // wid -> 当前显示的 eventId
let widgetSeq = 0
let tray: Tray | null = null
let widgetClickThrough = false  // 主进程维护穿透状态（避免死锁）

const isDev = process.env.VITE_DEV_SERVER_URL !== undefined

// ===== 事件背景图 =====
// 本地图片复制到 <userData>/backgrounds/，经自定义协议 daysimg:// 提供给两个窗口
// （http 页面直接引 file:// 会被 Chromium 拦，localStorage 存 base64 又会爆容量）
const daysimgScheme = {
  scheme: 'daysimg',
  privileges: { standard: true, secure: true, supportFetchAPI: true },
}
protocol.registerSchemesAsPrivileged([daysimgScheme])

function backgroundsDir(): string {
  return path.join(app.getPath('userData'), 'backgrounds')
}

function setupDaysimgProtocol() {
  protocol.handle('daysimg', (request) => {
    const name = decodeURIComponent(new URL(request.url).pathname).replace(/^\//, '')
    if (!/^[\w.-]+$/.test(name)) return new Response('bad request', { status: 400 })
    return net.fetch(pathToFileURL(path.join(backgroundsDir(), name)).toString())
  })
}

// ===== 数据快照（localStorage 的落盘备份，防清缓存/重装丢数据）=====
// 渲染进程每次数据变化后 data:sync 一份全量快照；主进程原子写入 data.json，损坏时回退 .bak
interface DataSnapshot {
  events?: unknown[]
  settings?: Record<string, unknown>
  widgetPositions?: Record<string, { x: number; y: number }>  // wid -> 位置（多小组件各自记忆）
  notifiedKeys?: string[]
}
let dataSnapshot: DataSnapshot = {}

function dataFilePath(): string {
  return path.join(app.getPath('userData'), 'data.json')
}

async function writeDataSnapshot() {
  try {
    const file = dataFilePath()
    const tmp = file + '.tmp'
    // 已有旧文件先复制为 .bak（上一次的好版本）
    try { await fs.copyFile(file, file + '.bak') } catch {}
    await fs.writeFile(tmp, JSON.stringify(dataSnapshot), 'utf-8')
    await fs.rename(tmp, file)
  } catch (err) {
    console.error('write data snapshot failed:', err)
  }
}

async function loadDataSnapshot(): Promise<DataSnapshot> {
  for (const f of [dataFilePath(), dataFilePath() + '.bak']) {
    try {
      const raw = await fs.readFile(f, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed as DataSnapshot
    } catch {}
  }
  return {}
}

let snapshotWriteTimer: ReturnType<typeof setTimeout> | null = null
function scheduleWriteSnapshot() {
  if (snapshotWriteTimer) clearTimeout(snapshotWriteTimer)
  snapshotWriteTimer = setTimeout(() => { snapshotWriteTimer = null; writeDataSnapshot() }, 500)
}

// ===== 小组件尺寸与位置记忆 =====
const WIDGET_SIZES = {
  medium: { width: 320, height: 170 },
  small: { width: 240, height: 132 },
} as const
type WidgetSizeKey = keyof typeof WIDGET_SIZES

function currentWidgetSize(): { width: number; height: number } {
  const s = dataSnapshot.settings?.widgetSize
  return WIDGET_SIZES[s === 'small' ? 'small' : 'medium']
}

function applyWidgetSize() {
  const { width, height } = currentWidgetSize()
  for (const w of widgetWindows.values()) {
    const b = w.getBounds()
    if (b.width !== width || b.height !== height) {
      w.setBounds({ x: b.x, y: b.y, width, height })
    }
  }
}

/** 小组件窗口置顶开关（默认开；关掉后就是普通窗口，可被其他软件遮挡） */
function applyWidgetAlwaysOnTop() {
  const on = dataSnapshot.settings?.widgetAlwaysOnTop !== false
  for (const w of widgetWindows.values()) {
    w.setAlwaysOnTop(on, on ? 'screen-saver' : 'floating')
  }
}

/** 位置有效性：至少有 1/3 落在某个显示器工作区内 */function isPositionOnScreen(x: number, y: number): boolean {
  const { width, height } = currentWidgetSize()
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea
    const overlapX = Math.min(x + width, a.x + a.width) - Math.max(x, a.x)
    const overlapY = Math.min(y + height, a.y + a.height) - Math.max(y, a.y)
    return overlapX > width / 3 && overlapY > height / 3
  })
}

// ===== 开机自启（仅打包版生效，开发模式不注册）=====
function applyLaunchAtLogin(enabled: boolean) {
  if (!app.isPackaged) return
  try {
    app.setLoginItemSettings({ openAtLogin: enabled })
  } catch (err) {
    console.error('setLoginItemSettings failed:', err)
  }
}

// ===== 临近提醒通知 =====
interface ReminderEvent {
  id: string
  title: string
  date: string
  repeat?: string
  note?: string
}

function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 事件下一次到来的日期（考虑每年/每月重复） */
function nextOccurrence(ev: ReminderEvent): Date | null {
  const [y, m, d] = ev.date.split('-').map(Number)
  if (!y || !m || !d) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let occ = new Date(y, m - 1, d)
  if (ev.repeat === 'yearly') {
    occ = new Date(now.getFullYear(), m - 1, d)
    if (occ < today) occ = new Date(now.getFullYear() + 1, m - 1, d)
  } else if (ev.repeat === 'monthly') {
    occ = new Date(now.getFullYear(), now.getMonth(), d)
    if (occ < today) occ = new Date(now.getFullYear(), now.getMonth() + 1, d)
  }
  return occ
}

function checkReminders() {
  const settings = dataSnapshot.settings || {}
  if (settings.reminderEnabled === false) return
  const days = typeof settings.reminderDays === 'number' ? settings.reminderDays : 1
  const events = Array.isArray(dataSnapshot.events) ? (dataSnapshot.events as ReminderEvent[]) : []
  const notified = new Set(dataSnapshot.notifiedKeys || [])
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let changed = false
  for (const ev of events) {
    if (!ev?.id || !ev.title) continue
    const occ = nextOccurrence(ev)
    if (!occ) continue
    const diffDays = Math.round((occ.getTime() - today.getTime()) / 86400000)
    if (diffDays < 0 || diffDays > days) continue
    const key = `${ev.id}-${dateKeyOf(occ)}`
    if (notified.has(key)) continue
    notified.add(key)
    changed = true
    const when = diffDays === 0 ? '就是今天' : diffDays === 1 ? '就是明天' : `${diffDays} 天后`
    const n = new Notification({
      title: `⏳ ${ev.title} ${when}`,
      body: `${dateKeyOf(occ)}${ev.note ? ' · ' + ev.note : ''}`,
      icon: loadTrayIcon(),
      silent: false,
    })
    n.on('click', () => {
      if (!mainWindow || mainWindow.isDestroyed()) createMainWindow()
      mainWindow?.show(); mainWindow?.focus()
    })
    n.show()
  }
  if (changed) {
    dataSnapshot.notifiedKeys = Array.from(notified).slice(-200)
    scheduleWriteSnapshot()
  }
}

function startReminderLoop() {
  setTimeout(checkReminders, 20000)               // 启动后等数据同步进来
  setInterval(checkReminders, 60 * 60 * 1000)     // 之后每小时检查一次
}

function getIsDark(): boolean {
  try {
    const settings = JSON.parse(localStorage.getItem('days-matter-settings') || '{}')
    if (settings.theme === 'dark') return true
    if (settings.theme === 'light') return false
  } catch {}
  return nativeTheme.shouldUseDarkColors  // 跟随系统
}

function createMainWindow() {
  const isDark = getIsDark()
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 720,
    minHeight: 520,
    title: '倒数日',
    backgroundColor: isDark ? '#1C1C1E' : '#F5F5F7',
    frame: false,  // Windows-only：彻底自绘标题栏（无原生栏）
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL + '/index.html')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

function createWidgetForEvent(eventId?: string): BrowserWindow {
  const wid = `w${Date.now().toString(36)}-${++widgetSeq}`
  const size = currentWidgetSize()
  const win = new BrowserWindow({
    width: size.width, height: size.height,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, movable: true, hasShadow: false,
    skipTaskbar: true, focusable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  })
  widgetWindows.set(wid, win)
  if (eventId) widgetEventMap.set(wid, eventId)
  win.setAlwaysOnTop(dataSnapshot.settings?.widgetAlwaysOnTop !== false, 'screen-saver')
  const query = { wid, ...(eventId ? { event: eventId } : {}) }
  if (isDev) {
    const usp = new URLSearchParams(query)
    win.loadURL(`${process.env.VITE_DEV_SERVER_URL}/widget.html?${usp}`)
  } else {
    win.loadFile(path.join(__dirname, '../../dist/widget.html'), { query })
  }
  win.on('closed', () => {
    widgetWindows.delete(wid)
    widgetEventMap.delete(wid)
    if (widgetWindows.size === 0) stopWidgetDrag()
  })
  // 尺寸保险丝：任何来源的尺寸漂移立即复位为固定大小
  win.on('resize', () => {
    const want = currentWidgetSize()
    const b = win.getBounds()
    if (b.width !== want.width || b.height !== want.height) {
      win.setBounds({ x: b.x, y: b.y, width: want.width, height: want.height })
    }
  })

  // 恢复该 wid 上次的位置；没有记录则层叠摆放（避免完全重叠）
  const saved = dataSnapshot.widgetPositions?.[wid]
  if (saved && isPositionOnScreen(saved.x, saved.y)) {
    win.setBounds({ x: saved.x, y: saved.y, width: size.width, height: size.height })
  } else {
    const { workArea } = screen.getPrimaryDisplay()
    const n = widgetWindows.size - 1
    win.setBounds({
      x: workArea.x + workArea.width - size.width - 30 - n * 28,
      y: workArea.y + workArea.height - size.height - 60 - n * 24,
      width: size.width, height: size.height,
    })
  }
  win.setIgnoreMouseEvents(widgetClickThrough, { forward: true })
  return win
}

/** 找到正在显示某事件的小组件，没有则新建 */
function showWidgetForEvent(eventId: string): BrowserWindow {
  for (const [wid, evId] of widgetEventMap) {
    if (evId === eventId) {
      const w = widgetWindows.get(wid)
      if (w) { w.show(); w.focus(); return w }
    }
  }
  return createWidgetForEvent(eventId)
}

/** 通过 IPC sender 定位对应的小组件窗口 */
function widgetFromSender(sender: Electron.WebContents): { wid: string; win: BrowserWindow } | null {
  const win = BrowserWindow.fromWebContents(sender)
  if (!win) return null
  for (const [wid, w] of widgetWindows) {
    if (w === win) return { wid, win: w }
  }
  return null
}

function buildTrayMenu(): Menu {
  const anyVisible = [...widgetWindows.values()].some((w) => w.isVisible())
  return Menu.buildFromTemplate([
    { label: '显示主界面', click: () => { if (!mainWindow) createMainWindow(); mainWindow?.show(); mainWindow?.focus() } },
    { label: anyVisible ? `隐藏全部小组件（${widgetWindows.size}）` : '显示小组件',
      click: () => {
        if (widgetWindows.size === 0) {
          // 一个都没有：给第一个事件建一个
          const events = Array.isArray(dataSnapshot.events) ? (dataSnapshot.events as { id: string }[]) : []
          createWidgetForEvent(events[0]?.id)
        } else {
          for (const w of widgetWindows.values()) { anyVisible ? w.hide() : w.show() }
        }
      } },
    // ↓ 关键：即使小组件设了穿透，托盘菜单永远能解锁（避免死锁）
    { label: widgetClickThrough ? '🔓 解锁小组件点击' : '🔒 锁定小组件点击',
      click: () => { setWidgetClickThrough(!widgetClickThrough) } },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ])
}

// 托盘图标兜底（内嵌 base64 22px PNG，即使打包路径异常也保证托盘图标可见）
const TRAY_FALLBACK_BLUE = 'iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAABL0lEQVR4nLWVMUvDUBDHf3lGLA5CFQQdxUF0sJ/AxVEQBCe/gi6uTp0cpYObs506SMWPoKMoiBYEcRDBwRbjYjAmDq9isO/eSxrzX96Ru/vdvcuRQEnynBF7SWJ8vu9Zc2WnBMxYQBWCWmIHwXmglhzlChgW7kmOqx1YntF2FMN7CA9dOO1A4wLePoQC/ZmbZ5zS8TWM12HlCJ4CqK/C5TbMTtjzlKnbv/r8gpsX2GzC/SvMTUJjTQjus5wdpxXFcHKr7fUFGB1xdZxDz4E+x3yoVv4R/DPbMIKe9ALzgn0FG4vabnf07AuBfQVL09DagvkpvXa7Z/acTHscJxCE8NiD9h0cnLv32Jcq1g6z3EXW7ygcn8FMSjGU5CgCHQQPCzfkmLciD1yILe3XVJq+AfykYLpYgMZOAAAAAElFTkSuQmCC'
const TRAY_FALLBACK_WHITE = 'iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAABKElEQVR4nLWVvUoDQRRGz4wrm8aVaBEQCxGEKILBMj6CJFhYmdo++AR5Axt9BStBECxtfAOLhBRiaUBQwUIU16zFsBCz85PZdb9mLsz9zlzu3NmFkiRcCUmSJFqjEFavcdMEnPUAWQRqy82AfaA2j3Ql5IUL00bjDO5HKg4kLISwvgStOnSbsFjRH5D2XNvjSXV24KMHd8ewGkHvFnbP4end7pO6aqc1PwfbNbg8go1leHyF7o0+N2U5K55UIOFgS8XXQ/j+cVTso5VIrV8xvH3+IzjtbRhA1XCB3uB4DFcDFbfrqveFwPEY+s9weAEPL2rsTvftnpnmWAqIQlirQnsTTvbcc2wE51Xmgbg+gz7QP+Ci8Glv5vLywHUe7VT4wE25pf2aStMvZFhhUz7MrbIAAAAASUVORK5CYII='

function loadTrayIcon(): NativeImage {
  // Windows 深色任务栏用白色版，浅色任务栏用彩色版
  const isDark = nativeTheme.shouldUseDarkColors
  const names = isDark
    ? ['icon-white-32.png', 'icon-white-22.png', 'icon.ico', 'icon.png']
    : ['icon.ico', 'icon-22.png', 'icon.png']
  // 打包后图标实际位置：<install>/resources/resources/（extraResources 落地处）
  // 开发时图标位置：<project>/resources/
  const roots = app.isPackaged
    ? [path.join(process.resourcesPath, 'resources')]
    : [path.join(__dirname, '../../resources')]
  for (const root of roots) {
    for (const n of names) {
      try {
        const img = nativeImage.createFromPath(path.join(root, n))
        if (!img.isEmpty()) return img
      } catch {}
    }
  }
  // 兜底：内嵌 base64，保证托盘图标永不缺失
  return nativeImage.createFromDataURL(
    'data:image/png;base64,' + (isDark ? TRAY_FALLBACK_WHITE : TRAY_FALLBACK_BLUE)
  )
}

function createTray() {
  tray = new Tray(loadTrayIcon())
  tray.setToolTip('倒数日')
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', () => { if (!mainWindow) createMainWindow(); mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show() })
  // 系统深浅色切换时自动换托盘图标
  nativeTheme.on('updated', () => tray?.setImage(loadTrayIcon()))
}

function setWidgetClickThrough(enabled: boolean) {
  widgetClickThrough = enabled
  for (const w of widgetWindows.values()) {
    w.setIgnoreMouseEvents(enabled, { forward: true })
  }
  tray?.setContextMenu(buildTrayMenu())  // 刷新菜单文案
}

// IPC
ipcMain.handle('widget:toggle', (_e, show: boolean, eventId?: string) => {
  if (show && eventId) { showWidgetForEvent(eventId); return true }
  if (!show) { for (const w of widgetWindows.values()) w.hide() }
  return true
})
// 小组件内切换事件：更新该窗口的 wid → eventId 映射
ipcMain.handle('widget:update-event', (e, id: string) => {
  const found = widgetFromSender(e.sender)
  if (found) widgetEventMap.set(found.wid, id)
  return true
})
ipcMain.handle('widget:close', (e) => { widgetFromSender(e.sender)?.win.close(); return true })
// Windows 透明窗口上 -webkit-app-region 拖拽不可靠，改由主进程轮询光标移动窗口：
// 拖动期间渲染进程零 IPC，避免逐次 mousemove 走 IPC 往返造成的滞后（不跟手）
let widgetDragTimer: ReturnType<typeof setInterval> | null = null
let widgetDragWid: string | null = null

function stopWidgetDrag() {
  if (widgetDragTimer) { clearInterval(widgetDragTimer); widgetDragTimer = null }
  widgetDragWid = null
}

ipcMain.handle('widget:drag-start', (e) => {
  const found = widgetFromSender(e.sender)
  if (!found) return false
  stopWidgetDrag()
  widgetDragWid = found.wid
  const cursor = screen.getCursorScreenPoint()
  const b = found.win.getBounds()
  const offset = { x: cursor.x - b.x, y: cursor.y - b.y }  // 按下点相对窗口的偏移
  let lastX = b.x, lastY = b.y
  widgetDragTimer = setInterval(() => {
    const w = widgetDragWid ? widgetWindows.get(widgetDragWid) : null
    if (!w) { stopWidgetDrag(); return }
    const c = screen.getCursorScreenPoint()
    const x = c.x - offset.x
    const y = c.y - offset.y
    if (x === lastX && y === lastY) return
    lastX = x; lastY = y
    // setPosition 比 setBounds 轻；尺寸若漂移由 resize 保险丝复位
    w.setPosition(x, y)
  }, 4)
  return true
})
ipcMain.handle('widget:drag-end', (e) => {
  // 记住该小组件的拖放位置，下次启动恢复
  const found = widgetFromSender(e.sender)
  if (found) {
    const b = found.win.getBounds()
    dataSnapshot.widgetPositions = { ...(dataSnapshot.widgetPositions || {}), [found.wid]: { x: b.x, y: b.y } }
    scheduleWriteSnapshot()
  }
  stopWidgetDrag()
  return true
})

// ===== 数据快照 / 导出 / 导入 =====
ipcMain.handle('data:sync', (_e, payload: { events?: unknown[]; settings?: Record<string, unknown> }) => {
  if (Array.isArray(payload?.events)) dataSnapshot.events = payload.events
  if (payload?.settings && typeof payload.settings === 'object') {
    dataSnapshot.settings = { ...dataSnapshot.settings, ...payload.settings }
  }
  applyWidgetSize()
  applyWidgetAlwaysOnTop()
  if (dataSnapshot.settings) applyLaunchAtLogin(dataSnapshot.settings.launchAtLogin === true)
  scheduleWriteSnapshot()
  return true
})
ipcMain.handle('data:get-snapshot', () => dataSnapshot)

ipcMain.handle('data:export', async () => {
  if (!mainWindow) return false
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出倒数日数据',
    defaultPath: `倒数日备份-${dateKeyOf(new Date())}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (res.canceled || !res.filePath) return false
  try {
    await fs.writeFile(res.filePath, JSON.stringify(dataSnapshot, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('export failed:', err)
    return false
  }
})

ipcMain.handle('data:import', async () => {
  if (!mainWindow) return { error: '主窗口未就绪' }
  const res = await dialog.showOpenDialog(mainWindow, {
    title: '导入倒数日数据',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  const file = res.canceled ? null : res.filePaths[0]
  if (!file) return null
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf-8'))
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.events)) {
      return { error: '文件格式不正确（缺少 events 数组）' }
    }
    dataSnapshot.events = parsed.events
    if (parsed.settings && typeof parsed.settings === 'object') {
      dataSnapshot.settings = { ...dataSnapshot.settings, ...parsed.settings }
    }
    applyWidgetSize()
    applyWidgetAlwaysOnTop()
    if (dataSnapshot.settings) applyLaunchAtLogin(dataSnapshot.settings.launchAtLogin === true)
    await writeDataSnapshot()
    return { events: dataSnapshot.events, settings: dataSnapshot.settings }
  } catch (err) {
    return { error: '读取文件失败：' + String(err) }
  }
})

ipcMain.handle('main:show', () => {
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow()
  mainWindow?.show(); mainWindow?.focus()
  return true
})
ipcMain.handle('main:minimize', () => { mainWindow?.minimize(); return true })
ipcMain.handle('main:maximize', () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize(); return true })
ipcMain.handle('main:close', () => { mainWindow?.close(); return true })

// 选择本地图片作为事件背景：复制进 userData/backgrounds 并返回 daysimg:// 地址
ipcMain.handle('dialog:pick-background', async () => {
  if (!mainWindow) return null
  const res = await dialog.showOpenDialog(mainWindow, {
    title: '选择背景图片',
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'] }],
  })
  const src = res.canceled ? null : res.filePaths[0]
  if (!src) return null
  try {
    await fs.mkdir(backgroundsDir(), { recursive: true })
    const rawExt = path.extname(src).toLowerCase()
    const ext = /^\.[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : '.png'
    const name = `${Date.now()}${ext}`
    await fs.copyFile(src, path.join(backgroundsDir(), name))
    return `daysimg://local/${name}`
  } catch (err) {
    console.error('copy background image failed:', err)
    return null
  }
})

// App lifecycle
// 单实例锁：重复启动时新进程直接退出，由旧实例把主窗口带到前台
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) createMainWindow()
    const win = mainWindow
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })
  app.whenReady().then(async () => {
    dataSnapshot = await loadDataSnapshot()
    setupDaysimgProtocol()
    createMainWindow(); createTray()
    startReminderLoop()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow() })
  })
}
app.on('before-quit', () => { tray?.destroy() })
