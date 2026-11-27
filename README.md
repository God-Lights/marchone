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
5. Google 지도(선택): Actions **Secrets** `GOOGLE_MAPS_SERVER_KEY`(Routes API 전용 키), Actions **Variables** `GOOGLE_MAPS_BROWSER_KEY`(Maps JavaScript API, 웹사이트 제한 키). 없으면 직선 거리 + SVG 지도로 동작.

## Google 지도
- **Routes API(서버)**: 육로 구간(도보·자전거·버스·기차)의 실제 길 거리·경로. KV에 30일 캐시, 실패 시 직선. 출발 시점의 거리를 D1에 고정해 진행 중 위치가 튀지 않음.
- **Maps JavaScript API(브라우저)**: 여정 지도와 Street View(없는 곳은 위성). 키는 `GET /api/config`로 전달.
- 로컬 테스트: `.dev.vars`에 `GOOGLE_ROUTES_ENDPOINT`로 Routes API 주소를 바꿀 수 있음.

## 인증
- **GL Account (주 로그인)** — `*.officialgl.com` 쿠키 방식. GL이 발급한 `gl_session`(Domain=.officialgl.com)을
  서버에서 `POST {GL_ACCOUNT_ORIGIN}/api/internal/verify-session`으로 검증(Worker 시크릿 `GL_ACCOUNT_KEY`, 30초 캐시).
  - 로그인은 사용자가 버튼을 눌러야만 시작: `GET /auth/login` → `https://account.officialgl.com/?return=https%3A%2F%2Fmarchone.officialgl.com%2F`.
    페이지 열기·401·로그아웃으로 자동 이동하지 않음.
  - 사용자 식별은 GL `user.id`만 사용(`gl_link` 테이블로 MarchOne 계정과 1:1 연결). 이 기기의 게스트/패스키 계정이 있으면 첫 GL 로그인 때 그 계정과 여정을 이어받음.
  - `POST /auth/logout`: MarchOne에서만 로그아웃(GL 로그인 상태는 그대로). `mo_gl_off` 쿠키로 다시 로그인 버튼을 누를 때까지 `gl_session`을 무시.
  - GL 쿠키는 모든 `*.officialgl.com`에 전송되므로, 상태를 바꾸는 API는 우리 Origin에서 온 요청만 허용.
- **게스트 / 패스키** — Better Auth(D1). 로그인 없이 시작(버튼), 기존 패스키 사용자 로그인 유지.
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
