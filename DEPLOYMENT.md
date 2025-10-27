# 🚀 Visit App Ubuntu 배포 가이드

## 📋 현재 환경 정보
- **서버 포트**: 8070 (기존)
- **Nginx 설정**: `/etc/nginx/sites-enabled/flask_app`
- **앱 경로**: `/var/www/visitapp`
- **서비스 포트 구성**:
  - Visit App: 8070
  - Flask App: 5000
  - Dash App: 8060

---

## 🔄 Git 업데이트 및 배포 순서

### 1단계: 로컬에서 Git 커밋 & 푸시

```bash
# Windows 로컬에서
cd D:\visitapp\visitapp

# 변경사항 확인
git status

# 모든 변경사항 추가
git add .

# 커밋 (의미있는 메시지 작성)
git commit -m "feat: 이름 익명화 블러 애니메이션 및 모던 UI 업그레이드 추가

- SSE 엔드포인트 경로 수정 (/visit/api/sse)
- 이름 익명화 기능 구현 (정태훈 → 정xx)
- 블러 애니메이션 효과 추가
- 모던 UI 디자인 업그레이드 (그라디언트, 애니메이션)
- DB 경로 Windows/Linux 호환성 개선
- 모든 API 라우트 /visit prefix 통일"

# 원격 저장소로 푸시
git push origin main  # 또는 master
```

---

### 2단계: 서버 접속

```bash
# SSH로 서버 접속
ssh ubuntu@54.180.1.235

# 또는 키 파일 사용
ssh -i "your-key.pem" ubuntu@54.180.1.235
```

---

### 3단계: 기존 서비스 중지

```bash
# 현재 실행 중인 서비스 확인
sudo systemctl status visitapp
# 또는
ps aux | grep gunicorn | grep 8070

# 서비스 중지
sudo systemctl stop visitapp

# 프로세스가 남아있다면 강제 종료
sudo pkill -f "gunicorn.*8070"

# 확인
sudo netstat -ntlp | grep :8070
```

---

### 4단계: 코드 백업 (안전장치)

```bash
# 현재 버전 백업
cd /var/www
sudo cp -r visitapp visitapp_backup_$(date +%Y%m%d_%H%M%S)

# 백업 확인
ls -la visitapp_backup_*
```

---

### 5단계: Git Pull로 업데이트

```bash
# 앱 디렉토리로 이동
cd /var/www/visitapp

# 현재 브랜치 확인
git branch

# 원격 저장소 최신 정보 가져오기
sudo git fetch origin

# 로컬 변경사항이 있다면 임시 저장
sudo git stash

# 최신 코드로 업데이트
sudo git pull origin main  # 또는 master

# stash한 내용이 있다면 복원 (필요시)
# sudo git stash pop
```

---

### 6단계: 파일 권한 및 소유권 설정

```bash
# 파일 소유권 변경
sudo chown -R www-data:www-data /var/www/visitapp

# DB 파일 권한 설정 (중요!)
sudo chown www-data:www-data /var/www/visitapp/visitor_log.db
sudo chmod 664 /var/www/visitapp/visitor_log.db

# 권한 확인
ls -la /var/www/visitapp/*.db
ls -la /var/www/visitapp/*.py
```

---

### 7단계: Nginx 설정 업데이트 (중요!)

```bash
# Nginx 설정 파일 백업
sudo cp /etc/nginx/sites-enabled/flask_app /etc/nginx/sites-enabled/flask_app.backup

# Nginx 설정 수정
sudo nano /etc/nginx/sites-enabled/flask_app
```

**수정할 부분:**

```nginx
# 기존 (잘못된 설정)
location /visit/api/ {
    proxy_pass http://127.0.0.1:8070/api/;  # ❌ /api/로 잘못 프록시됨
    ...
}

# 수정 후 (올바른 설정)
location /visit/api/ {
    proxy_pass http://127.0.0.1:8070/visit/api/;  # ✅ /visit/api/로 프록시
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_redirect off;
}

# SSE 설정 (중요!)
location /visit/api/sse {
    proxy_pass http://127.0.0.1:8070/visit/api/sse;  # ✅ 수정
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    proxy_buffering off;  # 필수!
    proxy_cache off;      # 필수!
    proxy_read_timeout 86400;
    chunked_transfer_encoding on;
}
```

**Nginx 설정 테스트 및 재시작:**

```bash
# 설정 문법 검사
sudo nginx -t

# 성공하면 재시작
sudo systemctl reload nginx

# 또는 완전 재시작
sudo systemctl restart nginx

# 상태 확인
sudo systemctl status nginx
```

