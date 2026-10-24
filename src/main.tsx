import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

/** 渲染前从主进程快照恢复数据：
    loadEvents() 在组件初始化时就会把默认事件写进 localStorage，恢复检查必须发生在那之前，
    否则"空数据 → 需要恢复"的判断永远不成立 */
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
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
