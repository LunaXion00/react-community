# Community React project context

현재 checkout의 실제 React 코드와 연결된 계약을 빠르게 찾기 위한 탐색 지도다.
세부 구현보다 진입점·책임·파일 경로를 안내한다.

## 프로젝트 개요와 진입점

- `package.json`: Vite 실행·빌드·lint 스크립트와 설치 dependency.
- `src/main.jsx`: React `StrictMode`, `BrowserRouter` 1회 연결, `App` 렌더링, 전역 CSS 진입점.
- `src/App.jsx`: `useLocation`, `useRealtime`, 전체 `Routes`와 페이지별 realtime props 연결.
- `vite.config.js`: 개발 서버 `5500`, `strictPort: true`, `/api`를 로컬 backend로 proxy.
- `Dockerfile`, `nginx.conf`: 정적 빌드 제공과 SPA fallback, API/SSE reverse proxy.

## Route → page 지도

- `/`는 `/login`으로 redirect.
- `/login` → `src/pages/LoginPage.jsx`.
- `/signup` → `src/pages/SignupPage.jsx`.
- `/posts` → `src/pages/PostListPage.jsx`; query `page`는 1-based UI 값.
- `/posts/create` → `src/pages/PostCreatePage.jsx`.
- `/posts/:postId` → `src/pages/PostDetailPage.jsx`.
- `/posts/:postId/modify` → `src/pages/PostModifyPage.jsx`.
- `/modify-info` → `src/pages/InfoModifyPage.jsx`.
- `/modify-password` → `src/pages/PwModifyPage.jsx`.
- 나머지 경로는 `/login`으로 redirect.

## 공통 기반

- `src/apiClient.js`: JSON body·응답 파싱·Bearer header·HTTP 오류 생성. `auth: true` 401은 공통 인증 만료 처리를 호출한다.
- `src/utils/auth.js`: `token` 파싱·저장, access token/login user 조회, 로그인 필요 redirect, 인증 만료 이동, refresh coordinator.
- `src/hooks/useForm.js`: 비제어 form 등록·검증·submit lock·오류·값 설정·reset.
- `src/components/Header.jsx`: 사용자 메뉴, 계정 페이지 이동, logout 후 인증 정보 정리.
- `src/utils/format.js`: 날짜·수량 표시.
- `src/utils/validation.js`: 이메일·비밀번호·비밀번호 확인·닉네임 규칙.
- `src/constants/reportReason.js`: 게시글 신고 사유 상수·라벨.

## Domain service 지도

- `src/services/authApi.js`: login/refresh/logout 인증 API.
- `src/services/userApi.js`: signup, 사용자 정보·비밀번호 수정, 탈퇴.
- `src/services/postApi.js`: 게시글 생성·목록·상세·수정·삭제, 좋아요, 신고.
- `src/services/commentApi.js`: 댓글 목록·생성·수정·삭제; 대댓글은 `parentCommentId`를 전송.
- `src/services/draftApi.js`: 임시저장 조회·생성·수정·발행·삭제.
- `src/services/realtimeApi.js`: fetch 기반 SSE 연결/parser와 관심사 PATCH.

## 현재 페이지 기능 요약

- `LoginPage`: `auth:false` 로그인, field validation/error, 성공 시 localStorage 저장 후 `/posts` 이동.
- `SignupPage`: 가입 validation, 프로필 이미지 preview, 중복 이메일/닉네임 helper, 가입 성공 후 로그인 이동.
- `PostListPage`: 페이지 번호 query 정규화·목록 조회·shape 검증·loading/empty/error 상태·제한된 pagination·SSE 새 게시글 refresh.
- `PostCreatePage`: 로그인 확인, 임시저장 발견 modal, 명시적 불러오기, draft 저장/수정/삭제/발행.
- `PostDetailPage`: 게시글 상세·조회·좋아요·신고·삭제·수정 이동, 댓글 조회/재조회와 stale 응답 보호.
- `PostModifyPage`: 상세 조회 후 `author.userId` 소유자 판정, 게시글 수정.
- `InfoModifyPage`: 닉네임·프로필 이미지 수정과 탈퇴.
- `PwModifyPage`: 비밀번호 validation과 변경.
- `src/components/post-detail/`: 게시글 본문, 재귀 댓글 트리·대댓글 form, 신고 modal, 댓글 tree 안전성 담당.
- `CommentSection.jsx`는 일반 댓글과 대댓글의 독립 `useForm` 인스턴스, 재조회, refresh 알림을 소유한다.
- `CommentTreeItem.jsx`는 tree item을 재귀 렌더링하고 활성 답글 form을 댓글 아래에 배치한다.
- `CommentItem.jsx`는 댓글 표시·수정·삭제를 담당하며 삭제 댓글의 답글 버튼을 숨긴다.
- `ReportModal.jsx`는 신고 사유·상세 form과 409 중복 신고 helper를 담당한다.

## 인증·storage·401·작성자 계약

- Token storage key는 `token`; frontend 저장 구조는 `grantType`, `accessToken`이다. refresh token은 HttpOnly cookie 계약이다.
- 사용자 storage keys는 `userId`, `nickname`, `profileImageUrl`이다.
- `getToken()`은 호출마다 localStorage를 읽고 잘못된 JSON/구조를 제거한다. module cache는 없다.
- `auth:false` login/signup 401은 각 페이지 helper/error 흐름을 유지한다.
- 인증 요청 401 중 `access_token_expired`는 단일 refresh 후 원 요청을 한 번 재시도한다. invalid/unauthorized와 refresh missing/invalid는 정리 후 `/login`으로 이동한다.
- `session_unavailable`, network, 403은 자동 logout하지 않는다. refresh token은 JS/localStorage가 아닌 HttpOnly cookie다.
- token 저장·삭제는 `community-auth-change` custom event를 발행해 같은 탭 realtime도 감지한다.
- 게시글·댓글 소유자 판정은 `author.userId`와 local userId가 둘 다 있을 때 `String` 비교한다. nickname fallback은 없고 nickname은 표시용이다.
- 실제 수정·삭제 권한은 backend가 최종 검증한다.