---

### 8단계: Python 가상환경 활성화 (필요시)

```bash
cd /var/www/visitapp

# 가상환경 활성화
source venv/bin/activate

# pip 업그레이드
pip install --upgrade pip

# requirements.txt가 있다면 설치/업데이트
pip install -r requirements.txt

# 특정 패키지만 업데이트 (필요시)
# pip install --upgrade flask flask-cors
```

---

### 9단계: 서비스 재시작

```bash
# Systemd 설정 리로드 (설정 변경시)
sudo systemctl daemon-reload

# 서비스 재시작
sudo systemctl restart visitapp

# 서비스 상태 확인
sudo systemctl status visitapp

# 포트 확인
sudo netstat -ntlp | grep :8070
sudo ss -ntlp | grep 8070
```

---

### 10단계: 로그 확인 및 모니터링

```bash
# 실시간 에러 로그 확인
sudo tail -f /var/log/visitapp/error.log

# 액세스 로그 확인
sudo tail -f /var/log/visitapp/access.log

# Nginx 에러 로그 확인
sudo tail -f /var/log/nginx/flask_app_error.log

# Systemd 로그 확인
sudo journalctl -u visitapp -f
```

---

### 11단계: 기능 테스트

#### A. 기본 연결 테스트
```bash
# 서버에서
curl http://localhost:8070/visit/

# 외부에서 (로컬 PC 브라우저)
http://54.180.1.235/visit/
```

#### B. API 테스트
```bash
# 업체 목록 조회
curl http://localhost:8070/visit/api/options/companies

# 현재 방문자 목록
curl http://localhost:8070/visit/api/current-visitors

# DB 테스트
curl http://localhost:8070/visit/api/db-test
```

#### C. SSE 연결 테스트
```bash
# SSE 연결 확인 (30초간 대기)
curl -N http://localhost:8070/visit/api/sse
```

#### D. 브라우저에서 확인
1. `http://54.180.1.235/visit/` 접속
2. ✅ 이름 익명화 작동 확인 (정xx 블러 효과)
3. ✅ 모던 UI 표시 확인 (그라디언트 헤더, 애니메이션)
4. ✅ 실시간 업데이트 확인 (방문자 등록 후 자동 반영)
5. ✅ 모든 기능 테스트 (등록, 퇴실, 검색, Excel 다운로드)

---

### 12단계: 문제 해결 (트러블슈팅)

#### 문제 1: 502 Bad Gateway
```bash
# 서비스가 실행 중인지 확인
sudo systemctl status visitapp

# 포트가 열려있는지 확인
sudo netstat -ntlp | grep 8070

# 재시작
sudo systemctl restart visitapp
```

#### 문제 2: 404 Not Found (API)
```bash
# Nginx 설정 확인
cat /etc/nginx/sites-enabled/flask_app | grep -A 5 "location /visit/api/"

# 로그 확인
sudo tail -50 /var/log/nginx/flask_app_error.log

# Nginx 재시작
sudo systemctl restart nginx
```

#### 문제 3: SSE 연결 안됨
```bash
# Nginx proxy_buffering 설정 확인
cat /etc/nginx/sites-enabled/flask_app | grep -A 3 "location /visit/api/sse"

# 반드시 있어야 할 설정:
# proxy_buffering off;
# proxy_cache off;
```

#### 문제 4: 이름 익명화 안보임
```bash
# 브라우저 캐시 강제 새로고침
# Ctrl + Shift + R (Windows/Linux)
# Cmd + Shift + R (Mac)

# 또는 서버에서 정적 파일 확인
ls -la /var/www/visitapp/static/
cat /var/www/visitapp/static/app.js | grep "anonymizeName"
```

#### 문제 5: DB 권한 에러
```bash
# 권한 확인
ls -la /var/www/visitapp/visitor_log.db

# 권한 수정
sudo chown www-data:www-data /var/www/visitapp/visitor_log.db
sudo chmod 664 /var/www/visitapp/visitor_log.db
```

---

### 13단계: 롤백 (문제 발생시)

```bash
# 서비스 중지
sudo systemctl stop visitapp

# 백업으로 복원
sudo rm -rf /var/www/visitapp
sudo cp -r /var/www/visitapp_backup_YYYYMMDD_HHMMSS /var/www/visitapp

# 권한 설정
sudo chown -R www-data:www-data /var/www/visitapp

# 서비스 재시작
sudo systemctl restart visitapp

# Nginx 설정도 롤백 (필요시)
sudo cp /etc/nginx/sites-enabled/flask_app.backup /etc/nginx/sites-enabled/flask_app
sudo systemctl restart nginx
```

