// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ResumeAI — 채용공고 맞춤 이력서 비서',
  description: '채용공고를 분석해 내 이력서를 자동으로 최적화해주는 AI 비서',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 테마 깜빡임 방지 */}
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              const t = localStorage.getItem('theme') || 'dark';
              document.documentElement.setAttribute('data-theme', t);
            } catch(e) {}
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
