-- ============================================
-- ResumeAI — Supabase 스키마 및 RLS 설정
-- Supabase Dashboard → SQL Editor에 붙여넣고 실행
-- ============================================

-- 1. 이력서 버전 테이블
create table if not exists public.resume_versions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text not null,
  content     text not null,
  score       integer,
  job_company text,
  job_title   text,
  created_at  timestamptz not null default now()
);

-- 2. 분석 결과 테이블 (캐싱 + 기록용)
create table if not exists public.analyses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  resume_ver_id   uuid references public.resume_versions(id) on delete set null,
  job_company     text,
  job_title       text,
  job_posting     text not null,
  score           integer,
  result_json     jsonb not null,
  created_at      timestamptz not null default now()
);

-- 3. PDF 파일 메타 테이블 (실제 파일은 Storage)
create table if not exists public.uploaded_files (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  filename    text not null,
  created_at  timestamptz not null default now()
);

-- ============================================
-- Row Level Security (사용자는 자기 데이터만 접근)
-- ============================================
alter table public.resume_versions enable row level security;
alter table public.analyses enable row level security;
alter table public.uploaded_files enable row level security;

-- resume_versions RLS
create policy "own_resume_versions" on public.resume_versions
  for all using (auth.uid() = user_id);

-- analyses RLS
create policy "own_analyses" on public.analyses
  for all using (auth.uid() = user_id);

-- uploaded_files RLS
create policy "own_files" on public.uploaded_files
  for all using (auth.uid() = user_id);

-- ============================================
-- Storage 버킷 생성 (PDF 업로드용)
-- ============================================
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict do nothing;

create policy "own_resume_files" on storage.objects
  for all using (
    bucket_id = 'resumes' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
