<div align="center">

# 🍱 Yami (야미 - 급식평론가)

<p align="center">
  <strong>"오늘 급식은 몇 점일까?" — AI가 매일 매기는 우리 학교 급식 점수 & 스마트 식단 매니저</strong>
</p>

<p align="center">
  <a href="https://github.com/gitzzang11/yami/releases/latest">
    <img src="https://img.shields.io/github/v/release/gitzzang11/yami?style=for-the-badge&color=0ea5e9&label=Release" alt="Latest Release" />
  </a>
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Capacitor-8.4-119EFF?style=for-the-badge&logo=capacitor&logoColor=white" alt="Capacitor" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Gemini" />
</p>

<p align="center">
  <a href="#-주요-기능">주요 기능</a> •
  <a href="#-기술-스택">기술 스택</a> •
  <a href="#-시작하기">시작하기</a> •
  <a href="#-ai-급식-평가--ai-studio-동기화">AI 급식 평가</a> •
  <a href="#-android-앱-설치--빌드">Android 빌드</a> •
  <a href="#-프로젝트-구조">프로젝트 구조</a>
</p>

---

</div>

## 📖 프로젝트 소개

**Yami**는 교육부 NEIS(나이스) 오픈 API를 통해 전국 초·중·고등학교의 급식 식단을 불러오고, **Google Gemini AI**가 전문 셰프 및 학생 관점에서 메뉴를 다면 평가해 주는 모바일 퍼스트 하이브리드 앱(PWA & Android)입니다.

단순한 메뉴 조회를 넘어, **AI 비평가 페르소나**, **개인 맞춤형 선호도 가중치**, **월간 식단 랭킹 분석**, **매일 아침 자동 급식 알림**까지 올인원으로 제공합니다.

---

## ✨ 주요 기능

### 🍱 1. 스마트 급식 식단 조회 & 오프라인 캐싱
- **NEIS 오픈 API 실시간 연동**: 학교 검색 및 자동 저장, 일별/주간/월간 캘린더 식단 제공
- **알레르기 & 영양 성분 정보**: 메뉴별 알레르기 유발 물질 정제 및 칼로리/영양 상세 확인
- **오프라인 우선 (Dexie IndexedDB)**: 인터넷 연결이 없거나 불안정한 환경에서도 마지막 조회 급식 즉시 표시

### 🤖 2. Gemini AI 급식 다면 평가 & 비평
- **학교급별 맞춤 페르소나**: 초등학생(친근/순수), 중학생(트렌디/단짠), 고등학생(든든함/솔직함) 맞춤 비평 생성
- **6대 핵심 평가 기준**: 맛과 조화(30점), 트렌드(25점), 영양 균형(15점), 다양성(10점), 완성도(10점), 특별성(10점)
- **개인 맞춤 커스텀 기준**: "디저트 포함", "고기 반찬 우선" 등 원하는 기준을 추가하고 가중치(0.1~2.0) 직접 조절

### 🔄 3. Google AI Studio 모델 실시간 동기화
- **실시간 모델 페칭**: Gemini API Key 입력 시 Google AI Studio에서 지원되는 최신 Gemini 모델 목록 자동 조회
- **원클릭 새로고침**: 신규 모델(Gemini 2.5 Flash, Gemini 3.5 Pro, Gemma 등) 출시 시 UI에서 즉시 갱신

### 📊 4. 식단 통계 & 월간 랭킹 리포트
- **급식 통계 시각화**: 최근 30일간의 AI 점수 추이 및 통계 요약 (Recharts 기반 반응형 차트)
- **월간 명예의 전당**: 이번 달 최고의 레전드 급식 TOP 3 및 아쉬운 급식 리포트

### ⏰ 5. 매일 아침 맞춤 급식 알림
- **Capacitor Local Notifications**: 매일 지정한 시간(기본 07:30)에 오늘 급식 메뉴와 AI 한줄평 요약 푸시 알림

### 🎨 6. 섬세한 모바일 UX & 테마 커스터마이징
- **iOS 글래스모피즘 디자인**: 부드러운 애니메이션(Framer Motion)과 네이티브 햅틱 감성의 UI
- **다크 모드 & 6색 테마**: 환경에 맞춘 다크모드 및 개인 취향 테마 컬러 지원

---

## 🛠 기술 스택

