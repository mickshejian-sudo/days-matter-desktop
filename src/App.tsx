import { useState, useEffect, useMemo } from 'react'
import { DaysEvent, AppSettings, ThemeMode } from '@/types'
import { useEvents, useSettings } from '@/hooks/useEvents'
import { getDaysText } from '@/utils/dateUtils'
import EventCard from '@/components/EventCard'
import EventForm from '@/components/EventForm'
import SettingsPanel from '@/components/SettingsPanel'
import ThemeIcon from '@/components/ThemeIcon'
import './App.css'

type Tab = 'events' | 'settings'
type SortKey = 'created' | 'date' | 'days'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'created', label: '添加时间' },
  { key: 'days', label: '剩余天数' },
  { key: 'date', label: '目标日期' },
]

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme
}

const THEME_ORDER: ThemeMode[] = ['auto', 'light', 'dark']
const THEME_LABEL: Record<ThemeMode, string> = { auto: '自动', light: '浅色', dark: '深色' }

export default function App() {
  const { events, addEvent, updateEvent, deleteEvent } = useEvents()
  const { settings, updateSettings } = useSettings()
  const [tab, setTab] = useState<Tab>('events')
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<DaysEvent | null>(null)
  const [keyword, setKeyword] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const saved = localStorage.getItem('days-matter-sort')
    return saved === 'date' || saved === 'days' ? saved : 'created'
  })

  useEffect(() => { localStorage.setItem('days-matter-sort', sortKey) }, [sortKey])

  useEffect(() => { applyTheme(settings.theme) }, [settings.theme])

  // 启动恢复 + 快照初始化：
  // ① localStorage 被清空但主进程快照里还有数据 → 写回并重载
  // ② 否则把当前数据同步给主进程，保证 data.json 从启动那一刻就存在
  useEffect(() => {
    window.electronAPI?.getDataSnapshot().then((snap) => {
      const hasLocal = !!localStorage.getItem('days-matter-events')
      if (!hasLocal && snap && Array.isArray(snap.events) && snap.events.length > 0) {
        localStorage.setItem('days-matter-events', JSON.stringify(snap.events))
        if (snap.settings && Object.keys(snap.settings).length > 0) {
          localStorage.setItem('days-matter-settings', JSON.stringify(snap.settings))
        }
        window.location.reload()
        return
      }
      window.electronAPI?.syncData({ events, settings: { ...settings } })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 搜索 + 排序
  const visibleEvents = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    let list = kw
      ? events.filter(e => e.title.toLowerCase().includes(kw) || (e.note || '').toLowerCase().includes(kw))
      : [...events]
    if (sortKey === 'date') {
      list.sort((a, b) => a.date.localeCompare(b.date))
    } else if (sortKey === 'days') {
      list.sort((a, b) => {
        const na = parseInt(getDaysText(a).number, 10) || 0
        const nb = parseInt(getDaysText(b).number, 10) || 0
        return na - nb
      })
    }
    return list
  }, [events, keyword, sortKey])

  const nextTheme = () => {
    const i = THEME_ORDER.indexOf(settings.theme)
    updateSettings({ theme: THEME_ORDER[(i + 1) % THEME_ORDER.length] })
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <div className="logo">D</div>
          <span>倒数日</span>
        </div>
        <div className="app-actions">
          <button className="btn btn-secondary" onClick={nextTheme}
            title={`当前：${THEME_LABEL[settings.theme]} · 点击切换`}>
            <ThemeIcon theme={settings.theme} size={13} />
            {THEME_LABEL[settings.theme]}
          </button>
          <button className="btn btn-primary" onClick={() => { setEditingEvent(null); setShowForm(true) }}>
            ＋ 添加事件
          </button>
          {/* Windows 自绘栏窗口控制 */}
          <div className="win-controls">
            <button className="win-btn" title="最小化" onClick={() => window.electronAPI?.minimize()}>—</button>
            <button className="win-btn" title="最大化" onClick={() => window.electronAPI?.maximize()}>▢</button>
            <button className="win-btn close" title="关闭" onClick={() => window.electronAPI?.close()}>✕</button>
          </div>
        </div>
      </header>

      <nav className="app-tabs">
        <button className={`tab-btn ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>
          事件列表 <span style={{ opacity: 0.55 }}>({events.length})</span>
        </button>
        <button className={`tab-btn ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
          设置
        </button>
      </nav>

      <main className="app-main">
        {tab === 'events' && (
          <>
            {events.length > 3 && (
              <div className="list-toolbar">
                <input
                  type="text"
                  className="search-input"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  placeholder="搜索标题或备注..."
                />
                <select className="sort-select" value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}>
                  {SORT_OPTIONS.map(o => (
                    <option key={o.key} value={o.key}>按{o.label}排序</option>
                  ))}
                </select>
              </div>
            )}
            <div className="events-grid">
              {events.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">D</div>
                  <p>还没有事件，点击上方按钮添加吧</p>
                </div>
              ) : visibleEvents.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔍</div>
                  <p>没有匹配「{keyword}」的事件</p>
                </div>
              ) : visibleEvents.map(event => (
                <EventCard key={event.id} event={event}
                  onEdit={(e) => { setEditingEvent(e); setShowForm(true) }}
                  onDelete={(id) => { if (confirm('确定删除这个事件吗？')) deleteEvent(id) }}
                  onShowWidget={async (e) => {
                    if (window.electronAPI) await window.electronAPI.toggleWidget(true, e.id)
                    else alert('请在应用环境中运行以使用桌面小组件')
                  }} />
              ))}
            </div>
          </>
        )}
        {tab === 'settings' && (
          <SettingsPanel settings={settings} onUpdate={updateSettings} />
        )}
      </main>

      {showForm && (
        <EventForm initialEvent={editingEvent} defaultColor={settings.defaultColor}
          onSubmit={(data) => {
            editingEvent ? updateEvent(editingEvent.id, data) : addEvent(data)
            setShowForm(false); setEditingEvent(null)
          }}
          onCancel={() => { setShowForm(false); setEditingEvent(null) }} />
      )}
    </div>
  )
}
