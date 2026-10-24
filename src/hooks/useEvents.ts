import { useState, useEffect, useCallback, useRef } from 'react'
import { DaysEvent, AppSettings, DEFAULT_SETTINGS, DEFAULT_EVENTS, SEED_VERSION } from '@/types'
import { generateId } from '@/utils/dateUtils'

// 使用 localStorage 做持久化（简单跨环境方案）
const EVENTS_KEY = 'days-matter-events'
const SETTINGS_KEY = 'days-matter-settings'
const SEED_KEY = 'days-matter-seed'

/** v1 旧演示数据（用于识别未被用户改动过的老默认值） */
function isLegacyDemo(events: unknown): boolean {
  if (!Array.isArray(events) || events.length !== 2) return false
  return events[0]?.id === 'demo-1' && events[0]?.title === '新年元旦'
      && events[1]?.id === 'demo-2' && events[1]?.title === '已活天数'
}

function loadEvents(): DaysEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY)
    if (raw) {
      const stored = JSON.parse(raw)
      // 老用户仍是最初的演示数据（分毫未改）→ 自动升级为新版演示内容
      if (localStorage.getItem(SEED_KEY) === null && isLegacyDemo(stored)) {
        localStorage.setItem(EVENTS_KEY, JSON.stringify(DEFAULT_EVENTS))
        localStorage.setItem(SEED_KEY, String(SEED_VERSION))
        return DEFAULT_EVENTS
      }
      return stored
    }
  } catch {}
  localStorage.setItem(EVENTS_KEY, JSON.stringify(DEFAULT_EVENTS))
  localStorage.setItem(SEED_KEY, String(SEED_VERSION))
  return DEFAULT_EVENTS
}

function saveEvents(events: DaysEvent[]) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events))
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_SETTINGS
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function useEvents() {
  const [events, setEvents] = useState<DaysEvent[]>(loadEvents())
  const firstRun = useRef(true)

  useEffect(() => {
    saveEvents(events)
    // 首次渲染跳过：避免把刚挂载的数据覆盖到主进程快照（启动恢复期间可能还是空的）
    if (firstRun.current) { firstRun.current = false; return }
    window.electronAPI?.syncData({ events })
  }, [events])

  const addEvent = useCallback(
    (event: Omit<DaysEvent, 'id' | 'createdAt'>) => {
      const newEvent: DaysEvent = {
        ...event,
        id: generateId(),
        createdAt: Date.now(),
      }
      setEvents((prev) => [newEvent, ...prev])
      return newEvent
    },
    []
  )

  const updateEvent = useCallback(
    (id: string, updates: Partial<DaysEvent>) => {
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
      )
    },
    []
  )

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return { events, addEvent, updateEvent, deleteEvent }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings())
  const firstRun = useRef(true)

  useEffect(() => {
    saveSettings(settings)
    if (firstRun.current) { firstRun.current = false; return }
    window.electronAPI?.syncData({ settings: { ...settings } })
  }, [settings])

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }))
  }, [])

  return { settings, updateSettings }
}
