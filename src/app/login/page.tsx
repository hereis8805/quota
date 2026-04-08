'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /KAKAOTALK|Line\/|Instagram|NAVER|FB_IAB|FBAN|Twitter|Snapchat|LinkedIn|WhatsApp/i.test(ua)
}

export default function LoginPage() {
  async function loginWithGoogle() {
    if (isInAppBrowser()) {
      alert('Google 로그인은 인앱 브라우저에서 지원되지 않습니다.\nChrome 또는 Safari에서 열어주세요.')
      return
    }
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function loginWithKakao() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const inAppBrowser = typeof navigator !== 'undefined' && isInAppBrowser()

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Workout Mission Tracker</CardTitle>
          <CardDescription>소셜 계정으로 로그인하여 운동을 기록하세요</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {inAppBrowser && (
            <p className="text-sm text-center text-amber-600 bg-amber-50 rounded-md p-3">
              Google 로그인은 Chrome 또는 Safari에서만 가능합니다.
              <br />
              우측 상단 메뉴 → 기본 브라우저로 열기
            </p>
          )}
          <Button size="lg" variant="outline" className="w-full h-14 text-base" onClick={loginWithGoogle}>
            Google로 로그인
          </Button>
          {/*<Button size="lg" className="w-full h-14 text-base bg-yellow-400 hover:bg-yellow-500 text-black" onClick={loginWithKakao}>*/}
          {/*  카카오로 로그인*/}
          {/*</Button>*/}
        </CardContent>
      </Card>
    </div>
  )
}
