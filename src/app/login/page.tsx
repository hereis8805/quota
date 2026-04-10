'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function detectInAppBrowser(): { isInApp: boolean; isAndroid: boolean } {
  if (typeof window === 'undefined') return { isInApp: false, isAndroid: false }
  const ua = navigator.userAgent
  const isAndroid = /Android/i.test(ua)
  const isInApp = /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NaverApp|Snapchat|Twitter|LinkedInApp/i.test(ua)
    || (/Android/i.test(ua) && /wv\)/i.test(ua))
  return { isInApp, isAndroid }
}

function openInExternalBrowser() {
  const url = window.location.href
  // Android: intent scheme으로 Chrome 강제 실행
  window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`
}

export default function LoginPage() {
  const [inApp, setInApp] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)

  useEffect(() => {
    const { isInApp, isAndroid } = detectInAppBrowser()
    setInApp(isInApp)
    setIsAndroid(isAndroid)
  }, [])

  async function loginWithGoogle() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Routine Quest</CardTitle>
          <CardDescription>소셜 계정으로 로그인하여 운동을 기록하세요</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {inApp ? (
            <div className="flex flex-col gap-3">
              <div className="text-sm text-amber-400 bg-amber-400/10 rounded-lg px-4 py-3 leading-relaxed">
                <p className="font-semibold mb-1">카카오톡 내부 브라우저에서는 Google 로그인이 차단됩니다.</p>
                {isAndroid ? (
                  <p>아래 버튼을 눌러 Chrome에서 여세요.</p>
                ) : (
                  <p>우측 하단 <span className="font-semibold">···</span> 메뉴 → <span className="font-semibold">기본 브라우저로 열기</span>를 선택해 주세요.</p>
                )}
              </div>
              {isAndroid && (
                <Button size="lg" className="w-full h-14 text-base bg-blue-600 hover:bg-blue-700" onClick={openInExternalBrowser}>
                  Chrome으로 열기
                </Button>
              )}
            </div>
          ) : (
            <Button size="lg" variant="outline" className="w-full h-14 text-base" onClick={loginWithGoogle}>
              Google로 로그인
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
