import { Link } from "react-router-dom";

import { MultilineText, ProfileImage } from "./PostDetailPrimitives.jsx";
import { formatCount, formatDateTime } from "../../utils/format.js";

export default function PostArticle({
  postDetail,
  currentUserId,
  isLikePending,
  isDeletingPost,
  onLike,
  onModify,
  onDelete,
  onReport,
}) {
  const author = postDetail.author || {};
  const post = postDetail.post || {};
  const meta = postDetail.meta || {};
  const isPostOwner = (
    author.userId != null &&
    currentUserId != null &&
    String(author.userId) === String(currentUserId)
  );
  const isLiked = meta.liked === true;

  return (
    <article
      id="postDetail"
      className="post-detail-article"
    >
      <div id="postDetailContent">
        <header className="post-detail-header">
          <div className="post-detail-heading">
            <Link
              className="post-detail-back-link"
              to="/posts"
            >
              목록으로
            </Link>

            <div className="post-detail-title-row">
              <h1>{post.title || "제목 없음"}</h1>
              <span className="post-detail-view-count">
                조회수 {formatCount(meta.views)}
              </span>
            </div>

            <div className="post-detail-author">
              <ProfileImage
                author={author}
                size={44}
              />

              <div>
                <strong>
                  {author.nickname || "알 수 없음"}
                </strong>

                <div className="post-detail-date">
                  <span>
                    작성일 {formatDateTime(
                      post.createdAt,
                    )}
                  </span>

                  {post.modified && post.modifiedAt ? (
                    <span>
                      수정일 {formatDateTime(
                        post.modifiedAt,
                      )}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="post-header-actions">
            {isPostOwner ? (
              <>
                <button
                  id="postModifyButton"
                  type="button"
                  onClick={onModify}
                >
                  수정
                </button>

                <button
                  id="postDeleteButton"
                  type="button"
                  disabled={isDeletingPost}
                  onClick={onDelete}
                >
                  삭제
                </button>
              </>
            ) : null}

            <button
              id="reportOpenButton"
              className="secondary-button"
              type="button"
              onClick={onReport}
            >
              신고하기
            </button>
          </div>
        </header>

        {post.postImageUrl ? (
          <figure className="post-detail-image-wrap">
            <img
              src={post.postImageUrl}
              alt="게시글 이미지"
            />
          </figure>
        ) : null}

        <section className="post-detail-body">
          <MultilineText value={post.postBody} />
        </section>
      </div>

      <footer className="post-detail-like-area">
        <button
          id="likeButton"
          className={
            `post-like-button${
              isLiked ? " active" : ""
            }`
          }
          type="button"
          aria-pressed={isLiked}
          disabled={isLikePending}
          onClick={onLike}
        >
          <span
            className="post-like-icon"
            aria-hidden="true"
          >
            ♥
          </span>
          <span id="likeText">
            {isLiked ? "좋아요 취소" : "좋아요"}
          </span>
          <strong id="likeCount">
            {formatCount(meta.likes)}
          </strong>
        </button>
      </footer>
    </article>
  );
}
