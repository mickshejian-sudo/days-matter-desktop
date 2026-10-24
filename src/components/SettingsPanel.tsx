import { useState } from 'react'
import { AppSettings } from '@/types'
import ThemeIcon from './ThemeIcon'

interface Props {
  settings: AppSettings
  onUpdate: (updates: Partial<AppSettings>) => void
}

const COLORS = [
  '#FF6B6B', '#FF9F0A', '#FFD60A', '#30D158',
  '#64D2FF', '#5E5CE6', '#BF5AF2', '#FF2D55',
]

const THEMES = [
  { key: 'light' as const, label: '浅色', desc: '始终使用浅色外观' },
  { key: 'dark' as const,  label: '深色', desc: '始终使用深色外观' },
  { key: 'auto' as const,  label: '自动', desc: '跟随系统外观自动切换' },
]

const REMINDER_DAYS = [
  { value: 0, label: '仅当天' },
  { value: 1, label: '提前 1 天' },
  { value: 3, label: '提前 3 天' },
  { value: 7, label: '提前 7 天' },
]

export default function SettingsPanel({ settings, onUpdate }: Props) {
  const [dataMsg, setDataMsg] = useState('')

  const handleExport = async () => {
    setDataMsg('')
    const ok = await window.electronAPI?.exportData()
    setDataMsg(ok ? '✓ 已导出' : '已取消')
  }

  const handleImport = async () => {
    setDataMsg('')
    const res = await window.electronAPI?.importData()
    if (!res) { setDataMsg('已取消'); return }
    if (res.error) { setDataMsg('✕ ' + res.error); return }
    // 写回 localStorage 并重载，让主界面与小组件立即生效
    if (Array.isArray(res.events)) localStorage.setItem('days-matter-events', JSON.stringify(res.events))
    if (res.settings && Object.keys(res.settings).length > 0) {
      localStorage.setItem('days-matter-settings', JSON.stringify(res.settings))
    }
    window.location.reload()
  }

  return (
    <div className="settings-groups">
      {/* ===== 分组 1：外观 ===== */}
      <section className="settings-group">
        <h2 className="group-title">外观</h2>
        <div className="group-grid">
          <div className="setting-item">
            <div className="setting-head">
              <h3>主题</h3>
              <p>浅色 / 深色 / 自动跟随系统</p>
            </div>
            <div className="theme-selector">
              {THEMES.map(t => (
                <button key={t.key}
                  className={`theme-option ${settings.theme === t.key ? 'active' : ''}`}
                  onClick={() => onUpdate({ theme: t.key })}
                  title={t.desc}>
                  <span className="theme-icon"><ThemeIcon theme={t.key} /></span>
                  <span className="theme-label">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-head">
              <h3>事件颜色</h3>
              <p>新事件默认色</p>
            </div>
            <div className="color-picker-row">
              {COLORS.map(c => (
                <div key={c}
                  className={`color-swatch ${settings.defaultColor === c ? 'active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => onUpdate({ defaultColor: c })} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== 分组 2：小组件 ===== */}
      <section className="settings-group">
        <h2 className="group-title">桌面小组件</h2>
        <div className="group-grid">
          <div className="setting-item">
            <div className="setting-head">
              <h3>透明度</h3>
              <p>{settings.widgetOpacity}%</p>
            </div>
            <input type="range" className="app-slider" min="30" max="100"
              value={settings.widgetOpacity}
              onChange={e => onUpdate({ widgetOpacity: parseInt(e.target.value) })} />
          </div>

          <div className="setting-item">
            <div className="setting-head">
              <h3>尺寸</h3>
              <p>卡片大小档位</p>
            </div>
            <div className="theme-selector">
              <button className={`theme-option ${settings.widgetSize !== 'small' ? 'active' : ''}`}
                onClick={() => onUpdate({ widgetSize: 'medium' })}>
                <span className="theme-label">中 320×170</span>
              </button>
              <button className={`theme-option ${settings.widgetSize === 'small' ? 'active' : ''}`}
                onClick={() => onUpdate({ widgetSize: 'small' })}>
                <span className="theme-label">小 240×132</span>
              </button>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-head">
              <h3>窗口置顶</h3>
              <p>始终显示在其他软件之上</p>
            </div>
            <div className="toggle-row">
              <div className={`toggle-switch ${settings.widgetAlwaysOnTop ? 'on' : ''}`}
                onClick={() => onUpdate({ widgetAlwaysOnTop: !settings.widgetAlwaysOnTop })} />
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-head">
              <h3>背景遮罩</h3>
              <p>{settings.widgetOverlay}% · 有背景图时的压暗程度</p>
            </div>
            <input type="range" className="app-slider" min="0" max="90"
              value={settings.widgetOverlay}
              onChange={e => onUpdate({ widgetOverlay: parseInt(e.target.value) })} />
          </div>

          <div className="setting-item">
            <div className="setting-head">
              <h3>详细时间</h3>
              <p>不足一天显示时:分:秒</p>
            </div>
            <div className="toggle-row">
              <div className={`toggle-switch ${settings.showSecondaryInfo ? 'on' : ''}`}
                onClick={() => onUpdate({ showSecondaryInfo: !settings.showSecondaryInfo })} />
            </div>
          </div>
        </div>
      </section>

      {/* ===== 分组 3：提醒 ===== */}
      <section className="settings-group">
        <h2 className="group-title">提醒</h2>
        <div className="group-grid">
          <div className="setting-item">
            <div className="setting-head">
              <h3>临近提醒</h3>
              <p>到期临近时发系统桌面通知</p>
            </div>
            <div className="toggle-row">
              <div className={`toggle-switch ${settings.reminderEnabled ? 'on' : ''}`}
                onClick={() => onUpdate({ reminderEnabled: !settings.reminderEnabled })} />
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-head">
              <h3>提醒时机</h3>
              <p>提前多少天开始提醒</p>
            </div>
            <div className="theme-selector">
              {REMINDER_DAYS.map(o => (
                <button key={o.value}
                  className={`theme-option ${settings.reminderDays === o.value ? 'active' : ''}`}
                  onClick={() => onUpdate({ reminderDays: o.value })}>
                  <span className="theme-label">{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== 分组 4：系统 ===== */}
      <section className="settings-group">
        <h2 className="group-title">系统</h2>
        <div className="group-grid">
          <div className="setting-item">
            <div className="setting-head">
              <h3>开机自启</h3>
              <p>开机时自动启动</p>
            </div>
            <div className="toggle-row">
              <div className={`toggle-switch ${settings.launchAtLogin ? 'on' : ''}`}
                onClick={() => onUpdate({ launchAtLogin: !settings.launchAtLogin })} />
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-head">
              <h3>备份与恢复</h3>
              <p>{dataMsg || '事件与设置导出为 JSON 文件'}</p>
            </div>
            <div className="bg-picker-row">
              <button type="button" className="btn btn-secondary" onClick={handleExport}>导出数据</button>
              <button type="button" className="btn btn-secondary" onClick={handleImport}>导入数据</button>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-head">
              <h3>安装路径</h3>
              <p>安装时可自定义路径</p>
            </div>
            <div className="info-text">下次安装新版本时，安装向导会提示选择路径</div>
          </div>

          <div className="setting-item">
            <div className="setting-head">
              <h3>关于</h3>
              <p>倒数日 · Days Matter</p>
            </div>
            <div className="info-text">v{__APP_VERSION__} · Electron + React</div>
          </div>
        </div>
      </section>
    </div>
  )
}
