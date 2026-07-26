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

export default function PostListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [posts, setPosts] = useState(null);
  const [pageInfo, setPageInfo] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const postListRequestRef = useRef(undefined);
  const previousPageRef = useRef(null);
  const pageQuery = searchParams.get("page");
  const currentPage = parsePageQuery(pageQuery);

  useEffect(() => {
    document.title = "게시글 목록";

    if (currentPage === null) {
      postListRequestRef.current = undefined;
      navigate("/posts?page=1", {
        replace: true,
      });
      return undefined;
    }

    const apiPage = currentPage - 1;
    let requestInfo = postListRequestRef.current;

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
        return undefined;
      }

      setPosts(null);
      setErrorMessage("");
      requestInfo = {
        page: apiPage,
        request: getPostList({
          page: apiPage,
        }),
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

        const {
          posts: nextPosts,
          page,
          size,
          totalElements,
          totalPages,
        } = result.data;

        if (
          nextPosts.length === 0 &&
          totalPages > 0 &&
          currentPage > totalPages
        ) {
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
      } catch (error) {
        if (
          isActive &&
          postListRequestRef.current === requestInfo
        ) {
          setPageInfo(null);
          setErrorMessage(error.message);
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
          ) : null}
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
