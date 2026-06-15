# 배포 가이드

> 단일 서버 + Docker Compose 운영 구성. 구성 요소: DB(PostgreSQL) + API(수집·조회 + in-process worker) + 대시보드(nginx 정적 + `/api` 프록시).

## 1. 사전 준비

- Docker / Docker Compose 설치된 단일 서버
- 외부 도메인 + HTTPS (아래 8장 참고 — Compose는 80 포트로 노출, TLS 종단은 외부 프록시 권장)

## 2. 환경변수

```sh
cp infra/.env.prod.example infra/.env
# infra/.env 편집 — POSTGRES_PASSWORD, SESSION_SECRET, ADMIN_PASSWORD 반드시 변경
```

`SESSION_SECRET`은 `openssl rand -hex 32` 등으로 무작위 생성.

## 3. 기동

```sh
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
```

- API는 기동 시 마이그레이션을 자동 적용한다(`db:migrate && start`).
- `db` 헬스체크 통과 후 `api`가 뜨고, 그 다음 `dashboard`(80포트)가 뜬다.

## 4. 최초 관리자 계정 생성

seed 스크립트로 admin 계정 + 예시 프로젝트를 만든다(최초 1회):

```sh
docker compose -f infra/docker-compose.yml exec api pnpm seed
```

출력된 DSN / secret_key를 SDK·소스맵 업로드에 사용.

## 5. 동작 확인

```sh
curl http://<서버>/healthz        # {"ok":true}
```

브라우저에서 `http://<서버>/` → 로그인(admin 계정).

## 6. 백업

DB 볼륨 `errortracking_db-data`. 정기 백업:

```sh
docker compose -f infra/docker-compose.yml exec -T db \
  pg_dump -U errortracking errortracking | gzip > backup-$(date +%F).sql.gz
```

복원:

```sh
gunzip -c backup-YYYY-MM-DD.sql.gz | \
  docker compose -f infra/docker-compose.yml exec -T db psql -U errortracking errortracking
```

cron 예시(매일 03:00): `0 3 * * * cd /path/to/repo && docker compose ... pg_dump ...`

## 7. 보관 기간 정리

API가 6시간마다 자동으로 보관 기간(기본 90일) 경과 이벤트를 삭제한다(in-process).
외부 cron으로 돌리려면:

```sh
docker compose -f infra/docker-compose.yml exec api pnpm retention
```

- `EVENT_RETENTION_DAYS`(기본 90), `ARTIFACT_RETENTION_DAYS`로 조정.
- **issues(이슈 요약)는 영구 보존**, events 원본만 삭제.

## 8. HTTPS / 리버스 프록시

DSN과 보안 쿠키(`COOKIE_SECURE=true`)는 HTTPS 전제다. 운영에서는:

- 서버 앞단에 TLS 종단 프록시(Caddy/Traefik/nginx 또는 클라우드 LB)를 두고 `dashboard:80`으로 전달, 또는
- `infra/nginx.conf`에 TLS 설정 추가 + 인증서 마운트.

`X-Forwarded-Proto`가 전달되어야 보안 쿠키가 올바로 동작한다(nginx.conf에 설정됨).

## 9. 업데이트 / 롤백

```sh
git pull
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
```

마이그레이션은 기동 시 자동 적용. 롤백은 이전 커밋으로 체크아웃 후 재빌드(파괴적 마이그레이션은 별도 다운 마이그레이션 필요 — 현재 전부 additive).

## 10. 로그

```sh
docker compose -f infra/docker-compose.yml logs -f api
```

운영에서는 Docker 로그 드라이버에 `max-size`/`max-file`을 설정해 로테이션할 것(daemon.json 또는 서비스 `logging:`).
