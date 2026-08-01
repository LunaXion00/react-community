import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Header from "../components/Header.jsx";
import CommentSection from "../components/post-detail/CommentSection.jsx";
import PostArticle from "../components/post-detail/PostArticle.jsx";
import ReportModal from "../components/post-detail/ReportModal.jsx";
import { getRequestErrorMessage } from "../components/post-detail/postDetailUtils.js";
import { getCommentList } from "../services/commentApi.js";
import { deletePost, getPostDetail, likePost, unlikePost } from "../services/postApi.js";
import { getLoginUser, requireLogin } from "../utils/auth.js";

const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
const EMPTY_SET = new Set();

export default function PostDetailPage({
  pendingCommentIds = EMPTY_SET,
  detailCommentsRefreshRequest = null,
  onCommentsRefreshSuccess,
  onCommentsRefreshComplete,
}) {
  const navigate = useNavigate();
  const { postId } = useParams();
  const loginUserRef = useRef(undefined);
  const currentVisit = useMemo(
    () => ({ postId }),
    [postId],
  );
  const currentVisitRef = useRef(null);
  const commentRequestSequenceRef = useRef(0);

  if (loginUserRef.current === undefined) {
    loginUserRef.current = getLoginUser();
  }

  const currentUserNickname = (
    loginUserRef.current.nickname
  );
  const [postDetailState, setPostDetailState] = (
    useState({
      visit: null,
      data: null,
    })
  );
  const [commentsState, setCommentsState] = (
    useState({
      visit: null,
      data: null,
    })
  );
  const [pageMessageState, setPageMessageState] = (
    useState({
      visit: null,
      message: "",
    })
  );
  const [isLikePending, setIsLikePending] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [ isReportModalOpen, setIsReportModalOpen ] = useState(false);
  const initializationRef = useRef({
    visit: undefined,
    postRequest: undefined,
    commentRequest: undefined,
    commentRequestSequence: undefined,
    commentPendingSnapshot: null,
  });
  const isMountedRef = useRef(false);
  const likeLockRef = useRef(false);
  const postDeleteLockRef = useRef(false);
  const pendingCommentIdsRef = useRef(pendingCommentIds);
  const refreshSuccessRef = useRef(onCommentsRefreshSuccess);
  const refreshCompleteRef = useRef(onCommentsRefreshComplete);
  const refreshCommentsRef = useRef(null);
  const handledRefreshNonceRef = useRef(null);
  const commentsRefreshLockRef = useRef(false);
  const [isRefreshingComments, setIsRefreshingComments] = (
    useState(false)
  );

  pendingCommentIdsRef.current = pendingCommentIds;
  refreshSuccessRef.current = onCommentsRefreshSuccess;
  refreshCompleteRef.current = onCommentsRefreshComplete;

  const postDetail = (
    postDetailState.visit === currentVisit
      ? postDetailState.data
      : null
  );
  const comments = (
    commentsState.visit === currentVisit
      ? commentsState.data
      : null
  );
  const pageMessage = (
    pageMessageState.visit === currentVisit
      ? pageMessageState.message
      : ""
  );

  useLayoutEffect(() => {
    currentVisitRef.current = currentVisit;
    commentRequestSequenceRef.current += 1;

    return () => {
      if (currentVisitRef.current === currentVisit) {
        currentVisitRef.current = null;
        commentRequestSequenceRef.current += 1;
      }
    };
  }, [currentVisit]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    document.title = "게시글 상세";

    if (
      initializationRef.current.visit !==
      currentVisit
    ) {
      initializationRef.current = {
        visit: currentVisit,
        postRequest: undefined,
        commentRequest: undefined,
        commentRequestSequence: undefined,
        commentPendingSnapshot: null,
      };
    }

    const initialization = (
      initializationRef.current
    );

    if (initialization.postRequest === undefined) {
      const accessToken = requireLogin(navigate);

      if (!accessToken) {
        initialization.postRequest = null;
        return undefined;
      }

      if (!postId) {
        initialization.postRequest = null;
        window.alert("게시글 ID가 없습니다.");
        navigate("/posts");
        return undefined;
      }

      if (!POSITIVE_INTEGER_PATTERN.test(postId)) {
        initialization.postRequest = null;
        navigate("/posts");
        return undefined;
      }

      setPostDetailState({
        visit: currentVisit,
        data: null,
      });
      setCommentsState({
        visit: currentVisit,
        data: null,
      });
      setPageMessageState({
        visit: currentVisit,
        message: "",
      });
      setIsLikePending(false);
      setIsDeletingPost(false);
      setIsReportModalOpen(false);
      likeLockRef.current = false;
      postDeleteLockRef.current = false;
      initialization.postRequest = getPostDetail({
        postId,
      });
    }

    if (initialization.postRequest === null) {
      return undefined;
    }

    let isActive = true;

    async function loadPostAndComments() {
      let postResult;

      try {
        postResult = await (
          initialization.postRequest
        );
      } catch (error) {
        if (
          isActive &&
          isCurrentRequest(currentVisit)
        ) {
          setPageMessageState({
            visit: currentVisit,
            message: getRequestErrorMessage(error),
          });
        }

        return;
      }

      if (
        !isActive ||
        !isCurrentRequest(currentVisit)
      ) {
        return;
      }

      setPostDetailState({
        visit: currentVisit,
        data: postResult.data,
      });

      try {
        if (
          initialization.commentRequest ===
          undefined
        ) {
          initialization.commentPendingSnapshot = (
            new Set(pendingCommentIdsRef.current)
          );
          initialization.commentRequest = (
            getCommentList({
              postId,
            })
          );
          initialization.commentRequestSequence = (
            ++commentRequestSequenceRef.current
          );
        }

        const commentResult = await (
          initialization.commentRequest
        );

        if (
          isActive &&
          isCurrentRequest(currentVisit) &&
          initialization.commentRequestSequence ===
            commentRequestSequenceRef.current
        ) {
          applyCommentsResult(
            currentVisit,
            commentResult.data,
          );
          refreshSuccessRef.current?.(
            postId,
            initialization.commentPendingSnapshot,
          );
        }
      } catch (error) {
        if (
          isActive &&
          isCurrentRequest(currentVisit) &&
          initialization.commentRequestSequence ===
            commentRequestSequenceRef.current
        ) {
          setPageMessageState({
            visit: currentVisit,
            message: getRequestErrorMessage(error),
          });
        }
      }
    }

    loadPostAndComments();

    return () => {
      isActive = false;
    };
  }, [currentVisit, navigate, postId]);

  async function reloadComments({
    pendingSnapshot = null,
  } = {}) {
    const requestVisit = currentVisit;
    const requestSequence = (
      ++commentRequestSequenceRef.current
    );
    let result;

    try {
      result = await getCommentList({
        postId: requestVisit.postId,
      });
    } catch (error) {
      if (!isCurrentRequest(requestVisit)) {
        return false;
      }

      if (
        requestSequence !==
        commentRequestSequenceRef.current
      ) {
        return true;
      }

      throw error;
    }

    if (!isCurrentRequest(requestVisit)) {
      return false;
    }

    if (
      requestSequence !==
      commentRequestSequenceRef.current
    ) {
      return true;
    }

    applyCommentsResult(requestVisit, result.data);
    refreshSuccessRef.current?.(
      requestVisit.postId,
      pendingSnapshot,
    );
    return true;
  }

  function applyCommentsResult(requestVisit, nextComments) {
    setPostDetailState((previous) => {
      if (
        previous.visit !== requestVisit ||
        !previous.data
      ) {
        return previous;
      }

      return {
        ...previous,
        data: {
          ...previous.data,
          meta: {
            ...(previous.data.meta || {}),
            comments: Array.isArray(nextComments)
              ? nextComments.length
              : 0,
          },
        },
      };
    });

    setCommentsState({
      visit: requestVisit,
      data: nextComments,
    });
  }

  async function refreshComments(pendingSnapshot) {
    if (commentsRefreshLockRef.current) {
      return false;
    }

    commentsRefreshLockRef.current = true;
    const requestVisit = currentVisit;

    if (isCurrentRequest(requestVisit)) {
      setIsRefreshingComments(true);
      setCurrentPageMessage("");
    }

    try {
      return await reloadComments({
        pendingSnapshot,
      });
    } catch (error) {
      if (isCurrentRequest(requestVisit)) {
        setCurrentPageMessage(
          getRequestErrorMessage(error),
        );
      }

      return false;
    } finally {
      commentsRefreshLockRef.current = false;

      if (isCurrentRequest(requestVisit)) {
        setIsRefreshingComments(false);
      }
    }
  }

  refreshCommentsRef.current = refreshComments;

  useEffect(() => {
    const refreshRequest = detailCommentsRefreshRequest;

    if (
      !refreshRequest ||
      refreshRequest.postId !== Number(postId) ||
      refreshRequest.nonce === handledRefreshNonceRef.current
    ) {
      return;
    }

    handledRefreshNonceRef.current = refreshRequest.nonce;

    async function runRefresh() {
      try {
        await refreshCommentsRef.current?.(
          new Set(refreshRequest.snapshot || []),
        );
      } finally {
        refreshCompleteRef.current?.(refreshRequest.nonce);
      }
    }

    void runRefresh();
  }, [detailCommentsRefreshRequest, postId]);

  async function handleLike() {
    if (likeLockRef.current || !postDetail) {
      return;
    }

    likeLockRef.current = true;
    const requestVisit = currentVisit;
    setIsLikePending(true);
    setPageMessageState({
      visit: requestVisit,
      message: "",
    });

    try {
      const result = postDetail.meta?.liked
        ? await unlikePost({
            postId: requestVisit.postId,
          })
        : await likePost({
            postId: requestVisit.postId,
          });

      if (!isCurrentRequest(requestVisit)) {
        return;
      }

      setPostDetailState((previous) => {
        if (
          previous.visit !== requestVisit ||
          !previous.data
        ) {
          return previous;
        }

        return {
          ...previous,
          data: {
            ...previous.data,
            meta: {
              ...(previous.data.meta || {}),
              likes: result.data.likes,
              liked: result.data.liked,
            },
          },
        };
      });
    } catch (error) {
      if (isCurrentRequest(requestVisit)) {
        setPageMessageState({
          visit: requestVisit,
          message: getRequestErrorMessage(error),
        });
      }
    } finally {
      if (isCurrentRequest(requestVisit)) {
        setIsLikePending(false);
        likeLockRef.current = false;
      }
    }
  }

  async function handleDeletePost() {
    if (postDeleteLockRef.current) {
      return;
    }

    const confirmed = window.confirm(
      "게시글을 삭제하시겠습니까?",
    );

    if (!confirmed) {
      return;
    }

    postDeleteLockRef.current = true;
    const requestVisit = currentVisit;
    setIsDeletingPost(true);
    setPageMessageState({
      visit: requestVisit,
      message: "",
    });

    try {
      const result = await deletePost({
        postId: requestVisit.postId,
      });

      if (!isCurrentRequest(requestVisit)) {
        return;
      }

      window.alert(
        result?.message ||
        "게시글이 삭제되었습니다.",
      );
      navigate("/posts");
    } catch (error) {
      if (isCurrentRequest(requestVisit)) {
        setPageMessageState({
          visit: requestVisit,
          message: getRequestErrorMessage(error),
        });
      }
    } finally {
      if (isCurrentRequest(requestVisit)) {
        setIsDeletingPost(false);
        postDeleteLockRef.current = false;
      }
    }
  }

  function isCurrentRequest(requestVisit) {
    return (
      isMountedRef.current &&
      currentVisitRef.current === requestVisit
    );
  }

  function setCurrentPageMessage(message) {
    if (isCurrentRequest(currentVisit)) {
      setPageMessageState({
        visit: currentVisit,
        message,
      });
    }
  }

  function handleRefreshComments() {
    void refreshComments(
      new Set(pendingCommentIdsRef.current),
    );
  }

  const isCurrentPostDetail = Boolean(
    postDetail &&
    String(postDetail.post?.postId ?? "") === postId,
  );

  return (
    <>
      <Header />

      <main className="post-detail-page">
        {isCurrentPostDetail ? (
          <>
            <PostArticle
              postDetail={postDetail}
              currentUserNickname={
                currentUserNickname
              }
              isLikePending={isLikePending}
              isDeletingPost={isDeletingPost}
              onLike={handleLike}
              onModify={() => {
                navigate(`/posts/${postId}/modify`);
              }}
              onDelete={handleDeletePost}
              onReport={() => {
                setIsReportModalOpen(true);
              }}
            />

            <CommentSection
              key={postId}
              comments={comments}
              commentCount={
                postDetail.meta?.comments
              }
              currentUserNickname={
                currentUserNickname
              }
              postId={postId}
              pageMessage={pageMessage}
              pendingCommentCount={pendingCommentIds.size}
              isRefreshingComments={
                isRefreshingComments
              }
              isRequestCurrent={() => (
                isCurrentRequest(currentVisit)
              )}
              onPageMessage={
                setCurrentPageMessage
              }
              onReloadComments={reloadComments}
              onRefreshComments={
                handleRefreshComments
              }
            />
          </>
        ) : (
          <p
            id="message"
            className={
              pageMessage
                ? "message error"
                : "message"
            }
          >
            {pageMessage}
          </p>
        )}
      </main>

      <ReportModal
        key={postId}
        isOpen={
          isCurrentPostDetail &&
          isReportModalOpen
        }
        postId={postId}
        isRequestCurrent={() => (
          isCurrentRequest(currentVisit)
        )}
        onOpenChange={setIsReportModalOpen}
      />
    </>
  );
}
