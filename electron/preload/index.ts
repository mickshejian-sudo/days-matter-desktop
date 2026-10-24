import { contextBridge, ipcRenderer } from 'electron'

// 使用 contextBridge 安全地暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 小组件相关
  toggleWidget: (show: boolean, eventId?: string) =>
    ipcRenderer.invoke('widget:toggle', show, eventId),
  updateWidgetEvent: (eventId: string) =>
    ipcRenderer.invoke('widget:update-event', eventId),
  closeWidget: () => ipcRenderer.invoke('widget:close'),
  widgetDragStart: () => ipcRenderer.invoke('widget:drag-start'),
  widgetDragEnd: () => ipcRenderer.invoke('widget:drag-end'),

  // 事件背景图
  pickBackgroundImage: () =>
    ipcRenderer.invoke('dialog:pick-background') as Promise<string | null>,

  // 主窗口（Windows 自绘栏控制）
  minimize: () => ipcRenderer.invoke('main:minimize'),
  maximize: () => ipcRenderer.invoke('main:maximize'),
  close: () => ipcRenderer.invoke('main:close'),
  openMainWindow: () => ipcRenderer.invoke('main:show'),

  // 数据快照 / 导出 / 导入
  syncData: (payload: { events?: unknown[]; settings?: Record<string, unknown> }) =>
    ipcRenderer.invoke('data:sync', payload),
  getDataSnapshot: () => ipcRenderer.invoke('data:get-snapshot'),
  exportData: () => ipcRenderer.invoke('data:export') as Promise<boolean>,
  importData: () => ipcRenderer.invoke('data:import') as Promise<{ events?: unknown[]; settings?: Record<string, unknown>; error?: string } | null>,

  // 小组件接收更新
  onWidgetUpdateEvent: (callback: (eventId: string) => void) => {
    ipcRenderer.on('widget:update-event', (_event, eventId) => callback(eventId))
  },
})
