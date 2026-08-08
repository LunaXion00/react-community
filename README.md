# Community Frontend

Vanilla JavaScript 커뮤니티 프론트엔드를 React로 마이그레이션한 SPA입니다.

## 주요 기능

- 회원가입·로그인·로그아웃
- Access Token 만료 시 자동 재발급
- 회원정보·비밀번호 수정, 회원 탈퇴
- 게시글 목록·상세·작성·수정·삭제
- 임시저장 글 불러오기·저장·발행
- 댓글·다단계 대댓글
- 좋아요·신고
- 프로필 이미지 URL 미리보기
- SSE 기반 새 게시글·댓글 알림
- 중복 로그인 감지와 기존 세션 안내

## 개발 방식

코드를 먼저 작성하기보다, 학습한 React·브라우저·HTTP 지식을 바탕으로 요구사항과 사용자 흐름을 먼저 정리한 뒤 AI를 활용해 구현했습니다.

- 요구사항을 route, 상태, API 계약, 예외 흐름으로 구체화
- 기존 UI와 backend 계약을 확인한 뒤 React 구조 설계
- AI가 작성한 코드도 실제 코드와 실행 결과를 기준으로 검토·수정
- 인증 만료, 중복 요청, 오래된 응답, SSE 재연결 같은 실패 흐름까지 요구사항에 포함
- lint, build, diff 검증으로 구현 결과 확인

## Route

```text
/              /login으로 redirect
/login
/signup
/posts?page=1
/posts/create
/posts/:postId
/posts/:postId/modify
/modify-info
/modify-password
그 외 경로      /login으로 redirect
```

## 폼 관리

공통 `useForm` Hook을 사용합니다.

- 일반 필드는 비제어 입력
- 실시간 UI가 필요한 필드는 controlled state
- `FormData`로 실제 form DOM의 제출 시점 값을 조회
- 필드별 검증·helper message
- `handleSubmit`이 검증과 중복 제출 잠금을 담당
- `setValue`, `reset`으로 값 제어
- 서버 field error와 form error 분리

## 인증 처리

- Access Token과 사용자 표시 정보는 localStorage에 저장
- Refresh Token은 JavaScript에서 접근할 수 없는 HttpOnly Cookie 사용
- 인증 API는 `authApi.js`에서 관리
- Access Token 만료 시 refresh 요청을 한 번만 실행
- 성공하면 실패했던 API 요청을 한 번 재시도
- Refresh 실패 또는 무효 세션이면 저장정보 제거 후 로그인 페이지 이동
- 지연된 이전 응답이 새 로그인 세션을 제거하지 않도록 token snapshot 비교

## 실시간 처리

`useRealtime`이 브라우저 탭당 SSE 연결 하나를 관리합니다.

- 게시글 목록에서는 `POST_LIST` 관심 상태 등록
- 게시글 상세에서는 `POST_DETAIL`과 `postId` 등록
- Authorization Header가 필요해 `EventSource` 대신 fetch stream 사용
- split chunk, CRLF, multiline data, heartbeat comment 파싱
- 게시글 ID는 `Set`, 댓글 ID는 `Map<postId, Set<commentId>>`로 중복 제거
- 알림 확인 시 기존 REST API로 해당 목록만 재조회
- 다른 환경 로그인 이벤트 수신 시 안내창 표시 후 로그인 페이지 이동

## 주요 구조

```text
src/
├── main.jsx             React 진입점, StrictMode, BrowserRouter, 전역 CSS
├── App.jsx              Routes와 useRealtime 결과를 페이지에 연결
├── apiClient.js         JSON 요청, Bearer header, HTTP error, 401 재시도
├── pages/               로그인·회원가입·게시글·계정 페이지
├── components/          Header, 게시글 상세, 댓글 트리, 신고 Modal
├── hooks/               useForm, useRealtime
├── services/            auth·user·post·comment·draft·realtime API 함수
├── utils/               인증, validation, 날짜·수량 포맷
├── constants/           신고 사유 상수
└── css/                 기존 UI 기반 스타일
```

페이지와 기능 컴포넌트는 endpoint를 직접 호출하지 않고 도메인별 service 함수를 사용합니다.


## 배포

1. Node.js에서 React production build 생성
2. Nginx가 정적 파일 제공
3. SPA 경로는 `index.html`로 fallback
4. `/api` 요청은 backend로 reverse proxy
5. SSE 요청은 buffering 없이 전달
6. GitHub Actions가 이미지를 ECR에 업로드

## 회고
AI를 활용해 코드를 생성한만큼, 원하는 결과를 얻기 위해 필요한 부분을 생각하고 이에 대한 명시를 해주는 것에 신경을 쓴 프로젝트였습니다. 백엔드와 연계되는 변경사항이 있다면 그 내용으로 인해 프론트엔드에서 어떤 부분을 변경해야하는지를 결정하고 변경사항에 필요한 구성요소들과 기능을 생각하며 새로운 요구사항을 작성하며 진행했습니다. 그럼에도 생성된 코드에 대해 기능적으로는 동작하지만, 신경쓰지 못한 문제점들이 추가적으로 발견되었고 이를 다시 보완하며 코드에 대한 이해를 넓히고자 했습니다.

## 관련 저장소

- Backend API: [KTB4_luna_BE](https://github.com/100-hours-a-week/KTB4_luna_BE)
- 기존 Vanilla frontend: [comm](https://github.com/LunaXion00/comm)