---

## 📊 배포 체크리스트

### 배포 전
- [ ] 로컬에서 모든 기능 테스트 완료
- [ ] Git commit & push 완료
- [ ] 배포 시간 공지 (사용자가 있다면)

### 배포 중
- [ ] 현재 버전 백업 완료
- [ ] Git pull로 코드 업데이트
- [ ] 파일 권한 설정 (www-data:www-data)
- [ ] DB 파일 권한 설정 (664)
- [ ] Nginx 설정 업데이트 (`/visit/api/` → `http://127.0.0.1:8070/visit/api/`)
- [ ] Nginx 설정 테스트 (`sudo nginx -t`)
- [ ] 서비스 재시작

### 배포 후
- [ ] 서비스 상태 확인 (`systemctl status visitapp`)
- [ ] 포트 확인 (8070 리스닝)
- [ ] 로그 에러 없음 확인
- [ ] 브라우저에서 접속 확인
- [ ] 이름 익명화 작동 확인
- [ ] 모던 UI 표시 확인
- [ ] 실시간 업데이트 (SSE) 확인
- [ ] 모든 기능 테스트 완료

---

## 🔧 Nginx 설정 전체 (업데이트 버전)

```nginx
# /etc/nginx/sites-enabled/flask_app

server {
    listen 80;
    server_name 54.180.1.235;

    # 방문자 관리 앱 정적 파일
    location /visit/static/ {
        alias /var/www/visitapp/static/;
        include /etc/nginx/mime.types;
        default_type application/octet-stream;
        add_header X-Content-Type-Options nosniff;
        expires 30d;
        add_header Cache-Control "public, no-transform";
        try_files $uri $uri/ =404;
    }

    # 방문자 관리 앱 SSE (가장 먼저 - 가장 구체적)
    location /visit/api/sse {
        proxy_pass http://127.0.0.1:8070/visit/api/sse;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        proxy_buffering off;  # 필수!
        proxy_cache off;      # 필수!
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        chunked_transfer_encoding on;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 방문자 관리 앱 API
    location /visit/api/ {
        proxy_pass http://127.0.0.1:8070/visit/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }

    # 방문자 관리 앱 메인
    location /visit/ {
        proxy_pass http://127.0.0.1:8070/visit/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }

    # Flask App (5000 포트)
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Dash App (8060 포트)
    location /dash/ {
        proxy_pass http://127.0.0.1:8060/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /_dash-component-suites/ {
        proxy_pass http://127.0.0.1:8060/_dash-component-suites/;
    }

    location /_dash-layout {
        proxy_pass http://127.0.0.1:8060/_dash-layout;
    }

    location /_dash-update-component {
        proxy_pass http://127.0.0.1:8060/_dash-update-component;
    }

    location /_dash-dependencies {
        proxy_pass http://127.0.0.1:8060/_dash-dependencies;
    }

    location /_reload-hash {
        proxy_pass http://127.0.0.1:8060/_reload-hash;
    }

    # css
    location /assets/ {
        alias /home/ubuntu/TrainingApp/assets/;
    }

    # 로그 설정
    access_log /var/log/nginx/flask_app_access.log combined buffer=512k flush=1m;
    error_log /var/log/nginx/flask_app_error.log warn;

    # 보안 헤더
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # 에러 페이지
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

---

## 🎯 한 줄 명령어 (빠른 배포)

```bash
# 완전 자동화 배포 (주의: 프로덕션에서는 단계별로 하는 것 추천)
cd /var/www/visitapp && \
sudo systemctl stop visitapp && \
sudo git stash && \
sudo git pull origin main && \
sudo chown -R www-data:www-data /var/www/visitapp && \
sudo chmod 664 /var/www/visitapp/visitor_log.db && \
sudo systemctl restart visitapp && \
sudo systemctl status visitapp
```

---

## 📞 문의 및 지원

배포 중 문제가 발생하면:
1. 로그 확인: `sudo tail -f /var/log/visitapp/error.log`
2. 서비스 상태: `sudo systemctl status visitapp`
3. Nginx 로그: `sudo tail -f /var/log/nginx/flask_app_error.log`
4. 롤백: 위의 13단계 참조

---

**배포 성공 후 확인:**
- ✅ http://54.180.1.235/visit/ 접속
- ✅ 이름 익명화 (정xx 블러 효과)
- ✅ 모던 UI (그라디언트 헤더, 애니메이션)
- ✅ 실시간 업데이트 작동

**🎉 배포 완료!**
