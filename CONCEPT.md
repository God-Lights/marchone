# MarchOne — 행진으로 세계일주

> 실시간으로 걷고, 현지 시간에 현지 음식을 먹고, 현지 돈으로 장 보는 힐링 세계일주 시뮬레이터.

## 1. 한 줄 정의
유저가 짠 루트대로 **실시간·로컬타임**으로 천천히 이동하며, 환전·쇼핑·식사·거리 풍경을 통해 세계를 체험하는 앱. 실패/경쟁/압박 없음.

## 2. 핵심 루프
```
루트 설계 → 출발 → (앱 꺼도) 실시간 이동 → 도착/통과 시 이벤트
  → 환전 → 현지 식사(하루 2회+) → 특산품 구매 → 일기/엽서 → 다음 구간
```

## 3. 기능 설계

### 3.1 루트 (Route)
- 루트 = 순서 있는 **구간(Leg)** 리스트. 구간 = `{출발지, 도착지, 이동수단, 페이스}`.
- 지정 단위: 나라 / 도시 / 지역(주·도·산맥 등) 어디든 가능. 세분화 수준은 유저 자유.
- 이동수단: 도보(기본·"행진") / 자전거 / 버스 / 기차 / 배 / 비행기 / 히치하이킹 등.
- 템플릿 루트 제공(예: 실크로드, 산티아고, 환태평양, 남극 제외 6대륙) + 완전 커스텀.
- 구간 추가·삭제·순서변경·수단변경 언제든 가능(미래 구간만).

### 3.2 실시간 이동 엔진
- 위치는 **저장하지 않고 계산**(공용 TS 패키지 → 클라이언트 애니메이션·Worker 알림 스케줄링에서 동일 로직 사용): `position = f(startedAt, route, now)`. 앱을 꺼도 진행되고, 서버 틱 불필요.
- 속도(기본값): 도보 5km/h · 자전거 15 · 버스 50 · 기차 90 · 배 30 · 비행기 800 km/h.
- 현실감: 도보/자전거는 **하루 이동시간 상한**(기본 8h, 현지 08–18시) → 밤엔 숙박(비용 발생, 힐링 연출).
- 이동 경로: 육상은 Google Directions, 해상/항공은 대권(great-circle) 보간.
- 시간 배율 옵션: 1x(기본, 실시간) / 커스텀 가속. 기본은 실시간 유지.
- 현지 시각: 현재 좌표 → IANA 타임존(`geo-tz`) → 표시. 해 뜸/해 짐 계산해 UI 테마 연동.

### 3.3 돈·환전·물가
- 시작 자금: 유저가 가상 금액·기준통화 설정(예: ₩10,000,000).
- 국경 통과 → 현지 통화 환전 필요. 실제 환율(일 1회 캐시, Frankfurter/ER API) + 환전 수수료 옵션(현실 모드).
- 물가 체험: 국가별 **물가 지수**(생수·커피·식사·숙박·교통 기준 바스켓)로 모든 가격 산정. 환전 직후 "이 돈으로 살 수 있는 것" 비교 카드.
- 지출: 식사, 숙박, 교통(도보 제외), 특산품. 잔액 0이어도 게임오버 없음 → "노숙 힐링 모드"로 계속(저예산 경험).
- 소득 옵션: 거리 공연/버스킹, 일일 노동 미니이벤트(선택).

### 3.4 특산품·수집
- 지역별 특산품 카탈로그(이름, 사진, 유래, 현지 가격, 한국 대비 가격).
- 구매 → **내 가방/방**에 전시. 지역별 도감 완성도 표시.
- 선물하기(친구/가족 공유 링크) — 후순위.

### 3.5 Google Maps 연동
- 현재 위치: **Street View** 파노라마를 메인 화면 배경으로(브라우저에서 Maps JS API 직접 로드, 키는 리퍼러 제한)(없는 곳은 Places 사진/위성).
- 미니맵: 전체 루트 + 지나온 길 + 남은 길.
- 구간 진행 중 일정 거리마다 **"풍경 스냅"** 자동 수집 → 여행 앨범.
- 비용/약관 대응: 뷰 단위 캐싱 최소화(약관 준수), 호출 수 제한, 정지 시에만 고해상도.

