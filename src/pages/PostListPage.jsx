import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import Header from "../components/Header.jsx";
import { getPostList } from "../services/postApi.js";
import { requireLogin } from "../utils/auth.js";
import { formatCount, formatDateTime } from "../utils/format.js";

const PAGE_QUERY_PATTERN = /^[1-9]\d*$/;
const INVALID_POST_LIST_MESSAGE = (
  "게시글 목록을 불러오지 못했습니다."
);

function parsePageQuery(pageQuery) {
  if (
    typeof pageQuery !== "string" ||
    !PAGE_QUERY_PATTERN.test(pageQuery)
  ) {
    return null;
  }

  const page = Number(pageQuery);

  return Number.isSafeInteger(page)
    ? page
    : null;
}

function getPostListData(result) {
  const data = result?.data;

  if (
    result === null ||
    typeof result !== "object" ||
    Array.isArray(result) ||
    data === null ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !Array.isArray(data.posts)
  ) {
    return null;
  }

  return data;
}

function getPaginationItems(
  currentPage,
  totalPages,
) {
  const pageNumbers = new Set([
    1,
    totalPages,
  ]);

  for (
    let page = currentPage - 2;
    page <= currentPage + 2;
    page += 1
  ) {
    if (page > 1 && page < totalPages) {
      pageNumbers.add(page);
    }
  }

  const sortedPages = [...pageNumbers]
    .sort((left, right) => left - right);
  const items = [];

  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1];

    if (
      previousPage !== undefined &&
      page - previousPage > 1
    ) {
      items.push(
        `ellipsis-${previousPage}-${page}`,
      );
    }

    items.push(page);
  });

  return items;
}

const EMPTY_SET = new Set();

function PostListItem({ item }) {
  const author = item.author || {};
  const post = item.post || {};
  const postId = post.postId ?? "";
  const title = post.title || "제목 없음";
  const nickname = author.nickname || "알 수 없음";
  const likeCount = Number(post.likes) || 0;
  const commentCount = Number(post.comments) || 0;
  const createdAt = post.createdAt || "";

  return (
    <article className="post-row">
      <Link
        className="post-row-link"
        to={`/posts/${postId}`}
      >
        <span className="post-like-cell">
          {likeCount > 0 ? (
            <span className="post-like-badge">
              ♥ {formatCount(likeCount)}
            </span>
          ) : null}
        </span>

        <span className="post-id-cell">
          {postId}
        </span>

        <span className="post-title-cell">
          <span className="post-title-text">
            {title}
          </span>
          {commentCount > 0 ? (
            <span className="post-comment-badge">
              [{formatCount(commentCount)}]
            </span>
          ) : null}
        </span>

        <span className="post-author-cell">
          {nickname}
        </span>

        <time
          className="post-time-cell"
          dateTime={createdAt}
        >
          {formatDateTime(createdAt)}
        </time>

        <span className="post-views-cell">
          {formatCount(post.views)}
        </span>
      </Link>
    </article>
  );
}

function PostPagination({
  currentPage,
  totalPages,
  onPageChange,
}) {
  if (totalPages <= 1) {
    return null;
  }

  const paginationItems = getPaginationItems(
    currentPage,
    totalPages,
  );

  return (
    <nav
      className="post-pagination"
      aria-label="게시글 페이지"
    >
      <button
        className="post-pagination-navigation"
        type="button"
        disabled={currentPage === 1}
        onClick={() => {
          onPageChange(currentPage - 1);
        }}
      >
        이전
      </button>

      {paginationItems.map((item) => (
        typeof item === "number" ? (
          <button
            key={item}
            className={
              item === currentPage
                ? "post-pagination-page is-active"
                : "post-pagination-page"
            }
            type="button"
            disabled={item === currentPage}
            aria-current={
              item === currentPage
                ? "page"
                : undefined
            }
            onClick={() => {
              onPageChange(item);
            }}
          >
            {item}
          </button>
        ) : (
          <span
            key={item}
            className="post-pagination-ellipsis"
            aria-hidden="true"
          >
            …
          </span>
        )
      ))}

      <button
        className="post-pagination-navigation"
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => {
          onPageChange(currentPage + 1);
        }}
      >
        다음
      </button>
    </nav>
  );
}

