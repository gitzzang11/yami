<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# GitHub 배포 및 릴리스 필수 지침

사용자가 "깃헙 배포", "배포해줘", "GitHub 배포" 등의 명령을 요청했을 때 반드시 다음 절차를 따릅니다:
1. **GitHub Pages 배포 및 최신화**:
   - GitHub Pages 설정이 있으면 업데이트하고, 없으면 새로 구성하여 배포합니다.
2. **GitHub Release 동시 생성 및 업데이트**:
   - 코드 푸시/Pages 배포와 함께 반드시 `gh release create <tag>`를 통해 릴리스를 생성/업데이트하고 상세 릴리스 노트를 작성합니다.
3. **실행 파일/바이너리(APK, EXE 등) 필수 첨부**:
   - 모바일 프로젝트는 APK 파일(`app-debug.apk` 등), 데스크톱 프로젝트는 EXE/설치 파일을 반드시 빌드하여 릴리스 Asset으로 첨부(`gh release upload`)합니다.

