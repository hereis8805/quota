import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Workout Mission Tracker',
  description: '개인 운동 목표 관리 앱',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark">
      <body className={`${geist.className} bg-background text-foreground min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
