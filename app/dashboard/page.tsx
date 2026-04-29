'use client'
// app/dashboard/page.tsx
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import type { ResumeVersion, AnalysisResult, AnalysisItem } from '@/lib/types'

type Tab = 'upload' | 'analyze' | 'editor' | 'history'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('upload')
  const [user, setUser] = useState<{ email?: string } | null>(null)

  // 이력서 버전
  const [versions, setVersions] = useState<ResumeVersion[]>([])
  const [currentVerIdx, setCurrentVerIdx] = useState(0)

  // 업로드 탭
  const [resumeText, setResumeText] = useState('')
  const [pdfStatus, setPdfStatus] = useState('')
  const [uploadLoading, setUploadLoading] = useState(false)

  // 분석 탭
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [jobPosting, setJobPosting] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisSteps, setAnalysisSteps] = useState<string[]>([])
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [appliedItems, setAppliedItems] = useState<Set<number>>(new Set())

  // 편집기 탭
  const [editorContent, setEditorContent] = useState('')
  const [diffMode, setDiffMode] = useState(false)
  const [compareIdx, setCompareIdx] = useState(1)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUser(user)
    })
    loadVersions()
  }, [])

  const loadVersions = async () => {
    const res = await fetch('/api/resume-versions')
    if (res.ok) {
      const { versions } = await res.json()
      setVersions(versions ?? [])
      if (versions?.length) setEditorContent(versions[0].content)
    }
  }

  // PDF 업로드
  const handlePdf = async (file: File) => {
    setUploadLoading(true)
    setPdfStatus('PDF 읽는 중...')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload-pdf', { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) {
      setResumeText(data.text)
      setPdfStatus(`✓ ${data.filename} (${data.pages}페이지) 읽기 완료`)
    } else {
      setPdfStatus(`⚠ ${data.error}`)
    }
    setUploadLoading(false)
  }

  // 이력서 저장
  const saveResume = async () => {
    if (!resumeText.trim()) { alert('이력서 내용을 입력하거나 PDF를 업로드하세요.'); return }
    const res = await fetch('/api/resume-versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: `최초 등록`, content: resumeText }),
    })
    if (res.ok) {
      await loadVersions()
      setTab('analyze')
    }
  }

  // 분석 실행
  const runAnalysis = async () => {
    if (!jobPosting.trim()) { alert('채용공고를 입력해주세요.'); return }
    if (!versions.length) { alert('먼저 이력서를 등록해주세요.'); setTab('upload'); return }

    setAnalyzing(true)
    setResult(null)
    setAppliedItems(new Set())
    setAnalysisSteps(['채용공고 키워드 추출 중...', '이력서와 비교 분석 중...', '보완점 도출 중...', '포트폴리오 로드맵 생성 중...'])

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resume: versions[currentVerIdx].content,
        jobPosting,
        jobCompany: company,
        jobTitle,
        resumeVersionId: versions[currentVerIdx].id,
      }),
    })

    setAnalyzing(false)
    setAnalysisSteps([])

    if (res.ok) {
      const { result } = await res.json()
      setResult(result)
    } else {
      const { error } = await res.json()
      alert(error || '분석 실패')
    }
  }

  // 항목 적용
  const applyItem = (item: AnalysisItem, idx: number) => {
    if (!item.after) return
    let content = versions[currentVerIdx].content
    if (item.before && content.includes(item.before)) {
      content = content.replace(item.before, item.after)
    } else {
      content += `\n\n[AI 제안 — ${item.title}]\n${item.after}`
    }
    const updated = [...versions]
    updated[currentVerIdx] = { ...updated[currentVerIdx], content }
    setVersions(updated)
    setEditorContent(content)
    setAppliedItems(prev => new Set(prev).add(idx))
  }

  // 모두 적용 + 새 버전 저장
  const applyAll = async () => {
    if (!result) return
    let content = versions[currentVerIdx].content
    result.items.forEach((item, i) => {
      if (appliedItems.has(i) || !item.after) return
      if (item.before && content.includes(item.before)) {
        content = content.replace(item.before, item.after)
      } else {
        content += `\n\n[AI 제안 — ${item.title}]\n${item.after}`
      }
    })
    const label = `${company || '공고'} 최적화 v${versions.length + 1}`
    const res = await fetch('/api/resume-versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, content, score: result.score, jobCompany: company, jobTitle }),
    })
    if (res.ok) {
      await loadVersions()
      setCurrentVerIdx(0)
      setEditorContent(content)
      setAppliedItems(new Set(result.items.map((_, i) => i)))
      alert(`✓ "${label}" 버전으로 저장되었습니다.`)
      setTab('editor')
    }
  }

  // 수동 편집 저장
  const saveEdit = async (asNewVersion = false) => {
    if (asNewVersion) {
      const label = `수동 편집 v${versions.length + 1}`
      await fetch('/api/resume-versions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, content: editorContent }),
      })
    } else {
      await fetch('/api/resume-versions', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: versions[currentVerIdx].id, content: editorContent }),
      })
    }
    await loadVersions()
    alert(asNewVersion ? '새 버전으로 저장되었습니다.' : '저장되었습니다.')
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ──────────── 렌더 ────────────
  const typeMap: Record<string, { label: string; color: string; bg: string }> = {
    strength: { label: '강점', color: 'var(--green)', bg: 'var(--green-bg)' },
    weak:     { label: '보완', color: 'var(--red)',   bg: 'var(--red-bg)' },
    add:      { label: '추가', color: 'var(--accent2)', bg: 'var(--accent-bg)' },
    portfolio:{ label: '포트폴리오', color: 'var(--teal)', bg: 'var(--teal-bg)' },
    keyword:  { label: '키워드', color: 'var(--amber)', bg: 'var(--amber-bg)' },
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gridTemplateRows: '56px 1fr', height: '100vh', background: 'var(--bg)' }}>

      {/* ── 상단바 ── */}
      <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>ResumeAI</span>
        </div>
        <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: 'var(--accent-bg)', color: 'var(--accent2)', border: '1px solid rgba(124,110,240,.2)' }}>AI 이력서 비서</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {versions.length > 0 && <span style={{ fontSize: 12, color: 'var(--text3)' }}>v{versions.length} · {versions[0]?.label}</span>}
          <ThemeToggle />
          <button onClick={logout} className="btn btn-secondary btn-sm">로그아웃</button>
        </div>
      </div>

      {/* ── 사이드바 ── */}
      <div style={{ background: 'var(--bg2)', borderRight: '1px solid var(--border)', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
        {(['upload', 'analyze', 'editor', 'history'] as Tab[]).map(t => (
          <div key={t} onClick={() => setTab(t)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
            borderRadius: 6, cursor: 'pointer', fontSize: 13,
            color: tab === t ? 'var(--accent2)' : 'var(--text2)',
            background: tab === t ? 'var(--accent-bg)' : 'transparent',
            border: `1px solid ${tab === t ? 'rgba(124,110,240,.2)' : 'transparent'}`,
          }}>
            {t === 'upload' && ''}{t === 'analyze' && ''}{t === 'editor' && ''}{t === 'history' && ''}
            <span>{{upload:'이력서 업로드',analyze:'공고 분석',editor:'이력서 편집',history:'버전 기록'}[t]}</span>
          </div>
        ))}

        {versions.length > 0 && <>
          <div style={{ height: 1, background: 'var(--border)', margin: '8px 4px' }} />
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', letterSpacing: '.08em', textTransform: 'uppercase', padding: '4px 12px' }}>버전 기록</div>
          {versions.map((v, i) => (
            <div key={v.id} onClick={() => { setCurrentVerIdx(i); setEditorContent(v.content); setTab('editor') }} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
              borderRadius: 6, cursor: 'pointer', fontSize: 12,
              color: currentVerIdx === i ? 'var(--accent2)' : 'var(--text2)',
              background: currentVerIdx === i ? 'var(--accent-bg)' : 'transparent',
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: i === 0 ? 'var(--accent)' : 'var(--border2)', flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.label}</span>
              {v.score != null && <span style={{ fontSize: 10, color: v.score >= 70 ? 'var(--green)' : 'var(--amber)' }}>{v.score}%</span>}
            </div>
          ))}
        </>}
      </div>

      {/* ── 메인 ── */}
      <div style={{ overflowY: 'auto', padding: '28px 32px', background: 'var(--bg)' }}>

        {/* 업로드 탭 */}
        {tab === 'upload' && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>이력서 업로드</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>PDF 또는 텍스트로 현재 이력서를 등록하세요.</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div
                onClick={() => document.getElementById('pdfInput')?.click()}
                onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
                onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)' }}
                onDrop={async e => {
                  e.preventDefault()
                  const f = e.dataTransfer.files[0]
                  if (f) handlePdf(f)
                }}
                style={{ border: '1.5px dashed var(--border2)', borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer', background: 'var(--bg2)' }}
              >
                <div style={{ fontSize: 28, marginBottom: 12 }}>📄</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>PDF 이력서 업로드</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>클릭하거나 드래그하세요</div>
                <input id="pdfInput" type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handlePdf(e.target.files[0]) }} />
              </div>
              <div className="card">
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>텍스트로 직접 입력</div>
                <textarea value={resumeText} onChange={e => setResumeText(e.target.value)} rows={10} placeholder="이력서 내용 붙여넣기..." style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
              </div>
            </div>

            {pdfStatus && <div style={{ fontSize: 12, color: pdfStatus.startsWith('✓') ? 'var(--green)' : 'var(--red)', marginBottom: 12, textAlign: 'center' }}>{pdfStatus}</div>}
            <button className="btn btn-primary" onClick={saveResume} disabled={uploadLoading} style={{ width: '100%', justifyContent: 'center' }}>
              이력서 저장 후 분석 시작 →
            </button>
          </div>
        )}

        {/* 분석 탭 */}
        {tab === 'analyze' && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>채용공고 분석</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>공고를 입력하면 내 이력서 기준으로 AI가 보완점·강화점을 분석합니다.</div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>회사명</label>
                  <input value={company} onChange={e => setCompany(e.target.value)} placeholder="카카오페이" style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>직무</label>
                  <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="백엔드 개발자" style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                </div>
              </div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>채용공고 전문</label>
              <textarea value={jobPosting} onChange={e => setJobPosting(e.target.value)} rows={10} placeholder="자격요건, 우대사항 등 공고 전문을 붙여넣으세요..." style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
            </div>

            <button className="btn btn-primary" onClick={runAnalysis} disabled={analyzing} style={{ width: '100%', justifyContent: 'center', marginBottom: 24 }}>
              {analyzing ? '분석 중...' : 'AI 이력서 분석 시작'}
            </button>

            {analyzing && (
              <div className="card" style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>⚙️</div>
                <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 12 }}>Claude AI가 분석 중입니다</div>
                {analysisSteps.map((s, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{s}</div>)}
              </div>
            )}

            {result && (
              <>
                {/* 점수 */}
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
                    <svg viewBox="0 0 80 80" width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="7" />
                      <circle cx="40" cy="40" r="34" fill="none" strokeWidth="7" strokeLinecap="round"
                        stroke={result.score >= 75 ? 'var(--green)' : result.score >= 50 ? 'var(--amber)' : 'var(--red)'}
                        strokeDasharray={`${2 * Math.PI * 34 * result.score / 100} ${2 * Math.PI * 34}`} />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>{result.score}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{result.scoreTitle}</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{result.scoreSub}</div>
                  </div>
                </div>

                {/* 키워드 */}
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>키워드 매칭</div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, marginBottom: 6 }}>✓ 보유</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{result.matchKeywords.map(k => <span key={k} className="pill-match">{k}</span>)}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, marginBottom: 6 }}>✗ 부족</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{result.missKeywords.map(k => <span key={k} className="pill-miss">{k}</span>)}</div>
                    </div>
                  </div>
                </div>

                {/* 분석 항목 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>세부 분석 ({result.items.length}개)</span>
                  <button className="btn btn-green btn-sm" onClick={applyAll}>모든 개선사항 적용 & 새 버전 저장</button>
                </div>

                {result.items.map((item, i) => {
                  const t = typeMap[item.type] || typeMap.add
                  return (
                    <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: t.bg, color: t.color, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '.05em' }}>{t.label}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{item.title}</div>
                          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginTop: 3 }}>{item.desc}</div>
                        </div>
                      </div>
                      {item.before && <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,.15)', borderRadius: 6, padding: '8px 12px', marginBottom: 6, fontSize: 12, color: 'var(--red)', fontFamily: 'monospace', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.before}</div>}
                      {item.after && <div style={{ background: 'var(--green-bg)', border: '1px solid rgba(74,222,128,.15)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--green)', fontFamily: 'monospace', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.after}</div>}
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {!appliedItems.has(i)
                          ? <button className="btn btn-green btn-sm" onClick={() => applyItem(item, i)} disabled={!item.after}>이 항목 적용</button>
                          : <span style={{ fontSize: 12, color: 'var(--green)' }}>✓ 적용됨</span>
                        }
                      </div>
                    </div>
                  )
                })}

                {/* 로드맵 */}
                <div style={{ background: 'var(--accent-bg)', border: '1px solid rgba(124,110,240,.2)', borderRadius: 12, padding: 20, marginTop: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent2)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>포트폴리오 로드맵</div>
                  {result.roadmap.map(r => (
                    <div key={r.step} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: 2 }}>{r.step}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{r.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{r.desc}</div>
                        <span style={{ display: 'inline-block', marginTop: 5, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: r.priority === 'urgent' ? 'var(--red-bg)' : 'var(--teal-bg)', color: r.priority === 'urgent' ? 'var(--red)' : 'var(--teal)' }}>
                          {r.duration} · {r.priority === 'urgent' ? '우선순위 높음' : '권장'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* 편집기 탭 */}
        {tab === 'editor' && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>이력서 편집기</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>현재 이력서를 직접 수정하거나 버전을 비교하세요.</div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg2)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
              {['편집', '버전 비교'].map((t, i) => (
                <button key={t} onClick={() => setDiffMode(i === 1)} style={{ flex: 1, padding: '7px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', background: diffMode === (i === 1) ? 'var(--bg4)' : 'transparent', color: diffMode === (i === 1) ? 'var(--text)' : 'var(--text2)' }}>{t}</button>
              ))}
            </div>

            {!diffMode ? (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', flex: 1 }}>{versions[currentVerIdx]?.label ?? '이력서'}</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => saveEdit(false)}>저장</button>
                  <button className="btn btn-green btn-sm" onClick={() => saveEdit(true)}>새 버전으로 저장</button>
                </div>
                <textarea value={editorContent} onChange={e => setEditorContent(e.target.value)} style={{ width: '100%', minHeight: 460, background: 'transparent', border: 'none', padding: 16, color: 'var(--text)', fontSize: 13, fontFamily: 'monospace', lineHeight: 1.7, outline: 'none', resize: 'vertical' }} />
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>비교 버전:</span>
                  <select value={compareIdx} onChange={e => setCompareIdx(Number(e.target.value))} style={{ background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                    {versions.map((v, i) => i !== currentVerIdx && <option key={v.id} value={i}>{v.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  {[versions[compareIdx], versions[currentVerIdx]].map((v, pi) => {
                    const other = pi === 0 ? versions[currentVerIdx] : versions[compareIdx]
                    const lines = (v?.content ?? '').split('\n')
                    const otherLines = (other?.content ?? '').split('\n')
                    return (
                      <div key={pi} style={{ background: 'var(--bg2)', padding: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
                          {pi === 0 ? '이전 버전' : '현재 버전'} — {v?.label}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8, fontFamily: 'monospace' }}>
                          {lines.map((l, i) => (
                            <div key={i} style={{ background: !otherLines.includes(l) ? (pi === 0 ? 'rgba(248,113,113,.08)' : 'rgba(74,222,128,.08)') : 'transparent', color: !otherLines.includes(l) ? (pi === 0 ? 'var(--red)' : 'var(--green)') : 'var(--text2)', textDecoration: pi === 0 && !otherLines.includes(l) ? 'line-through' : 'none' }}>
                              {l || '\u00a0'}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 히스토리 탭 */}
        {tab === 'history' && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>버전 기록</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>저장된 모든 이력서 버전을 확인하고 되돌릴 수 있습니다.</div>
            {versions.length === 0
              ? <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>아직 저장된 버전이 없습니다.</div>
              : <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {versions.map((v, i) => (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: i < versions.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', background: currentVerIdx === i ? 'var(--accent-bg)' : 'transparent' }}
                    onClick={() => { setCurrentVerIdx(i); setEditorContent(v.content); setTab('editor') }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: i === 0 ? 'var(--accent)' : 'var(--border2)', boxShadow: i === 0 ? '0 0 6px var(--accent)' : 'none' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{v.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{new Date(v.created_at).toLocaleString('ko-KR')}</div>
                    </div>
                    {v.score != null && <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: v.score >= 70 ? 'var(--green-bg)' : 'var(--amber-bg)', color: v.score >= 70 ? 'var(--green)' : 'var(--amber)' }}>{v.score}%</span>}
                    <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); setCurrentVerIdx(i); setEditorContent(v.content); setTab('editor') }}>불러오기</button>
                  </div>
                ))}
              </div>
            }
          </div>
        )}
      </div>
    </div>
  )
}
