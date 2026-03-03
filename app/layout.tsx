import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'A/B Lab — Claude-powered experiment design',
  description: 'Analyze any webpage and generate A/B experiment variants with before/after screenshots',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  )
}