### 3.6 식사 시스템 (하루 2회+)
- 현지 시간 기준 식사창: 아침 07–09 / 점심 12–14 / 저녁 18–21. **최소 2끼** 권장(강제 아님).
- 식사창 열리면 푸시: "지금 현지 시각 12:30, 오늘 점심은?".
- 현지 음식 3~5개 선택지: 가격(물가 반영), 사진, 유래·재료·먹는 법·식사 예절 → **문화 학습 카드**.
- 먹은 음식은 **미식 도감**에 기록, 같은 나라 요리 N종 달성 시 뱃지.
- 안 먹어도 페널티 없음. 대신 "에너지/기분" 수치가 천천히 내려가 이동 연출이 느려지는 정도(힐링 톤 유지).

### 3.7 커스터마이징
- 아바타(외형·장비·동행 동물), 앱 테마(시간·날씨 연동 / 고정), 이동 BGM·환경음(현지 소리).
- 페이스(느긋/보통/빠름), 식사 알림 on/off, 난이도(현실 모드 ↔ 편안 모드).
- 루트·구간·수단 자유 편집, 일기 템플릿, 엽서 꾸미기.

### 3.8 힐링 요소
- 실패 상태 없음, 랭킹 없음, 스트릭 압박 없음.
- 하루 한 번 **엽서**(그날 풍경 + 한 줄 일기 자동 초안).
- 야간 모드: 별 + 현지 밤 소리, 알림 자동 무음.
- 선택: 실제 걸음수(HealthKit/Google Fit) → 가상 이동 **보너스 속도**. 기본 off.

## 4. 화면 구조
1. **Home(Walk)** — Street View 배경, 현지 시각·날씨, 다음 이벤트, 잔액
2. **Map** — 전체 루트, 구간 편집
3. **Meal** — 식사 선택 + 문화 카드
4. **Market** — 환전 / 특산품 상점
5. **Journal** — 엽서·스냅·미식 도감·특산품 도감
6. **Settings** — 커스터마이징

## 5. 아키텍처 — Cloudflare Workers 전용

```
[PWA: React+Vite]  ──fetch──▶  [Worker: Hono API + Static Assets]
   Maps JS API(브라우저)            │  ├─ D1   (유저·루트·지출·식사·인벤토리)
   Web Push 구독                    │  ├─ KV   (환율·물가 캐시, 폴리라인 캐시)
                                    │  ├─ R2   (음식/특산품 이미지, 엽서)
                                    │  ├─ Workers AI (엽서 일기 초안)
                                    │  └─ Cron Triggers (환율 갱신, 알림 발송)
```

| 영역 | 선택 | 이유 |
|---|---|---|
| 런타임 | Cloudflare Workers 단일 Worker (API + 정적 에셋) | 배포 1개, 엣지 지연 최소 |
| 프레임워크 | Hono + TypeScript | Workers 표준 경량 라우터 |
| 프론트 | React + Vite → Workers Static Assets, **PWA** | 앱스토어 없이 설치·푸시(Web Push) |
| DB | D1 + Drizzle ORM | 관계형 데이터, 서버리스 |
| 캐시 | KV | 환율(일 1회), 물가표, Directions 결과 |
| 파일 | R2 | 카탈로그 이미지, 사용자 엽서 |
| 인증 | Better Auth (D1 어댑터, 이메일 매직링크 + 패스키) | Workers 호환 |
| 푸시 | Web Push(VAPID) — Worker에서 직접 발송 | 식사창 알림 |
| 스케줄 | Cron Trigger `*/5 * * * *` | `next_notify_at` 인덱스 스캔 후 발송 |
| 타임존 | `tz-lookup`(순수 JS, 경량) + `Intl.DateTimeFormat` | `geo-tz`는 번들 과대 → Workers 부적합 |
| 지도 | Maps JS API(Street View, 지도) / Directions는 Worker에서 호출·캐시 | 키 분리: 브라우저키(리퍼러 제한) vs 서버키(Secret) |
| AI | Workers AI | 엽서 일기 초안, 문화 카드 보강 |
| 환율 | Frankfurter → Cron으로 KV 갱신 | 무료, 일 1회 |
| 배포 | `wrangler` + GitHub Actions | |

**Durable Objects 미사용(MVP).** 이동 상태가 계산식이라 상태 서버가 필요 없음. 실시간 공유(친구 동행)를 넣을 때 도입.

### 알림 흐름
1. 구간/식사 변경 시 Worker가 "다음 식사창 시작 시각(UTC)" 계산 → `journey.next_notify_at` 저장.
2. Cron(5분)이 `next_notify_at <= now` 조회 → Web Push 발송 → 다음 시각 재계산.
3. 위치→타임존→현지 식사창 변환은 공용 엔진 함수.

