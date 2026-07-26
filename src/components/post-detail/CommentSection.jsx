import { useEffect, useMemo, useState } from "react";

import { useForm } from "../../hooks/useForm.js";
import { postComment } from "../../services/commentApi.js";
import { formatCount } from "../../utils/format.js";
import CommentTreeItem from "./CommentTreeItem.jsx";
import { buildCommentTree } from "./commentTree.js";
import { getRequestErrorMessage } from "./postDetailUtils.js";

const commentBodyRules = {
  required: {
    message: "댓글 내용을 입력해주세요.",
  },
};

function isSameCommentId(leftId, rightId) {
  return (
    leftId !== null &&
    leftId !== undefined &&
    rightId !== null &&
    rightId !== undefined &&
    String(leftId) === String(rightId)
  );
}

export default function CommentSection({
  comments,
  commentCount,
  currentUserNickname,
  postId,
  pageMessage,
  onIncreaseCommentCount,
  isRequestCurrent,
  onPageMessage,
  onReloadComments,
}) {
  const [ commentBody, setCommentBody ] = useState("");
  const [ activeReplyCommentId, setActiveReplyCommentId ] = useState(null);
  const commentTree = useMemo(
    () => buildCommentTree(comments),
    [comments],
  );
  const commentForm = useForm({
    defaultValues: {
      commentBody: "",
    },
  });
  const replyForm = useForm({
    defaultValues: {
      commentBody: "",
    },
  });
  const replyFormRef = replyForm.formRef;
  const resetReplyForm = replyForm.reset;

  useEffect(() => {
    if (
      activeReplyCommentId === null ||
      comments === null
    ) {
      return;
    }

    const activeReplyItem = Array.isArray(comments)
      ? comments.find((item) => (
          isSameCommentId(
            item?.comment?.commentId,
            activeReplyCommentId,
          )
        ))
      : null;

    if (
      activeReplyItem &&
      activeReplyItem.comment?.deleted !== true
    ) {
      return;
    }

    resetReplyForm();
    setActiveReplyCommentId(null);
  }, [
    activeReplyCommentId,
    comments,
    resetReplyForm,
  ]);

  useEffect(() => {
    if (activeReplyCommentId === null) {
      return;
    }

    replyFormRef.current?.elements
      .namedItem("commentBody")
      ?.focus();
  }, [
    activeReplyCommentId,
    replyFormRef,
  ]);

  function handleCommentBodyChange(event) {
    setCommentBody(event.target.value);
  }

  function handleInvalidCommentSubmit(
    nextErrors,
  ) {
    if (nextErrors.commentBody) {
      commentForm.formRef.current?.elements
        .namedItem("commentBody")
        ?.focus();
    }
  }

  async function submitComment(rawValues) {
    onPageMessage("");

    try {
      await postComment({
        postId,
        commentBody: rawValues.commentBody.trim(),
        parentCommentId: null,
      });

      if (!isRequestCurrent()) {
        return;
      }

      setCommentBody("");
      const didReload = await onReloadComments();

      if (didReload !== false) {
        onIncreaseCommentCount();
      }
    } catch (error) {
      if (isRequestCurrent()) {
        onPageMessage(
          getRequestErrorMessage(error),
        );
      }
    }
  }

  function handleInvalidReplySubmit(nextErrors) {
    if (nextErrors.commentBody) {
      replyForm.formRef.current?.elements
        .namedItem("commentBody")
        ?.focus();
    }
  }

  async function submitReply(rawValues) {
    const targetCommentId = activeReplyCommentId;

    if (targetCommentId === null) {
      return;
    }

    try {
      await postComment({
        postId,
        commentBody: rawValues.commentBody.trim(),
        parentCommentId: targetCommentId,
      });

      if (!isRequestCurrent()) {
        return;
      }

      const didReload = await onReloadComments();

      if (
        didReload === false ||
        !isRequestCurrent()
      ) {
        return;
      }

      onIncreaseCommentCount();
      replyForm.reset();
      setActiveReplyCommentId((currentId) => (
        isSameCommentId(
          currentId,
          targetCommentId,
        )
          ? null
          : currentId
      ));
    } catch (error) {
      if (isRequestCurrent()) {
        replyForm.setFormError(
          getRequestErrorMessage(error),
        );
      }
    }
  }

  function handleToggleReply(commentId) {
    if (replyForm.isSubmitting) {
      return;
    }

    const isCurrentTarget = isSameCommentId(
      activeReplyCommentId,
      commentId,
    );

    replyForm.reset();
    setActiveReplyCommentId(
      isCurrentTarget ? null : commentId,
    );
  }

  function handleCancelReply() {
    if (replyForm.isSubmitting) {
      return;
    }

    replyForm.reset();
    setActiveReplyCommentId(null);
  }

  const commentBodyField = commentForm.register(
    "commentBody",
    commentBodyRules,
    {
      controlled: true,
      shouldValidate: false,
      onChange: handleCommentBodyChange,
    },
  );
  const replyBodyField = replyForm.register(
    "commentBody",
    commentBodyRules,
  );
  const message = (
    commentForm.errors.commentBody ||
    pageMessage
  );
  const replyMessage = (
    replyForm.errors.commentBody ||
    replyForm.formError
  );

  function renderReplyForm({ item, depth }) {
    const comment = item.comment || {};

    if (
      comment.deleted === true ||
      !isSameCommentId(
        comment.commentId,
        activeReplyCommentId,
      )
    ) {
      return null;
    }

    const textareaId = (
      `replyCommentBody-${comment.commentId}`
    );
    const targetNickname = (
      item.author?.nickname || "알 수 없음"
    );

    return (
      <form
        key={comment.commentId}
        ref={replyForm.formRef}
        className="comment-reply-form"
        style={{
          "--comment-depth": Math.min(depth, 4),
        }}
        noValidate
        onSubmit={replyForm.handleSubmit(
          submitReply,
          handleInvalidReplySubmit,
        )}
      >
        <label htmlFor={textareaId}>
          {targetNickname}님에게 답글 작성
        </label>

        <textarea
          id={textareaId}
          placeholder="댓글을 남겨주세요"
          required
          {...replyBodyField}
        />

        <p
          className={replyMessage
            ? "helper-text error"
            : "helper-text"}
        >
          {replyMessage || ""}
        </p>

        <div className="comment-reply-actions">
          <button
            type="submit"
            disabled={replyForm.isSubmitting}
          >
            답글 등록
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={replyForm.isSubmitting}
            onClick={handleCancelReply}
          >
            취소
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <section
        id="commentWriteSection"
        className="post-comment-write"
      >
        <h2>댓글 작성</h2>

        <form
          id="commentForm"
          ref={commentForm.formRef}
          className="post-comment-form"
          noValidate
          onSubmit={commentForm.handleSubmit(
            submitComment,
            handleInvalidCommentSubmit,
          )}
        >
          <textarea
            id="commentBody"
            {...commentBodyField}
            value={commentBody}
            placeholder="댓글을 남겨주세요"
            required
          />

          <button
            type="submit"
            disabled={
              !commentBody.trim() ||
              commentForm.isSubmitting
            }
          >
            댓글 등록
          </button>
        </form>
      </section>

      <section
        id="commentSection"
        className="post-comment-section"
      >
        <div className="comment-section-title">
          <h2>
            댓글
            <span
              id="commentCount"
              className="comment-count-badge"
            >
              [{formatCount(commentCount)}]
            </span>
          </h2>
        </div>

        <div id="commentList">
          {comments === null ? null : (
            commentTree.length > 0 ? (
              commentTree.map((node) => (
                <CommentTreeItem
                  key={node.item.comment.commentId}
                  node={node}
                  depth={0}
                  ancestorCommentIds={new Set()}
                  activeReplyCommentId={
                    activeReplyCommentId
                  }
                  isReplyActionDisabled={
                    replyForm.isSubmitting
                  }
                  postId={postId}
                  currentUserNickname={
                    currentUserNickname
                  }
                  isRequestCurrent={
                    isRequestCurrent
                  }
                  onReloadComments={
                    onReloadComments
                  }
                  onPageMessage={onPageMessage}
                  onToggleReply={
                    handleToggleReply
                  }
                  renderReplyForm={
                    renderReplyForm
                  }
                />
              ))
            ) : (
              <p className="comment-empty">
                댓글이 없습니다.
              </p>
            )
          )}
        </div>
      </section>

      <p
        id="message"
        className={
          message ? "message error" : "message"
        }
      >
        {message}
      </p>
    </>
  );
}
