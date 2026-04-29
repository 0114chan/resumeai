// lib/claude.ts — 서버에서만 import. API 키 절대 노출 안 됨.
import Anthropic from '@anthropic-ai/sdk'
import type { AnalysisResult } from './types'

const client = new Anthropic()
// ANTHROPIC_API_KEY 환경변수를 SDK가 자동으로 읽음

const ANALYSIS_PROMPT = (resume: string, jobPosting: string) => `
당신은 10년 경력의 채용 전문가 AI입니다.
아래 이력서와 채용공고를 심층 분석하고, 반드시 JSON 형식으로만 응답하세요.
마크다운 코드블록(\`\`\`), 설명 텍스트 없이 순수 JSON만 출력하세요.

[이력서]
${resume}

[채용공고]
${jobPosting}

다음 JSON 구조로 정확히 응답:
{
  "score": 0~100 사이 정수 (전반적 적합도),
  "scoreTitle": "한 줄 평가 (20자 이내)",
  "scoreSub": "구체적 이유 2~3문장",
  "matchKeywords": ["공고 요구사항 중 이력서에서 확인된 기술/역량 키워드"],
  "missKeywords": ["공고 요구사항 중 이력서에 없거나 부족한 키워드"],
  "items": [
    {
      "type": "strength | weak | add | portfolio | keyword 중 하나",
      "title": "항목명 (15자 이내)",
      "desc": "구체적 설명 (2~3문장)",
      "before": "이력서의 현재 문장 그대로 (없으면 빈 문자열)",
      "after": "개선/추가할 구체적 문장 (없으면 빈 문자열)"
    }
  ],
  "roadmap": [
    {
      "step": 순서 정수,
      "title": "포트폴리오 또는 준비 항목 제목",
      "desc": "구체적 실행 방법 (2문장)",
      "duration": "예: 2주, 1개월",
      "priority": "urgent | normal 중 하나"
    }
  ]
}

규칙:
- items는 최소 6개, strength/weak/add/portfolio/keyword 유형 골고루 포함
- before는 이력서 원문 문장 그대로 복사 (없으면 "")
- after는 before보다 구체적이고 수치가 포함된 개선안
- roadmap은 최소 3개, 부족한 키워드 기반으로 실현 가능한 포트폴리오 제안
- 한국어로 작성
`

export async function analyzeResume(
  resume: string,
  jobPosting: string
): Promise<AnalysisResult> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: ANALYSIS_PROMPT(resume, jobPosting),
      },
    ],
  })

  const raw = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')

  // JSON 파싱 (코드블록 감싼 경우 대비)
  const clean = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(clean) as AnalysisResult
}
