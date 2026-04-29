/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse가 Node.js 내장 모듈 사용 — 서버에서만 실행되도록
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
    // serverExternalPackages: ['pdf-parse'],

  },
}

module.exports = nextConfig
