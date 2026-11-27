# MarchOne

행진으로 세계일주 — 키우기 힐링 게임. 설계: [CONCEPT.md](CONCEPT.md)

- Live: https://marchone.officialgl.com
- Stack: Cloudflare Workers (Hono) + Static Assets (React PWA) · D1 · KV · R2 · Workers AI

## 개발
```bash
npm install
npm run dev            # Vite + Worker (로컬 D1/KV/R2 시뮬레이션)
npm run db:migrate:local
npm test               # packages/engine 단위 테스트
npm run typecheck
```

## 구조
```
src/worker/        Hono API, cron
src/web/           React PWA
packages/engine/   이동·시간·식사창 순수 TS (worker·web 공용)
migrations/        D1 마이그레이션
data/              카탈로그 시드 JSON
```

## 배포 (GitHub Actions)
`main` 푸시 → `.github/workflows/deploy.yml` → 타입체크/테스트/빌드 → `wrangler deploy` → D1 마이그레이션.
브랜치/PR은 `ci.yml`만 실행.

필요한 설정(1회):
1. GitHub → Settings → Secrets and variables → Actions
   - `CLOUDFLARE_API_TOKEN` (권한: Workers Scripts:Edit, D1:Edit, Workers KV Storage:Edit, Workers R2 Storage:Edit, Workers AI:Read, Zone:Read, DNS:Edit, Workers Routes:Edit — 대상: officialgl.com 존)
   - `CLOUDFLARE_ACCOUNT_ID`
2. `officialgl.com`이 같은 Cloudflare 계정의 존이어야 함 (커스텀 도메인 `marchone.officialgl.com`은 배포 시 자동 생성).
3. (선택) GitHub Environment `production` 생성 후 승인 규칙 추가.
4. 시크릿: `npx wrangler secret put GOOGLE_MAPS_SERVER_KEY`
