# ResumeAI — 채용공고 맞춤 이력서 AI 비서

채용공고(텍스트/PDF)를 분석해 내 이력서의 보완점·강화점을 AI가 제시하고, 클릭 한 번으로 이력서를 자동 업데이트하며 버전으로 저장하는 실서비스 수준의 앱입니다.

## 아키텍처

```
브라우저 (Next.js)
    ↕ HTTPS
API Route (Next.js 서버) ← Claude API 호출은 여기서만
    ↕
Supabase (Auth + PostgreSQL + Storage)
```

**Claude API 키는 절대 프론트엔드에 노출되지 않습니다.**

## 기능

- **PDF/텍스트 이력서 업로드** — 서버에서 PDF 파싱 후 저장
- **채용공고 AI 분석** — Claude Sonnet이 이력서 vs 공고 심층 비교
  - 적합도 점수 (0~100)
  - 매칭/부족 키워드 추출
  - 항목별 before/after 개선안
  - 포트폴리오 로드맵
- **개선사항 1클릭 적용** — 이력서 텍스트 자동 수정
- **버전 관리** — 공고별 최적화 이력서를 DB에 저장, 언제든 되돌리기
- **버전 비교 (diff)** — 두 버전의 변경사항 시각적 비교
- **다크/라이트 모드** — 설정 유지

## 시작하기

### 1. 사전 준비

- Node.js 18+
- [Supabase 계정](https://supabase.com) (무료)
- [Anthropic API 키](https://console.anthropic.com) (claude-sonnet)

### 2. 설치

```bash
git clone <your-repo>
cd resumeai
npm install
cp .env.local.example .env.local
```

### 3. Supabase 설정

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성
2. **SQL Editor**에서 `supabase/migrations/001_init.sql` 내용을 붙여넣고 실행
3. **Settings → API**에서 URL과 키 복사 → `.env.local`에 입력
4. **Authentication → Providers**에서 Google OAuth 활성화 (선택)

### 4. 환경변수 설정

`.env.local` 파일:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. 개발 서버 실행

```bash
npm run dev
# → http://localhost:3000
```

## Vercel 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel --prod
```

**Vercel Dashboard → Settings → Environment Variables**에서 `.env.local`의 모든 변수를 동일하게 추가하세요.

## Railway 배포 (대안)

```bash
# railway.app에서 프로젝트 생성 후
railway link
railway up
```

환경변수는 Railway 대시보드 → Variables에서 추가.

## 프로젝트 구조

```
resumeai/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts          # Claude API 호출 (서버 전용)
│   │   ├── upload-pdf/route.ts       # PDF 파싱 (서버 전용)
│   │   └── resume-versions/route.ts  # 버전 CRUD
│   ├── auth/callback/route.ts        # OAuth 콜백
│   ├── dashboard/page.tsx            # 메인 앱 UI
│   ├── login/page.tsx                # 로그인
│   └── globals.css                   # 다크/라이트 테마
├── components/
│   └── ThemeToggle.tsx
├── lib/
│   ├── claude.ts                     # Anthropic SDK (서버 전용)
│   ├── types.ts                      # TypeScript 타입
│   └── supabase/
│       ├── server.ts                 # 서버용 Supabase 클라이언트
│       └── client.ts                 # 브라우저용 Supabase 클라이언트
├── middleware.ts                     # 인증 보호 미들웨어
└── supabase/migrations/001_init.sql  # DB 스키마
```

## 비용 예측

| 항목 | 비용 |
|------|------|
| Vercel 호스팅 | 무료 (월 100GB 대역폭) |
| Supabase DB | 무료 (500MB, 50,000 MAU) |
| Claude API (분석 1회) | 약 ₩15~30 |
| 100명 × 월 5회 분석 | 약 ₩7,500~15,000 |

## 향후 확장 아이디어

- [ ] 유료 플랜 (Stripe 연동) — 월 9,900원 무제한
- [ ] 분석 결과 캐싱 (같은 공고 재분석 방지)
- [ ] 자소서 초안 자동 생성
- [ ] 여러 공고 비교 대시보드
- [ ] 팀 플랜 (여러 사람이 함께 쓰는 버전)
