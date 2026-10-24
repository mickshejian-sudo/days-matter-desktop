/// <reference types="vite/client" />

interface ElectronAPI {
  toggleWidget: (show: boolean, eventId?: string) => Promise<boolean>
  updateWidgetEvent: (eventId: string) => Promise<boolean>
  closeWidget: () => Promise<boolean>
  widgetDragStart: () => Promise<boolean>
  widgetDragEnd: () => Promise<boolean>
  pickBackgroundImage: () => Promise<string | null>
  minimize: () => Promise<boolean>
  maximize: () => Promise<boolean>
  close: () => Promise<boolean>
  openMainWindow: () => Promise<boolean>
  syncData: (payload: { events?: unknown[]; settings?: Record<string, unknown> }) => Promise<boolean>
  getDataSnapshot: () => Promise<{ events?: unknown[]; settings?: Record<string, unknown>; widgetPosition?: { x: number; y: number } | null } | undefined>
  exportData: () => Promise<boolean>
  importData: () => Promise<{ events?: unknown[]; settings?: Record<string, unknown>; error?: string } | null>
  onWidgetUpdateEvent: (callback: (eventId: string) => void) => void
}

declare global {
  /** 构建时由 vite define 注入（来自 package.json version） */
  const __APP_VERSION__: string

  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
