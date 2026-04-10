'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  async function loginWithKakao() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Routine Quest</CardTitle>
          <CardDescription>카카오 계정으로 로그인하여 할당량을 기록하세요</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full h-14 text-base font-semibold bg-[#FEE500] hover:bg-[#F0D800] text-[#191919]"
            onClick={loginWithKakao}
          >
            카카오로 로그인
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
