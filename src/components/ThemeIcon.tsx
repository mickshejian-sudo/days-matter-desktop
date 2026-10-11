import { ThemeMode } from '@/types'

interface Props {
  theme: ThemeMode
  size?: number
}

/**
 * 苹果 SF Symbols 风格主题图标（Apple 外观设置同款）
 * - 浅色：描边太阳（sun.max）
 * - 深色：实心新月（moon.fill）
 * - 自动：半填充圆（circle.lefthalf.filled）
 * 颜色继承 currentColor，随按钮状态自动变色
 */
export default function ThemeIcon({ theme, size = 15 }: Props) {
  if (theme === 'light') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" />
      </svg>
    )
  }

  if (theme === 'dark') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" />
      </svg>
    )
  }

  // 自动：左半实心圆
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth={1.8} />
      <path d="M12 3.4a8.6 8.6 0 0 0 0 17.2z" fill="currentColor" />
    </svg>
  )
}