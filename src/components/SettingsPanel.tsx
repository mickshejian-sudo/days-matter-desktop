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

export default function SettingsPanel({ settings, onUpdate }: Props) {
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

      {/* ===== 分组 3：系统 ===== */}
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