export default function PostListPage({
  pendingPostIds = EMPTY_SET,
  postListRefreshRequest = null,
  onPostListRefreshRequest,
  onPostListRefreshSuccess,
  onPostListRefreshComplete,
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [posts, setPosts] = useState(null);
  const [pageInfo, setPageInfo] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isRefreshingPosts, setIsRefreshingPosts] = useState(false);
  const postListRequestRef = useRef(undefined);
  const previousPageRef = useRef(null);
  const handledRefreshNonceRef = useRef(null);
  const redirectRefreshRef = useRef(null);
  const pendingPostIdsRef = useRef(pendingPostIds);
  const refreshSuccessRef = useRef(onPostListRefreshSuccess);
  const refreshCompleteRef = useRef(onPostListRefreshComplete);
  const pageQuery = searchParams.get("page");
  const currentPage = parsePageQuery(pageQuery);

  pendingPostIdsRef.current = pendingPostIds;
  refreshSuccessRef.current = onPostListRefreshSuccess;
  refreshCompleteRef.current = onPostListRefreshComplete;

  useEffect(() => {
    document.title = "게시글 목록";

    if (currentPage === null) {
      postListRequestRef.current = undefined;
      navigate("/posts?page=1", {
        replace: true,
      });
      return undefined;
    }

    const refreshRequest = (
      postListRefreshRequest &&
      postListRefreshRequest.nonce !==
        handledRefreshNonceRef.current &&
      (
        postListRefreshRequest.targetPage === null ||
        postListRefreshRequest.targetPage === currentPage
      )
        ? postListRefreshRequest
        : null
    );

    if (refreshRequest) {
      handledRefreshNonceRef.current = refreshRequest.nonce;
      postListRequestRef.current = undefined;
      setIsRefreshingPosts(true);
    }

    const apiPage = currentPage - 1;
    let requestInfo = postListRequestRef.current;
    const redirectRefresh = redirectRefreshRef.current;

    if (redirectRefresh) {
      redirectRefreshRef.current = null;
    }

    if (
      requestInfo === undefined ||
      requestInfo.page !== apiPage
    ) {
      const accessToken = requireLogin(navigate);

      if (!accessToken) {
        postListRequestRef.current = {
          page: apiPage,
          request: null,
        };
        if (refreshRequest || redirectRefresh) {
          refreshCompleteRef.current?.(
            refreshRequest?.nonce ||
            redirectRefresh?.nonce,
          );
          setIsRefreshingPosts(false);
        }
        return undefined;
      }

      setPosts(null);
      setErrorMessage("");
      requestInfo = {
        page: apiPage,
        request: getPostList({
          page: apiPage,
        }),
        pendingSnapshot: refreshRequest
          ? refreshRequest.snapshot
          : redirectRefresh?.snapshot ||
            new Set(pendingPostIdsRef.current),
        refreshNonce: refreshRequest?.nonce ||
          redirectRefresh?.nonce || null,
        isRefresh: Boolean(
          refreshRequest || redirectRefresh,
        ),
        completed: false,
      };
      postListRequestRef.current = requestInfo;
    }

    if (requestInfo.request === null) {
      return undefined;
    }

    let isActive = true;

    async function loadPosts() {
      try {
        const result = await requestInfo.request;

        if (
          !isActive ||
          postListRequestRef.current !== requestInfo
        ) {
          return;
        }

        if (requestInfo.completed) {
          return;
        }

        requestInfo.completed = true;

        const postListData = getPostListData(result);

        if (postListData === null) {
          setPosts(null);
          setPageInfo(null);
          setErrorMessage(INVALID_POST_LIST_MESSAGE);

          if (requestInfo.isRefresh) {
            refreshCompleteRef.current?.(
              requestInfo.refreshNonce,
            );
            setIsRefreshingPosts(false);
          }
          return;
        }

        const {
          posts: responsePosts,
          page,
          size,
          totalElements,
          totalPages,
        } = result.data;
        const nextPosts = Array.isArray(responsePosts)
          ? responsePosts
          : [];

        if (
          nextPosts.length === 0 &&
          totalPages > 0 &&
          currentPage > totalPages
        ) {
          if (requestInfo.isRefresh) {
            redirectRefreshRef.current = {
              snapshot: requestInfo.pendingSnapshot,
              nonce: requestInfo.refreshNonce,
            };
          }
          postListRequestRef.current = undefined;
          navigate(
            `/posts?page=${totalPages}`,
            {
              replace: true,
            },
          );
          return;
        }

        if (
          nextPosts.length === 0 &&
          totalPages === 0 &&
          currentPage !== 1
        ) {
          if (requestInfo.isRefresh) {
            redirectRefreshRef.current = {
              snapshot: requestInfo.pendingSnapshot,
              nonce: requestInfo.refreshNonce,
            };
          }
          postListRequestRef.current = undefined;
          navigate("/posts?page=1", {
            replace: true,
          });
          return;
        }

        setPosts(nextPosts);
        setPageInfo({
          page,
          size,
          totalElements,
          totalPages,
        });

        refreshSuccessRef.current?.(
          requestInfo.pendingSnapshot,
        );

        if (requestInfo.isRefresh) {
          refreshCompleteRef.current?.(
            requestInfo.refreshNonce,
          );
          setIsRefreshingPosts(false);
        }
      } catch (error) {
        if (
          isActive &&
          postListRequestRef.current === requestInfo
        ) {
          if (requestInfo.completed) {
            return;
          }

          requestInfo.completed = true;
          setPageInfo(null);
          setErrorMessage(error.message);

          if (requestInfo.isRefresh) {
            refreshCompleteRef.current?.(
              requestInfo.refreshNonce,
            );
            setIsRefreshingPosts(false);
          }
        }
      }
    }

    loadPosts();

    return () => {
      isActive = false;
    };
  }, [
    currentPage,
    navigate,
    postListRefreshRequest,
  ]);

  useEffect(() => {
    if (currentPage === null) {
      return;
    }

    if (
      previousPageRef.current !== null &&
      previousPageRef.current !== currentPage
    ) {
      document.querySelector("#postList")
        ?.scrollIntoView({
          block: "start",
        });
    }

    previousPageRef.current = currentPage;
  }, [currentPage]);

  function handlePageChange(nextPage) {
    if (
      pageInfo === null ||
      nextPage < 1 ||
      nextPage > pageInfo.totalPages ||
      nextPage === currentPage
    ) {
      return;
    }

    navigate(`/posts?page=${nextPage}`);
  }

  function handleRefreshPosts() {
    if (
      pendingPostIds.size === 0 ||
      isRefreshingPosts ||
      currentPage === null
    ) {
      return;
    }

    const snapshot = new Set(pendingPostIdsRef.current);

    setIsRefreshingPosts(true);
    onPostListRefreshRequest?.({
      snapshot,
      targetPage: 1,
    });

    if (currentPage !== 1) {
      navigate("/posts?page=1");
    }
  }

  const shouldShowEmptyState = (
    posts !== null &&
    posts.length === 0 &&
    pageInfo?.page === 0 &&
    pageInfo.totalElements === 0
  );
  const shouldShowPagination = (
    pageInfo !== null &&
    currentPage !== null &&
    currentPage <= pageInfo.totalPages
  );

  return (
    <>
      <Header />

      <main className="post-list-page">
        <h1>게시글 목록</h1>

        <button
          id="postWriteButton"
          type="button"
          onClick={() => {
            navigate("/posts/create");
          }}
        >
          게시글 작성
        </button>

        {pendingPostIds.size > 0 ? (
          <button
            className="realtime-refresh-button"
            type="button"
            disabled={isRefreshingPosts}
            onClick={handleRefreshPosts}
          >
            새 게시글 {pendingPostIds.size}개 보기
          </button>
        ) : null}

        <section id="postList">
          {posts !== null ? (
            <>
              <div className="post-list-header">
                <span>좋아요</span>
                <span>번호</span>
                <span>제목</span>
                <span>작성자</span>
                <span>작성시간</span>
                <span>조회수</span>
              </div>

              {posts.length > 0 ? (
                posts.map((item) => (
                  <PostListItem
                    key={item.post?.postId}
                    item={item}
                  />
                ))
              ) : shouldShowEmptyState ? (
                <p className="post-list-empty">
                  게시글이 없습니다.
                </p>
              ) : null}
            </>
          ) : errorMessage ? null : (
            <p className="post-list-loading">
              게시글을 불러오는 중입니다.
            </p>
          )}
        </section>

        {shouldShowPagination ? (
          <PostPagination
            currentPage={
              posts === null
                ? currentPage
                : pageInfo.page + 1
            }
            totalPages={pageInfo.totalPages}
            onPageChange={handlePageChange}
          />
        ) : null}

        <p id="message">
          {errorMessage}
        </p>
      </main>
    </>
  );
}
