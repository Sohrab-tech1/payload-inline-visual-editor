import React from 'react'

export const metadata = {
  description: 'Dev playground for the Payload inline visual editor',
  title: 'PVE Dev',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>{children}</body>
    </html>
  )
}
