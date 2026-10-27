'use client'

import { useState, useEffect } from 'react'
import { IntroScreen } from './intro-screen'

type IntroState = 'pending' | 'showing' | 'hidden'

export function IntroWrapper({ children }: { children: React.ReactNode }) {
  const [introState, setIntroState] = useState<IntroState>('pending')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const forceReplay = params.get('introPreview') === '1'
    const alreadyShown = sessionStorage.getItem('scstudio_intro_shown')

    if (forceReplay || !alreadyShown) {
      if (!forceReplay) {
        sessionStorage.setItem('scstudio_intro_shown', '1')
      }
      setIntroState('showing')
    } else {
      setIntroState('hidden')
    }
  }, [])

  return (
    <>
      {children}

      {/* Overlay off-white enquanto checa sessionStorage (evita flash do conteúdo) */}
      {introState === 'pending' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'var(--background)',
          }}
        />
      )}

      {introState === 'showing' && (
        <IntroScreen onDone={() => setIntroState('hidden')} />
      )}
    </>
  )
}
