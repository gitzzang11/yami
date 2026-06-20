# 급식평론가

학생이 매일 급식을 확인하고 Gemini AI가 급식을 평가하는 모바일 퍼스트 웹앱입니다.

## 기술 스택

- Next.js App Router, TypeScript, Tailwind CSS
- shadcn/ui 스타일 Radix 컴포넌트
- Framer Motion, Zustand, Dexie IndexedDB
- NEIS Open API, Gemini API
- PWA, Capacitor Android, Local Notifications
- Lucide React, Recharts

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 빌드

```bash
npm run lint
npm run build
```

정적 산출물은 `out/`에 생성됩니다.

## API Key

- 설정 화면에서 Gemini API Key를 입력해야 AI 평가가 동작합니다.
- NEIS API Key는 선택 사항입니다. 비워두면 NEIS 샘플 키로 조회합니다.

## Android APK 생성

Android Studio와 JDK가 설치된 환경에서 실행합니다.

```bash
npm run cap:sync
cd android
.\gradlew assembleDebug
```

생성 위치:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

릴리스 APK/AAB는 Android Studio에서 `Build > Generate Signed Bundle / APK`를 사용합니다.

## 주요 기능

- 학교 검색 및 저장
- 오늘, 내일, 주간 급식 조회
- IndexedDB 급식 및 AI 평가 캐싱
- 오프라인 시 마지막 조회 급식 표시
- Gemini JSON 기반 급식 평가 및 파싱 실패 대응
- 커스텀 평가 기준 추가, 수정, 삭제, 비활성화, 가중치 설정
- Capacitor Local Notifications 기반 급식 알림
- Gemini 모델, 다크모드, 테마 색상, 캐시 삭제, 학교 변경 설정
- 최근 30일 AI 평가 통계와 월간 랭킹
- PWA 매니페스트와 서비스워커 캐싱
