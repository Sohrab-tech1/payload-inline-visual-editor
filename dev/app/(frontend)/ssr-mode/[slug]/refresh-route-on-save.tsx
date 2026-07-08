'use client'

import { RefreshRouteOnSave as PayloadRefreshRouteOnSave } from '@payloadcms/live-preview-react'
import { useRouter } from 'next/navigation'
import React from 'react'

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

export const RefreshRouteOnSave: React.FC = () => {
  const router = useRouter()
  return <PayloadRefreshRouteOnSave refresh={() => router.refresh()} serverURL={serverURL} />
}
