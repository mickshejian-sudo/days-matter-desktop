import { useState, useRef, useEffect } from 'react'
import { DaysEvent } from '@/types'

interface Props {
  initialEvent: DaysEvent | null
  defaultColor: string
  onSubmit: (data: Omit<DaysEvent, 'id' | 'createdAt'>) => void
  onCancel: () => void
}

const COLORS = [
  '#FF6B6B', '#FF9F0A', '#FFD60A', '#30D158',
  '#64D2FF', '#5E5CE6', '#BF5AF2', '#FF2D55',
]

export default function EventForm({ initialEvent, defaultColor, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initialEvent?.title || '')
  const [date, setDate] = useState(initialEvent?.date || new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState(initialEvent?.time || '')
  const [type, setType] = useState<DaysEvent['type']>(initialEvent?.type || 'countdown')
  const [color, setColor] = useState(initialEvent?.color || defaultColor)
  const [note, setNote] = useState(initialEvent?.note || '')
  const [repeat, setRepeat] = useState<DaysEvent['repeat']>(initialEvent?.repeat || 'none')
  const [backgroundImage, setBackgroundImage] = useState(initialEvent?.backgroundImage || '')
  const [bgPicking, setBgPicking] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)
  const openedAt = useRef(Date.now())

  // 弹窗打开后主动聚焦标题框（比 autoFocus 更可靠，无边框窗口下也能拿到焦点）
  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !date) {
      titleRef.current?.focus()   // 无效时回焦标题框，给出可感知反馈
      return
    }
    onSubmit({ title: title.trim(), date, time: time || undefined, type, color, note: note || undefined, repeat, backgroundImage: backgroundImage || undefined })
  }

  /** 系统文件选择器选本地图片（主进程复制后返回 daysimg:// 地址） */
  const handlePickFile = async () => {
    setBgPicking(true)
    try {
      const url = await window.electronAPI?.pickBackgroundImage()
      if (url) setBackgroundImage(url)
    } finally {
      setBgPicking(false)
    }
  }

  /** 粘贴 http(s) 图片链接 */
  const handleUrlChange = (value: string) => {
    setBackgroundImage(value.trim())
  }

  const isHttpUrl = /^https?:\/\//i.test(backgroundImage)

  // 打开后 250ms 内忽略遮罩点击（防止双击「添加事件」按钮的第二下误关弹窗）
  const handleOverlayClick = () => {
    if (Date.now() - openedAt.current < 250) return
    onCancel()
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initialEvent ? '编辑事件' : '添加事件'}</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>标题</label>
            <input ref={titleRef} type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="例如：生日、纪念日" required />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>日期</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>时间（可选）</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>类型</label>
              <select value={type} onChange={e => setType(e.target.value as DaysEvent['type'])}>
                <option value="countdown">倒数日（距离还有几天）</option>
                <option value="countup">正值日（已过了几天）</option>
              </select>
            </div>
            <div className="form-group">
              <label>重复</label>
              <select value={repeat} onChange={e => setRepeat(e.target.value as DaysEvent['repeat'])}>
                <option value="none">不重复</option>
                <option value="yearly">每年重复</option>
                <option value="monthly">每月重复</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>颜色</label>
            <div className="color-picker-row">
              {COLORS.map(c => (
                <div key={c} className={`color-swatch ${color === c ? 'active' : ''}`}
                  style={{ backgroundColor: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>备注（可选）</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="写点什么..." />
          </div>

          <div className="form-group">
            <label>背景图片（可选）</label>
            <div className="bg-picker-row">
              <button type="button" className="btn btn-secondary" onClick={handlePickFile} disabled={bgPicking}>
                {bgPicking ? '处理中...' : '选择本地图片'}
              </button>
              <input type="text" className="bg-url-input" value={isHttpUrl ? backgroundImage : ''}
                onChange={e => handleUrlChange(e.target.value)}
                placeholder="或粘贴图片链接 https://..." />
            </div>
            {backgroundImage && (
              <div className="bg-preview">
                <img src={backgroundImage} alt="背景预览"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0' }}
                  onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = '1' }} />
                <button type="button" className="bg-remove" onClick={() => setBackgroundImage('')}
                  title="移除背景图">✕</button>
                {!isHttpUrl && <span className="bg-hint">已复制到应用数据目录</span>}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>取消</button>
            <button type="submit" className="btn btn-primary">{initialEvent ? '保存' : '添加'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
