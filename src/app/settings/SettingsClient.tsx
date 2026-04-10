'use client'

import { useState, useRef } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import type { Exercise } from '@/types'
import Link from 'next/link'

interface Props {
  userId: string
}

const EMPTY_FORM = {
  name: '',
  daily_target: 10,
  score_per_unit: 1,
  is_negative: false,
}

export default function SettingsClient({ userId }: Props) {
  const { data: exercises = [], mutate, isLoading } = useSWR(
    `settings-exercises-${userId}`,
    async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('exercises')
        .select('*')
        .eq('user_id', userId)
        .order('order_index', { ascending: true })
      return data ?? []
    },
    { revalidateOnFocus: false }
  )

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [ghostEx, setGhostEx] = useState<Exercise | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const dragMetaRef = useRef({ offsetY: 0, width: 0 })

  function getItemIndex(y: number): number | null {
    if (!listRef.current) return null
    const items = listRef.current.querySelectorAll('[data-item]')
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect()
      if (y >= rect.top && y < rect.bottom) return i
    }
    if (items.length > 0) {
      if (y >= items[items.length - 1].getBoundingClientRect().bottom) return items.length - 1
      if (y < items[0].getBoundingClientRect().top) return 0
    }
    return null
  }

  async function saveOrder(updated: Exercise[]) {
    const supabase = createClient()
    await Promise.all(
      updated.map((ex) =>
        supabase.from('exercises').update({ order_index: ex.order_index }).eq('id', ex.id)
      )
    )
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setError(null)
    setShowForm(true)
  }

  function openEdit(ex: Exercise) {
    setForm({
      name: ex.name,
      daily_target: ex.daily_target,
      score_per_unit: Math.abs(ex.score_per_unit),
      is_negative: ex.score_per_unit < 0,
    })
    setEditId(ex.id)
    setError(null)
    setShowForm(true)
  }

  function handleNumberInput(key: 'daily_target' | 'score_per_unit', value: string) {
    const n = parseInt(value)
    if (!isNaN(n) && n >= 1) setForm((f) => ({ ...f, [key]: n }))
    else if (value === '') setForm((f) => ({ ...f, [key]: 0 }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('이름을 입력하세요.'); return }
    if (form.daily_target < 1) { setError('목표 횟수는 1 이상이어야 합니다.'); return }
    if (form.score_per_unit < 1) { setError('점수는 1 이상이어야 합니다.'); return }

    setSaving(true)
    setError(null)
    const supabase = createClient()

    const payload = {
      name: form.name.trim(),
      daily_target: form.daily_target,
      score_per_unit: form.is_negative ? -Math.abs(form.score_per_unit) : form.score_per_unit,
    }

    if (editId) {
      const { data, error: err } = await supabase
        .from('exercises').update(payload).eq('id', editId).select().single()
      if (err) { setError(err.message); setSaving(false); return }
      if (data) mutate(exercises.map((e) => (e.id === editId ? data : e)), false)
    } else {
      const { data, error: err } = await supabase
        .from('exercises')
        .insert({ ...payload, user_id: userId, order_index: exercises.length })
        .select().single()
      if (err) { setError(err.message); setSaving(false); return }
      if (data) mutate([...exercises, data], false)
    }

    setSaving(false)
    setShowForm(false)
    setEditId(null)
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('exercises').delete().eq('id', id)
    mutate(exercises.filter((e) => e.id !== id), false)
  }

  async function handleToggleActive(ex: Exercise) {
    const supabase = createClient()
    await supabase.from('exercises').update({ is_active: !ex.is_active }).eq('id', ex.id)
    mutate(exercises.map((e) => e.id === ex.id ? { ...e, is_active: !e.is_active } : e), false)
  }

  if (isLoading && exercises.length === 0) {
    return (
      <div className="min-h-screen max-w-md mx-auto flex items-center justify-center">
        <p className="text-zinc-500 text-sm animate-pulse">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen max-w-md mx-auto p-4 flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="text-zinc-400 hover:text-white text-sm">← 대시보드</Link>
        <h1 className="text-xl font-bold">일일 할당량 설정</h1>
      </div>

      <div ref={listRef} className="flex flex-col gap-2">
        {exercises.length === 0 && !showForm && (
          <p className="text-zinc-500 text-sm text-center py-6">등록된 항목이 없습니다.</p>
        )}
        {exercises.map((ex, idx) => (
          <div key={ex.id} data-item className="relative">
            {dragOver === idx && dragging !== null && dragging !== idx && dragging > idx && (
              <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
            )}
            <Card className={`transition-all duration-150 ${dragging === idx ? 'opacity-20 scale-[0.98]' : ''} ${!ex.is_active && dragging !== idx ? 'opacity-50' : ''}`}>
              <CardContent className="flex items-center gap-2 py-3 px-3">
                <div
                  className="cursor-grab active:cursor-grabbing touch-none select-none text-zinc-600 hover:text-zinc-400 px-1 text-xl leading-none"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId)
                    const cardEl = e.currentTarget.closest('[data-item]') as HTMLElement
                    const rect = cardEl?.getBoundingClientRect()
                    dragMetaRef.current = {
                      offsetY: rect ? e.clientY - rect.top : 0,
                      width: rect ? rect.width : 300,
                    }
                    if (ghostRef.current) {
                      ghostRef.current.style.transform = `translate(${rect?.left ?? 0}px, ${e.clientY - dragMetaRef.current.offsetY}px)`
                      ghostRef.current.style.width = `${dragMetaRef.current.width}px`
                    }
                    setGhostEx(ex)
                    setDragging(idx)
                    setDragOver(idx)
                  }}
                  onPointerMove={(e) => {
                    if (dragging === null) return
                    if (ghostRef.current) {
                      const rect = listRef.current?.getBoundingClientRect()
                      ghostRef.current.style.transform = `translate(${rect?.left ?? 0}px, ${e.clientY - dragMetaRef.current.offsetY}px)`
                    }
                    const newIdx = getItemIndex(e.clientY)
                    if (newIdx !== null && newIdx !== dragOver) setDragOver(newIdx)
                  }}
                  onPointerUp={() => {
                    if (dragging !== null && dragOver !== null && dragging !== dragOver) {
                      const reordered = [...exercises]
                      const [removed] = reordered.splice(dragging, 1)
                      reordered.splice(dragOver, 0, removed)
                      const updated = reordered.map((e, i) => ({ ...e, order_index: i }))
                      mutate(updated, false)
                      saveOrder(updated)
                    }
                    setDragging(null)
                    setDragOver(null)
                    setGhostEx(null)
                  }}
                  onPointerCancel={() => { setDragging(null); setDragOver(null); setGhostEx(null) }}
                >⠿</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{ex.name}</span>
                    <Badge variant="outline" className={ex.score_per_unit < 0 ? 'text-red-400 border-red-800' : 'text-green-400 border-green-800'}>
                      {ex.score_per_unit > 0 ? '+' : ''}{ex.score_per_unit}점/회
                    </Badge>
                  </div>
                  <span className="text-xs text-zinc-500">목표 {ex.daily_target}회</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={ex.is_active} onCheckedChange={() => handleToggleActive(ex)} />
                  <Button variant="ghost" size="sm" className="text-zinc-400 px-2" onClick={() => openEdit(ex)}>수정</Button>
                  <Button variant="ghost" size="sm" className="text-red-400 px-2" onClick={() => handleDelete(ex.id)}>삭제</Button>
                </div>
              </CardContent>
            </Card>
            {dragOver === idx && dragging !== null && dragging !== idx && dragging < idx && (
              <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
            )}
          </div>
        ))}
      </div>

      {/* 드래그 ghost — 포인터를 따라다니는 플로팅 카드 */}
      {ghostEx && (
        <div
          ref={ghostRef}
          className="fixed top-0 left-0 pointer-events-none z-50 will-change-transform"
          style={{ width: dragMetaRef.current.width }}
        >
          <Card className="border-blue-500/60 shadow-2xl shadow-black/60 opacity-80 backdrop-blur-sm">
            <CardContent className="flex items-center gap-2 py-3 px-3">
              <div className="text-blue-400 px-1 text-xl leading-none select-none">⠿</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{ghostEx.name}</span>
                  <Badge variant="outline" className={ghostEx.score_per_unit < 0 ? 'text-red-400 border-red-800' : 'text-green-400 border-green-800'}>
                    {ghostEx.score_per_unit > 0 ? '+' : ''}{ghostEx.score_per_unit}점/회
                  </Badge>
                </div>
                <span className="text-xs text-zinc-500">목표 {ghostEx.daily_target}회</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm">{editId ? '항목 수정' : '항목 추가'}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-zinc-400">이름</label>
              <Input
                placeholder="예: 팔굽혀펴기, 스쿼트, 줄넘기"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-sm text-zinc-400">일일 목표 (회)</label>
                <div className="flex items-center gap-1">
                  <Button variant="outline" className="w-9 h-9 p-0 shrink-0"
                    onClick={() => setForm((f) => ({ ...f, daily_target: Math.max(1, f.daily_target - 1) }))}>−</Button>
                  <Input
                    type="number" min={1}
                    className="text-center font-bold text-lg h-9 px-1"
                    value={form.daily_target || ''}
                    onChange={(e) => handleNumberInput('daily_target', e.target.value)}
                  />
                  <Button variant="outline" className="w-9 h-9 p-0 shrink-0"
                    onClick={() => setForm((f) => ({ ...f, daily_target: f.daily_target + 1 }))}>+</Button>
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-sm text-zinc-400">점수/회</label>
                <div className="flex items-center gap-1">
                  <Button variant="outline" className="w-9 h-9 p-0 shrink-0"
                    onClick={() => setForm((f) => ({ ...f, score_per_unit: Math.max(1, f.score_per_unit - 1) }))}>−</Button>
                  <Input
                    type="number" min={1}
                    className="text-center font-bold text-lg h-9 px-1"
                    value={form.score_per_unit || ''}
                    onChange={(e) => handleNumberInput('score_per_unit', e.target.value)}
                  />
                  <Button variant="outline" className="w-9 h-9 p-0 shrink-0"
                    onClick={() => setForm((f) => ({ ...f, score_per_unit: f.score_per_unit + 1 }))}>+</Button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">마이너스 항목</p>
                <p className="text-xs text-zinc-500">술마시기, 배달음식 등 점수 차감</p>
              </div>
              <Switch checked={form.is_negative} onCheckedChange={(v) => setForm((f) => ({ ...f, is_negative: v }))} />
            </div>
            {form.is_negative && (
              <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                1회 기록 시 -{form.score_per_unit}점 차감
              </p>
            )}

            <div className="flex gap-2 mt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setShowForm(false); setError(null) }}>취소</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!showForm && (
        <Button size="lg" className="w-full h-14 text-lg" onClick={openAdd}>
          + 항목 추가
        </Button>
      )}
    </div>
  )
}