## Realtime 계약

- `src/hooks/useRealtime.js`가 앱 탭당 fetch-SSE 연결 하나, auth signature, stream cleanup/reconnect, route interest, pending 상태를 소유한다.
- 정확한 `/posts`는 `POST_LIST`; 양의 정수 `/posts/:postId`는 `POST_DETAIL`; 나머지는 `NONE`이다. query page만 바뀌면 stream을 재연결하지 않는다.
- `src/services/realtimeApi.js`는 `Authorization: Bearer`, `Accept: text/event-stream`, split chunk/CRLF/multiline data/comment 처리를 담당한다.
- 새 connection마다 현재 interest와 단조 증가 frontend revision을 PATCH한다. interest 등록 실패는 해당 stream 종료·재연결 경로를 사용한다.
- SSE 401 `access_token_expired`는 refresh coordinator를 한 번 공유하고 stream 연결을 한 번 재시도한다. invalid/unauthorized와 refresh missing/invalid는 공통 인증 종료를 사용한다.
- `session-replaced`는 현재 stream에서만 reconnect를 막고 abort한다. alert 확인 후 token이 그대로면 best-effort logout·정리·`/login` 이동을 수행한다. alert 대기 중 다른 token이 저장되면 새 session을 보존하고 stream만 종료한다.
- stream event에는 연결 당시 token을 붙여 stale stream이 현재 token과 다르면 popup·logout·storage clear 없이 해당 stream만 종료한다.
- `post-created`는 `Set<postId>`, `comment-created`는 `Map<postId, Set<commentId>>`로 중복 제거한다. payload는 invalidation hint다.
- 목록·댓글 버튼은 기존 REST service 재조회만 실행한다. 시작 snapshot ID만 성공 후 제거하고 요청 중 도착한 ID는 유지한다.
- 재연결 후 현재 목록 또는 댓글을 한 번 REST 동기화한다. `App.jsx`는 hook 결과와 page props 연결만 담당한다.
- 목록 재조회는 현재 page를 유지하며 새 게시글 버튼은 필요 시 page 1로 이동한 뒤 목록만 fresh 조회한다.
- 댓글 재조회는 `getCommentList()`를 사용하고 `getPostDetail()`를 다시 호출하지 않는다.
- 댓글 작성·대댓글 작성 성공 후 재조회와 댓글 수 동기화는 `PostDetailPage` 공통 reload 경로를 따른다.
- `nginx.conf`의 `/api/realtime/stream` location은 HTTP/1.1, buffering/cache off, 긴 read timeout으로 SSE를 전달한다.

## Backend 계약 확인 경로

- SSE controller/service/interest: `backend/src/main/java/com/example/community/realtime/`.
- 게시글 API: `backend/src/main/java/com/example/community/post/controller/PostController.java`.
- 댓글 API: `backend/src/main/java/com/example/community/comment/controller/CommentController.java`.
- 사용자 API: `backend/src/main/java/com/example/community/user/controller/UserController.java`.
- 임시저장 API: `backend/src/main/java/com/example/community/post/draft/controller/PostDraftController.java`.
- 응답 DTO와 작성자 필드: `backend/src/main/java/com/example/community/global/dto/`, `post/dto/`, `comment/dto/`.
- 계약 확인 테스트: `backend/src/test/java/com/example/community/` 아래 realtime·post·comment·user 테스트.
- backend·Vanilla frontend는 읽기 전용이다. 계약이 불명확하면 해당 controller/DTO/test를 먼저 확인한다.
- 게시글 목록 backend page는 0-based이며 화면 query는 1-based로 변환한다. page size와 total metadata는 응답을 따른다.
- 댓글 응답에는 직접 부모를 가리키는 `parentCommentId`가 있으며 frontend tree가 orphan·cycle·depth를 방어한다.
- draft 응답의 version/updatedAt은 같은 탭에서 처리한 draft key 판단에 사용되므로 복원 modal 흐름을 확인할 때 함께 읽는다.

## 의도적으로 보류된 사항

- `PostDetailPage`의 `postId` key remount 및 `currentVisit` 단순화는 보류한다. 현재 request sequence/stale 보호를 임의 제거하지 않는다.
- refresh token 재발급, `AuthContext`/Provider, 전역 상태 라이브러리, replay/ACK/Redis는 범위 밖이다.
- 모바일 mock 검증은 하지 않는다. 반응형 제품 CSS는 보존한다.
- backend의 권한 검증과 데이터 정렬·삭제 제외는 frontend에서 재구현하지 않는다.
- 실제 배포 compose의 별도 Nginx bind mount가 이미지 설정을 덮을 수 있으므로 배포 저장소는 별도 확인 대상이다.

## 문서 갱신 조건

- route/page 책임, service endpoint 소비, storage key, auth/401, owner 판정, realtime interest/pending/refresh 동작이 실제 코드와 달라지면 해당 절을 갱신한다.
- 변경이 작업 규칙·구조 불변식·검증 방식 자체를 바꿀 때만 `AGENTS.md`를 갱신한다.
- `specs/final`은 최초 마이그레이션 기준이다. 최신 사용자 결정·backend 계약·현재 React 코드가 우선한다.