### 저장소 구조
```
marchone/
├─ wrangler.jsonc
├─ src/worker/        # Hono 라우트, cron, push
├─ src/web/           # React PWA
├─ packages/engine/   # 이동·시간·식사창·물가 순수 TS (worker·web 공용)
├─ data/              # 음식·특산품·물가 시드 JSON
└─ migrations/        # D1 마이그레이션
```

## 6. 데이터 모델 (D1)
```
user(id, home_currency, settings_json)
journey(id, user_id, started_at, time_scale, status, next_notify_at)
leg(id, journey_id, seq, from_json, to_json, mode, pace, polyline_key, distance_m)
wallet(journey_id, currency, balance)
txn(id, journey_id, ts, type, currency, amount, ref_id)
meal(id, journey_id, ts_utc, local_ts, dish_id, price)
dish(id, country, name, story, etiquette, base_price, image_key)
product(id, region, name, story, base_price, image_key)
inventory(journey_id, product_id, qty, bought_at)
snapshot(id, journey_id, ts, lat, lng, note)      -- 이미지 저장 안 함, 좌표 재조회
push_sub(id, user_id, endpoint, keys_json)
```
- 이동 상태는 DB에 쓰지 않고 `started_at + leg[]`로 즉시 계산.
- 폴리라인은 KV(`poly:{hash(from,to,mode)}`)에 저장해 Directions 호출 최소화.
- 카탈로그(dish/product/물가)는 `data/*.json`을 시드로 D1에 마이그레이션.

## 7. API (Hono)
```
POST /api/journeys                 루트 생성/시작
GET  /api/journeys/:id/state       현재 위치·로컬시각·다음 이벤트 (엔진 계산)
PUT  /api/journeys/:id/legs        미래 구간 편집
POST /api/exchange                 환전
GET  /api/meals/options            현재 위치 기준 식사 선택지
POST /api/meals                    식사 기록(+문화 카드)
GET  /api/market                   특산품 목록(현지가)
POST /api/market/buy               구매
POST /api/journal/postcard         엽서 생성(Workers AI)
POST /api/push/subscribe           푸시 구독
```

## 8. MVP 범위 (6~8주)
- [ ] 레포 스캐폴딩: wrangler, Hono, Vite PWA, D1 마이그레이션
- [ ] `packages/engine`: 이동·로컬타임·식사창 + 단위테스트
- [ ] 루트 에디터(나라/도시, 도보·기차·비행기) + Directions 캐시
- [ ] 홈(Street View + 미니맵 + 로컬시각)
- [ ] 환전(Cron 환율) + 물가 10개국
- [ ] 식사 시스템 + Web Push 알림
- [ ] 특산품 구매·도감
- [ ] 엽서(Workers AI), 테마·페이스 커스터마이징

**이후:** 아바타·동행(Durable Objects), 걸음수 연동(PWA 한계로 네이티브 래퍼 검토), 소득 이벤트, 루트 공유, 지역 단위 세분 루트.

## 9. 리스크
| 리스크 | 대응 |
|---|---|
| Google Maps 비용·약관(Directions/Street View 캐싱 제한) | 폴리라인만 KV 캐시, 이미지 미저장, 일일 쿼터, 정지 시에만 고해상도 |
| Street View 미지원 지역(바다·사막·극지) | Places 사진 / 위성 / 일러스트 폴백 |
| iOS PWA 푸시 제약(홈 화면 추가 필요) | 온보딩에서 설치 안내, 이메일 알림 폴백 |
| 걸음수 연동 불가(PWA) | 후순위, 필요 시 Capacitor 래퍼 |
| Workers 번들/CPU 한도 | 순수 JS 라이브러리만, 무거운 계산은 사전 생성 JSON |
| 도보 지구 일주 ≈ 3년 | 시간 배율 옵션 + 수단 혼합 루트 권장 |
| 콘텐츠 제작량 | 시드 JSON + LLM 초안 후 검수 |
| 가격 정확도 | "체감용 지수"로 명시, 출처·기준일 표기 |

## 10. 확정한 설계 결정
1. **Cloudflare Workers 단일 배포**(Hono + Static Assets), 앱은 **PWA**.
2. 상태 서버 없음 — 이동은 계산식, 알림은 Cron + `next_notify_at`.
3. D1(관계 데이터) / KV(캐시) / R2(이미지) 역할 분리.
4. 기본 이동수단 도보, 하루 8시간 이동 + 숙박, 1x 실시간(가속은 옵션).
5. 실패 상태 없음 — 돈 0이어도 계속. 식사는 권장이지 강제 아님.
