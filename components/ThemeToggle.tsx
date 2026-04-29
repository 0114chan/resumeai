'use client'
// components/ThemeToggle.tsx
import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('theme') ?? 'dark'
    setDark(saved === 'dark')
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  const toggle = () => {
    const next = dark ? 'light' : 'dark'
    setDark(!dark)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  return (
    <button onClick={toggle} aria-label="테마 변경" style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px',
      borderRadius: 999, border: '1px solid var(--border2)',
      background: 'var(--bg2)', cursor: 'pointer', fontSize: 12,
      fontWeight: 600, color: 'var(--text2)', fontFamily: 'inherit',
      transition: 'all .15s',
    }}>
      <span style={{ fontSize: 13 }}>{dark ? '🌙' : '☀️'}</span>
      {/* Toggle track */}
      <span style={{
        position: 'relative', width: 30, height: 17, borderRadius: 999,
        background: dark ? 'var(--accent)' : 'var(--border2)',
        display: 'inline-block', transition: 'background .2s',
        flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute', top: 2, left: 2,
          width: 13, height: 13, borderRadius: '50%',
          background: '#fff',
          transform: dark ? 'translateX(13px)' : 'translateX(0)',
          transition: 'transform .2s',
          display: 'block',
        }} />
      </span>
      <span>{dark ? '다크' : '라이트'}</span>
    </button>
  )
}
