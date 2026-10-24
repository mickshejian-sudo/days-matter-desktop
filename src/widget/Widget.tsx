import { useState, useEffect, useRef } from 'react'
import { DaysEvent } from '@/types'
import { getDaysText, formatDate, getWeekday, calculateTimeRemaining } from '@/utils/dateUtils'
import '@/widget/widget.css'

const EVENTS_KEY = 'days-matter-events'
const SETTINGS_KEY = 'days-matter-settings'

function loadEvents(): DaysEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

/** 跟随主应用的设置：主题、透明度、尺寸档位、背景遮罩浓度 */
function applySettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    document.documentElement.dataset.theme = s.theme || 'auto'
    if (typeof s.widgetOpacity === 'number') {
      document.documentElement.style.setProperty('--widget-opacity', String(s.widgetOpacity / 100))
    }
    // 遮罩浓度：映射为渐变上下两档透明度
    const ov = typeof s.widgetOverlay === 'number' ? Math.min(90, Math.max(0, s.widgetOverlay)) : 45
    document.documentElement.style.setProperty('--bg-overlay-top', String((ov / 100) * 0.55))
    document.documentElement.style.setProperty('--bg-overlay-bottom', String(Math.min(0.85, (ov / 100) * 1.1)))
    document.documentElement.dataset.widgetSize = s.widgetSize === 'small' ? 'small' : 'medium'
  } catch {
    document.documentElement.dataset.theme = 'auto'
  }
}

export default function Widget() {
  const [events, setEvents] = useState<DaysEvent[]>(loadEvents())
  // 多小组件：每个窗口通过 URL 参数携带自己的 wid 与初始事件
  const urlParams = new URLSearchParams(window.location.search)
  const [currentEventId, setCurrentEventId] = useState<string | null>(urlParams.get('event'))
  const [, setNow] = useState(Date.now())
  const [showDetailed, setShowDetailed] = useState<boolean>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
      return s.showSecondaryInfo !== false
    } catch { return true }
  })
  const [pinOn, setPinOn] = useState<boolean>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
      return s.widgetAlwaysOnTop !== false
    } catch { return true }
  })
  // 拖拽状态：按下时通知主进程开始轮询光标移动窗口，抬起时结束（拖动过程零 IPC）
  const dragDownRef = useRef<{ x: number; y: number } | null>(null)
  const movedRef = useRef(false)

  useEffect(() => {
    applySettings()

    // 每秒刷新（倒计时秒数用）
    const tick = setInterval(() => setNow(Date.now()), 1000)
    // 定期同步事件与设置（主窗口改动后自动生效）
    const sync = () => {
      setEvents(loadEvents())
      applySettings()
      try {
        const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
        setPinOn(s.widgetAlwaysOnTop !== false)
        setShowDetailed(s.showSecondaryInfo !== false)
      } catch {}
    }
    const poll = setInterval(sync, 3000)
    window.addEventListener('storage', sync)

    if (window.electronAPI?.onWidgetUpdateEvent) {
      window.electronAPI.onWidgetUpdateEvent(() => sync())
    }
    return () => {
      clearInterval(tick)
      clearInterval(poll)
      window.removeEventListener('storage', sync)
    }
  }, [])

  // mousemove 仅用于判断「是否真的拖动了」（抑制拖拽后误触点击），移动窗口由主进程负责
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragDownRef.current
      if (!d) return
      if (!movedRef.current && Math.abs(e.screenX - d.x) + Math.abs(e.screenY - d.y) > 3) {
        movedRef.current = true
      }
    }
    const onUp = () => {
      if (!dragDownRef.current) return
      dragDownRef.current = null
      window.electronAPI?.widgetDragEnd()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  /** 按下卡片任意处开始拖拽（关闭/置顶按钮除外） */
  const onCardMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('.widget-close, .widget-pin')) return
    dragDownRef.current = { x: e.screenX, y: e.screenY }
    movedRef.current = false
    window.electronAPI?.widgetDragStart()
  }

  /** 直接在小组件上切换置顶：改 localStorage 设置后走数据同步，主进程即时生效 */
  const togglePin = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
      s.widgetAlwaysOnTop = !(s.widgetAlwaysOnTop !== false)
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
      setPinOn(s.widgetAlwaysOnTop)
      await window.electronAPI?.syncData({ settings: s })
    } catch {}
  }

  const currentEvent = events.find((e) => e.id === currentEventId) || events[0] || null

  const handleClose = async () => {
    if (window.electronAPI) await window.electronAPI.closeWidget()
  }

  if (!currentEvent) {
    return (
      <div className="widget-empty" onMouseDown={onCardMouseDown} onDoubleClick={() => window.electronAPI?.openMainWindow()}>
        <div className="widget-empty-icon">D</div>
        <div className="widget-empty-text">请在主应用中添加事件</div>
        <button className="widget-empty-close" onClick={handleClose} title="关闭">✕ 关闭</button>
      </div>
    )
  }

  const { number, label } = getDaysText(currentEvent)
  const typeText = currentEvent.type === 'countdown' ? '距离' : '已过'
  const timeRemaining = calculateTimeRemaining(currentEvent)

  /** 点击标题切换显示下一个事件（拖拽结束时忽略误触） */
  const cycleEvent = () => {
    if (movedRef.current || events.length <= 1) return
    const idx = events.findIndex((e) => e.id === currentEvent.id)
    const next = events[(idx + 1) % events.length]
    setCurrentEventId(next.id)
    window.electronAPI?.updateWidgetEvent(next.id)
  }

  return (
    <div
      className={`widget ${currentEvent.backgroundImage ? 'has-bg' : ''}`}
      style={{ ['--accent-color' as any]: currentEvent.color }}
      onMouseDown={onCardMouseDown}
      onDoubleClick={() => window.electronAPI?.openMainWindow()}
      title="双击打开主界面"
    >
      {currentEvent.backgroundImage && (
        <img className="widget-bg" src={currentEvent.backgroundImage} alt="" draggable={false}
          onError={(e) => { (e.target as HTMLImageElement).classList.add('widget-bg-error') }} />
      )}
      <div className="widget-header">
        <div className="widget-icon">◆</div>
        <div
          className="widget-title"
          onClick={cycleEvent}
          title={events.length > 1 ? '点击切换事件' : currentEvent.title}
        >
          {currentEvent.title}
          {events.length > 1 && <span className="cycle-hint">↻</span>}
        </div>
        <button
          className={`widget-pin ${pinOn ? 'on' : ''}`}
          onClick={togglePin}
          title={pinOn ? '已置顶 · 点击取消' : '未置顶 · 点击置顶'}
        >📌</button>
        <button className="widget-close" onClick={handleClose} title="关闭">✕</button>
      </div>

      <div className="widget-body">
        <div className="widget-days">
          <span className="days-number">{number}</span>
          {label && <span className="days-label">{label}</span>}
        </div>
        <div className="widget-meta">
          <span>{typeText}</span>
          <span>{formatDate(currentEvent.date)}</span>
          <span>{getWeekday(currentEvent.date)}</span>
        </div>
        {currentEvent.type === 'countdown' && showDetailed && (
          <div className="widget-time">{timeRemaining}</div>
        )}
        {currentEvent.note && <div className="widget-note">{currentEvent.note}</div>}
      </div>
    </div>
  )
}
