import { useState, useEffect } from 'react'
import { DaysEvent, AppSettings, ThemeMode } from '@/types'
import { useEvents, useSettings } from '@/hooks/useEvents'
import EventCard from '@/components/EventCard'
import EventForm from '@/components/EventForm'
import SettingsPanel from '@/components/SettingsPanel'
import ThemeIcon from '@/components/ThemeIcon'
import './App.css'

type Tab = 'events' | 'settings'

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

  useEffect(() => { applyTheme(settings.theme) }, [settings.theme])

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
          <div className="events-grid">
            {events.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">D</div>
                <p>还没有事件，点击上方按钮添加吧</p>
              </div>
            ) : events.map(event => (
              <EventCard key={event.id} event={event}
                onEdit={(e) => { setEditingEvent(e); setShowForm(true) }}
                onDelete={(id) => { if (confirm('确定删除这个事件吗？')) deleteEvent(id) }}
                onShowWidget={async (e) => {
                  if (window.electronAPI) await window.electronAPI.toggleWidget(true, e.id)
                  else alert('请在应用环境中运行以使用桌面小组件')
                }} />
            ))}
          </div>
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
