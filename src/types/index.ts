export type EventType = 'countdown' | 'countup' // 倒数 / 正计时

export type ThemeMode = 'light' | 'dark' | 'auto'

export interface DaysEvent {
  id: string
  title: string
  date: string // YYYY-MM-DD
  time?: string // HH:mm (可选)
  type: EventType
  color: string // hex: #RRGGBB
  icon?: string
  note?: string
  repeat?: 'none' | 'yearly' | 'monthly'
  createdAt: number
}

export interface AppSettings {
  launchAtLogin: boolean
  widgetOpacity: number // 0-100
  defaultColor: string
  showSecondaryInfo: boolean
  theme: ThemeMode
}

export const DEFAULT_SETTINGS: AppSettings = {
  launchAtLogin: false,
  widgetOpacity: 92,
  defaultColor: '#64D2FF',
  showSecondaryInfo: true,
  theme: 'auto',
}

/** 演示数据版本号：升级默认内容时递增，用于老用户自动换新 */
export const SEED_VERSION = 2

/** 下一个元旦（若今天就是元旦则用今天） */
function nextNewYearDate(): string {
  const now = new Date()
  const isNewYearDay = now.getMonth() === 0 && now.getDate() === 1
  return `${isNewYearDay ? now.getFullYear() : now.getFullYear() + 1}-01-01`
}

/** 下一个周六（若今天就是周六则用今天） */
function nextSaturdayDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7))
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export const DEFAULT_EVENTS: DaysEvent[] = [
  {
    id: 'demo-1',
    title: '元旦',
    date: nextNewYearDate(),
    type: 'countdown',
    color: '#FF6B6B',
    note: '新的一年，新的开始',
    repeat: 'yearly',
    createdAt: Date.now(),
  },
  {
    id: 'demo-2',
    title: '今年已过',
    date: `${new Date().getFullYear()}-01-01`,
    type: 'countup',
    color: '#30D158',
    note: '珍惜每一天',
    createdAt: Date.now(),
  },
  {
    id: 'demo-3',
    title: '周末',
    date: nextSaturdayDate(),
    type: 'countdown',
    color: '#64D2FF',
    note: '辛苦一周，好好休息',
    createdAt: Date.now(),
  },
]
