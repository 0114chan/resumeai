// app/api/upload-pdf/route.ts
// PDF를 서버에서 텍스트로 변환 → Claude에게 넘길 수 있는 형태로

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import pdf from 'pdf-parse'

export async function POST(req: NextRequest) {
  try {
    // 1. 인증 확인
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 2. FormData에서 파일 추출
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 })
    }

    // 3. PDF → 텍스트 변환
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const parsed = await pdf(buffer)
    const text = parsed.text.trim()

    if (!text || text.length < 50) {
      return NextResponse.json(
        { error: '텍스트를 추출할 수 없습니다. 스캔 PDF거나 손상된 파일일 수 있습니다.' },
        { status: 422 }
      )
    }

    // 4. Supabase Storage에 원본 PDF 저장
    const storagePath = `${user.id}/${Date.now()}_${file.name}`
    const { error: storageError } = await supabase.storage
      .from('resumes')
      .upload(storagePath, buffer, { contentType: 'application/pdf' })

    if (!storageError) {
      // 파일 메타 저장
      await supabase.from('uploaded_files').insert({
        user_id: user.id,
        storage_path: storagePath,
        filename: file.name,
      })
    }

    return NextResponse.json({
      text,
      pages: parsed.numpages,
      filename: file.name,
      storagePath: storageError ? null : storagePath,
    })

  } catch (err) {
    console.error('PDF parse error:', err)
    return NextResponse.json(
      { error: 'PDF 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
