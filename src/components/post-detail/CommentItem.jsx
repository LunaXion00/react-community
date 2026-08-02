import { useRef, useState } from "react";

import { deleteComment, modifyComment } from "../../services/commentApi.js";
import { formatDateTime } from "../../utils/format.js";
import { MultilineText, ProfileImage } from "./PostDetailPrimitives.jsx";
import { getRequestErrorMessage } from "./postDetailUtils.js";

export default function CommentItem({
  item,
  depth = 0,
  postId,
  currentUserId,
  isRequestCurrent,
  isReplyFormOpen,
  isReplyActionDisabled,
  onReloadComments,
  onPageMessage,
  onToggleReply,
}) {
  const author = item.author || {};
  const comment = item.comment || {};
  const [ isEditing, setIsEditing ] = useState(false);
  const [ editBody, setEditBody ] = useState("");
  const [ isSaving, setIsSaving ] = useState(false);
  const [ isDeleting, setIsDeleting ] = useState(false);
  const saveLockRef = useRef(false);
  const deleteLockRef = useRef(false);
  const isOwner = (
    author.userId != null &&
    currentUserId != null &&
    String(author.userId) === String(currentUserId)
  );
  const isDeleted = comment.deleted === true;
  const canModify = isOwner && !isDeleted;
  const isCurrentReplySubmitting = (
    isReplyFormOpen && isReplyActionDisabled
  );

  function handleEdit() {
    setEditBody(comment.commentBody || "");
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
  }

  async function handleSaveComment() {
    if (saveLockRef.current) {
      return;
    }

    const nextCommentBody = editBody.trim();

    if (!nextCommentBody) {
      onPageMessage(
        "댓글 내용을 입력해주세요.",
      );
      return;
    }

    saveLockRef.current = true;
    setIsSaving(true);
    onPageMessage("");

    try {
      await modifyComment({
        postId,
        commentId: comment.commentId,
        commentBody: nextCommentBody,
      });

      if (!isRequestCurrent()) {
        return;
      }

      const didReload = await onReloadComments();

      if (didReload !== false) {
        setIsEditing(false);
      }
    } catch (error) {
      if (isRequestCurrent()) {
        onPageMessage(
          getRequestErrorMessage(error),
        );
      }
    } finally {
      setIsSaving(false);
      saveLockRef.current = false;
    }
  }

  async function handleDeleteComment() {
    if (deleteLockRef.current) {
      return;
    }

    const confirmed = window.confirm(
      "댓글을 삭제하시겠습니까?",
    );

    if (!confirmed) {
      return;
    }

    deleteLockRef.current = true;
    setIsDeleting(true);
    onPageMessage("");

    try {
      await deleteComment({
        postId,
        commentId: comment.commentId,
      });

      if (!isRequestCurrent()) {
        return;
      }

      await onReloadComments();
    } catch (error) {
      if (isRequestCurrent()) {
        onPageMessage(
          getRequestErrorMessage(error),
        );
      }
    } finally {
      setIsDeleting(false);
      deleteLockRef.current = false;
    }
  }

  return (
    <article
      className={
        `comment-item${
          depth > 0 ? " is-reply" : ""
        }${
          isDeleted ? " is-deleted" : ""
        }`
      }
      style={{
        "--comment-depth": Math.min(depth, 4),
      }}
      data-comment-id={comment.commentId ?? ""}
      data-parent-comment-id={
        comment.parentCommentId ?? ""
      }
      data-comment-depth={depth}
    >
      <header className="comment-header">
        <div className="comment-author">
          <ProfileImage
            author={author}
            size={28}
          />

          <div>
            <strong>
              {author.nickname || "알 수 없음"}
            </strong>
            <small>
              {formatDateTime(comment.createdAt)}
            </small>
          </div>
        </div>

        {!isDeleted ? (
          <div className="comment-actions">
            <button
              className="comment-reply-button secondary-button"
              type="button"
              aria-expanded={isReplyFormOpen}
              disabled={
                isDeleting ||
                isSaving ||
                isReplyActionDisabled
              }
              onClick={() => {
                onToggleReply(comment.commentId);
              }}
            >
              답글
            </button>

            {canModify && !isEditing ? (
              <>
                <button
                  className="comment-edit-button"
                  type="button"
                  disabled={
                    isDeleting ||
                    isCurrentReplySubmitting
                  }
                  onClick={handleEdit}
                >
                  수정
                </button>
                <button
                  className="comment-delete-button"
                  type="button"
                  disabled={
                    isDeleting ||
                    isCurrentReplySubmitting
                  }
                  onClick={handleDeleteComment}
                >
                  삭제
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </header>

      {isEditing && !isDeleted ? (
        <div className="comment-edit-form">
          <textarea
            className="comment-edit-input"
            value={editBody}
            disabled={isSaving}
            onChange={(event) => {
              setEditBody(event.target.value);
            }}
          />

          <div className="comment-actions">
            <button
              className="comment-save-button"
              type="button"
              disabled={
                isSaving ||
                isCurrentReplySubmitting
              }
              onClick={handleSaveComment}
            >
              저장
            </button>
            <button
              className="comment-cancel-button"
              type="button"
              disabled={isSaving}
              onClick={handleCancelEdit}
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <p className="comment-body">
          <MultilineText
            value={comment.commentBody}
          />
        </p>
      )}
    </article>
  );
}
