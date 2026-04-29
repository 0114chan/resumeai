// lib/types.ts

export interface ResumeVersion {
  id: string
  user_id: string
  label: string
  content: string
  score: number | null
  job_company: string | null
  job_title: string | null
  created_at: string
}

export interface Analysis {
  id: string
  user_id: string
  resume_ver_id: string | null
  job_company: string | null
  job_title: string | null
  job_posting: string
  score: number
  result_json: AnalysisResult
  created_at: string
}

export interface AnalysisResult {
  score: number
  scoreTitle: string
  scoreSub: string
  matchKeywords: string[]
  missKeywords: string[]
  items: AnalysisItem[]
  roadmap: RoadmapItem[]
}

export interface AnalysisItem {
  type: 'strength' | 'weak' | 'add' | 'portfolio' | 'keyword'
  title: string
  desc: string
  before: string
  after: string
}

export interface RoadmapItem {
  step: number
  title: string
  desc: string
  duration: string
  priority: 'urgent' | 'normal'
}