| 분류 | 기술 및 라이브러리 |
| :--- | :--- |
| **Framework** | [Next.js 16 (App Router)](https://nextjs.org/), [React 19](https://react.dev/) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/), [Lucide Icons](https://lucide.dev/) |
| **UI Components** | [Radix UI Primitives](https://www.radix-ui.com/), [shadcn/ui-inspired components] |
| **Mobile Runtime**| [Capacitor 8](https://capacitorjs.com/) (Android Bridge & Local Notifications) |
| **State & DB** | [Zustand](https://zustand-demo.pmnd.rs/), [Dexie.js](https://dexie.org/) (IndexedDB Wrapper) |
| **Data & Charts** | [Recharts](https://recharts.org/), [Date-fns](https://date-fns.org/) |
| **AI & APIs** | [Google Gemini API](https://ai.google.dev/) (Generative Language API), [NEIS Open API](https://open.neis.go.kr/) |

---

## ⚡ 빠른 시작

### 1. 필수 요구사항
- Node.js 20.x 이상
- npm 또는 pnpm

### 2. 저장소 클론 및 패키지 설치
```bash
# 저장소 클론
git clone https://github.com/gitzzang11/yami.git
cd yami

# 의존성 설치
npm install
```

### 3. 로컬 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:3000`으로 접속합니다.

### 4. 프로덕션 빌드
```bash
npm run build
```

---

## 🤖 AI 급식 평가 & AI Studio 연동

1. **Google AI Studio API Key 발급**:
   - [Google AI Studio](https://aistudio.google.com/)에서 무료 API 키를 생성합니다.
2. **앱 설정에서 등록**:
   - 앱 우측 상단의 **설정(⚙️)** 탭으로 이동합니다.
   - **Gemini API Key** 입력란에 키를 붙여넣습니다.
3. **모델 목록 자동 연동**:
   - 키 입력 후 포커스를 벗어나면 지원되는 최신 Gemini 모델 목록(`gemini-2.5-flash`, `gemini-3.5-pro` 등)이 자동으로 갱신됩니다.
   - 언제든 **`목록 새로고침`** 버튼을 눌러 최신 모델로 동기화할 수 있습니다.

> 💡 **참고**: NEIS API 키를 입력하지 않아도 기본 샘플 키로 전국 학교 급식 조회가 정상 동작합니다.

---

## 📲 Android 앱 설치 & 빌드

### 📥 릴리스 APK 직접 다운로드
최신 버전의 APK는 [GitHub Releases](https://github.com/gitzzang11/yami/releases/latest)에서 바로 다운로드하여 Android 기기에 설치할 수 있습니다.

### 🔨 직접 빌드하기
Android Studio와 JDK(Java 17 이상)가 설치된 환경에서 다음 명령어로 디버그 APK를 빌드할 수 있습니다:

```bash
# 웹 에셋 빌드 + Capacitor 동기화 + Gradle 빌드
npm run apk:debug
```

빌드 완료 시 프로젝트 루트에 `app-debug.apk` 파일이 생성됩니다.

---

## 📁 프로젝트 구조

```text
yami/
├── android/               # Capacitor Android 네이티브 프로젝트
├── src/
│   ├── app/               # Next.js App Router (Layout & Pages)
│   ├── components/        # 재사용 가능한 공통 UI 컴포넌트
│   ├── db/                # Dexie IndexedDB 스키마 및 캐시 관리
│   ├── features/          # 도메인별 기능 컴포넌트
│   │   ├── calendar/      # 월간 급식 캘린더
│   │   ├── home/          # 오늘 급식 대시보드 & AI 평가 카드
│   │   ├── onboarding/    # 학교 검색 & 초기 설정
│   │   ├── settings/      # API 키, 모델, 알림, 테마 설정
│   │   └── stats/         # AI 평가 통계 및 차트
│   ├── hooks/             # 커스텀 훅 (급식 데이터 페칭, 캐싱)
│   ├── services/          # 외부 API 연동 (Gemini, NEIS, Notifications)
│   ├── stores/            # Zustand 전역 상태 관리
│   └── types/             # TypeScript 타입 정의
├── package.json
└── README.md
```

---

## 📄 라이선스

This project is licensed under the [MIT License](LICENSE).

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/gitzzang11">gitzzang11</a></sub>
</div>

