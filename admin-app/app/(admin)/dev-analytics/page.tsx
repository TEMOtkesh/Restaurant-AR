'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/useLang'

// Only send messages to this exact origin — never '*'
const ANALYTICS_ORIGIN = 'https://3darmenu.pages.dev'

export default function DevAnalyticsPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const tokenRef  = useRef('')
  const router    = useRouter()
  const [T] = useLang()
  // Gate: hide the nav link AND block direct URL access for non-team users.
  const [authed, setAuthed] = useState<'pending' | 'ok' | 'denied'>('pending')

  useEffect(() => {
    createClient().auth.getUser()
      .then(({ data }) => {
        const dev = data?.user?.app_metadata?.role === 'dev'
        setAuthed(dev ? 'ok' : 'denied')
        if (!dev) router.replace('/dashboard')
      })
      .catch(() => { setAuthed('denied'); router.replace('/dashboard') })
  }, [router])

  useEffect(() => {
    createClient().auth.getSession()
      .then(({ data }) => { tokenRef.current = data?.session?.access_token ?? '' })
      .catch(() => {})
  }, [])

  useEffect(() => {
    function relay(e: Event) {
      const { lang, dark } = (e as CustomEvent).detail
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'bl-pref', lang, dark },
        ANALYTICS_ORIGIN
      )
    }
    window.addEventListener('bl-pref', relay)
    return () => window.removeEventListener('bl-pref', relay)
  }, [])

  function sendInitialPrefs() {
    const lang  = localStorage.getItem('bl-admin-lang') || 'en'
    const dark  = localStorage.getItem('bl-admin-theme') !== 'light'
    const token = tokenRef.current

    if (token) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'bl-pref', lang, dark, token },
        ANALYTICS_ORIGIN
      )
      return
    }

    createClient().auth.getSession()
      .then(({ data }) => {
        tokenRef.current = data?.session?.access_token ?? ''
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'bl-pref', lang, dark, token: tokenRef.current },
          ANALYTICS_ORIGIN
        )
      })
      .catch(() => {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'bl-pref', lang, dark },
          ANALYTICS_ORIGIN
        )
      })
  }

  // Don't render the dashboard (or even the iframe) until we've confirmed the role.
  if (authed !== 'ok') {
    return (
      <p className="text-sm" style={{ color: 'var(--dim)' }}>
        {authed === 'pending' ? T.loading : ''}
      </p>
    )
  }

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-bold mb-1 page-title" style={{ color: 'var(--gold)' }}>{T.devTitle}</h1>
      <p className="text-sm mb-4 md:mb-6" style={{ color: 'var(--dim)' }}>
        {T.devDesc}
      </p>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <iframe
          ref={iframeRef}
          src="https://3darmenu.pages.dev/dev-analytics.html"
          className="w-full"
          style={{ height: 'clamp(480px, calc(100dvh - 160px), 1200px)', border: 'none' }}
          title="Developer Analytics"
          onLoad={sendInitialPrefs}
        />
      </div>
    </div>
  )
}
