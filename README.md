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
4. `BETTER_AUTH_SECRET`(32자 이상 랜덤 문자열)을 GitHub Actions 시크릿에 추가 → 배포 시 Worker 시크릿으로 함께 업로드됨
5. 시크릿: `npx wrangler secret put GOOGLE_MAPS_SERVER_KEY`

## 인증
Better Auth(D1) — **게스트(익명)로 바로 시작** → **패스키 등록**으로 계정 보존·다른 기기 로그인.
스키마 변경 시 `node --experimental-strip-types scripts/auth-schema.mjs`로 필요한 SQL을 출력해 새 마이그레이션에 반영.

## API
| 메서드 | 경로 | 설명 |
|---|---|---|
| * | `/api/auth/*` | Better Auth (익명 로그인, 패스키, 세션) |
| GET | `/api/me` | 내 계정 |
| GET | `/api/journeys/current` | 진행 중 여정 + 현재 상태(엔진 계산) |
| POST | `/api/journeys` | `{ route, travelerName? }`로 출발 |
| PUT | `/api/journeys/current/route` | 앞으로 갈 구간만 수정 |
| POST | `/api/journeys/current/abandon` | 여정 그만두기 |
