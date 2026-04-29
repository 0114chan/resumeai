// app/api/analyze/route.ts
// Claude API 호출은 100% 서버에서만. API 키 노출 없음.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeResume } from '@/lib/claude'

export async function POST(req: NextRequest) {
  try {
    // 1. 인증 확인
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 2. 요청 파싱
    const { resume, jobPosting, jobCompany, jobTitle, resumeVersionId } = await req.json()
    if (!resume || !jobPosting) {
      return NextResponse.json({ error: '이력서와 채용공고를 모두 입력해주세요.' }, { status: 400 })
    }

    // 3. Claude API 호출 (서버에서만)
    const result = await analyzeResume(resume, jobPosting)

    // 4. 분석 결과 DB 저장
    const { data: analysis, error: dbError } = await supabase
      .from('analyses')
      .insert({
        user_id: user.id,
        resume_ver_id: resumeVersionId || null,
        job_company: jobCompany || null,
        job_title: jobTitle || null,
        job_posting: jobPosting,
        score: result.score,
        result_json: result,
      })
      .select()
      .single()

    if (dbError) {
      console.error('DB save error:', dbError)
      // DB 저장 실패해도 결과는 반환
    }

    return NextResponse.json({ result, analysisId: analysis?.id })

  } catch (err) {
    console.error('Analysis error:', err)
    return NextResponse.json(
      { error: '분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}
