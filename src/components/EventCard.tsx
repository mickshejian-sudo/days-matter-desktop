import { DaysEvent } from '@/types'
import { getDaysText, formatDate, getWeekday } from '@/utils/dateUtils'

interface Props {
  event: DaysEvent
  onEdit: (event: DaysEvent) => void
  onDelete: (id: string) => void
  onShowWidget: (event: DaysEvent) => void
}

export default function EventCard({ event, onEdit, onDelete, onShowWidget }: Props) {
  const { number, label } = getDaysText(event)
  const typeClass = event.type === 'countdown' ? 'type-countdown' : 'type-countup'
  const typeLabel = event.type === 'countdown' ? '倒数' : '正值'

  return (
    <div className="event-card" style={{ ['--event-color' as any]: event.color }}>
      {event.backgroundImage && (
        <img className="event-bg" src={event.backgroundImage} alt="" draggable={false}
          onError={(e) => { (e.target as HTMLImageElement).classList.add('event-bg-error') }} />
      )}
      <div className="event-card-content">
        <div className="color-indicator" style={{ backgroundColor: event.color }} />

      <div className="event-header">
        <div className="event-icon" style={{ backgroundColor: event.color + '22', color: event.color }}>
          ◆
        </div>
        <span className="event-title">{event.title}</span>
        <span className="event-badge">{typeLabel}</span>
      </div>

      <div className={`event-days ${typeClass}`}>
        <span className="number" style={{ color: event.type === 'countup' ? event.color : undefined }}>
          {number}
        </span>
        {label && <span className="label">{label}</span>}
      </div>

      <div className="event-date">
        {formatDate(event.date)} · {getWeekday(event.date)}
        {event.repeat === 'yearly' && <span style={{ marginLeft: 6 }}>· 每年重复</span>}
        {event.repeat === 'monthly' && <span style={{ marginLeft: 6 }}>· 每月重复</span>}
      </div>

      {event.note && (
        <div className="event-date" style={{ marginTop: 4, fontStyle: 'italic', opacity: 0.85 }}>
          {event.note}
        </div>
      )}

      <div className="event-actions">
        <button className="btn btn-secondary" onClick={() => onShowWidget(event)}>小组件</button>
        <button className="btn btn-secondary" onClick={() => onEdit(event)}>编辑</button>
        <button className="btn btn-danger" onClick={() => onDelete(event.id)}>删除</button>
      </div>
      </div>
    </div>
  )
}
