import React from 'react'
import ReactDOM from 'react-dom/client'
import Widget from './Widget'
import './widget.css'

/** 与主窗口相同的渲染前恢复逻辑（小组件窗口可能先于主窗口打开） */
async function bootstrap() {
  try {
    const api = window.electronAPI
    if (api?.getDataSnapshot && !localStorage.getItem('days-matter-events')) {
      const snap = await api.getDataSnapshot()
      if (snap && Array.isArray(snap.events) && snap.events.length > 0) {
        localStorage.setItem('days-matter-events', JSON.stringify(snap.events))
        if (snap.settings && Object.keys(snap.settings).length > 0) {
          localStorage.setItem('days-matter-settings', JSON.stringify(snap.settings))
        }
      }
    }
  } catch {}
}

bootstrap().then(() => {
  ReactDOM.createRoot(document.getElementById('widget-root')!).render(
    <React.StrictMode>
      <Widget />
    </React.StrictMode>
  )
})
