import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import InfoModifyPage from "./pages/InfoModifyPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import PostCreatePage from "./pages/PostCreatePage.jsx";
import PostDetailPage from "./pages/PostDetailPage.jsx";
import PostListPage from "./pages/PostListPage.jsx";
import PostModifyPage from "./pages/PostModifyPage.jsx";
import PwModifyPage from "./pages/PwModifyPage.jsx";
import SignupPage from "./pages/SignupPage.jsx";
import useRealtime from "./hooks/useRealtime.js";

export default function App() {
  const location = useLocation();
  const {
    pendingPostIds,
    pendingCommentIds,
    postListRefreshRequest,
    detailCommentsRefreshRequest,
    onPostListRefreshRequest,
    onPostListRefreshSuccess,
    onPostListRefreshComplete,
    onCommentsRefreshSuccess,
    onCommentsRefreshComplete,
  } = useRealtime(location.pathname, location.search);

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />

      <Route
        path="/login"
        element={<LoginPage />}
      />

      <Route
        path="/signup"
        element={<SignupPage />}
      />

      <Route
        path="/posts"
        element={(
          <PostListPage
            pendingPostIds={pendingPostIds}
            postListRefreshRequest={postListRefreshRequest}
            onPostListRefreshRequest={
              onPostListRefreshRequest
            }
            onPostListRefreshSuccess={
              onPostListRefreshSuccess
            }
            onPostListRefreshComplete={
              onPostListRefreshComplete
            }
          />
        )}
      />

      <Route
        path="/posts/create"
        element={<PostCreatePage />}
      />

      <Route
        path="/posts/:postId"
        element={(
          <PostDetailPage
            pendingCommentIds={pendingCommentIds}
            detailCommentsRefreshRequest={
              detailCommentsRefreshRequest
            }
            onCommentsRefreshSuccess={
              onCommentsRefreshSuccess
            }
            onCommentsRefreshComplete={
              onCommentsRefreshComplete
            }
          />
        )}
      />

      <Route
        path="/posts/:postId/modify"
        element={<PostModifyPage />}
      />

      <Route
        path="/modify-info"
        element={<InfoModifyPage />}
      />

      <Route
        path="/modify-password"
        element={<PwModifyPage />}
      />

      <Route
        path="*"
        element={<Navigate to="/login" replace />}
      />
    </Routes>
  );
}
