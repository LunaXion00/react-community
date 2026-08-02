import CommentItem from "./CommentItem.jsx";

function getCommentKey(commentId) {
  if (commentId === null || commentId === undefined) {
    return null;
  }

  return String(commentId);
}

export default function CommentTreeItem({
  node,
  depth,
  ancestorCommentIds,
  activeReplyCommentId,
  isReplyActionDisabled,
  postId,
  currentUserId,
  isRequestCurrent,
  onReloadComments,
  onPageMessage,
  onToggleReply,
  renderReplyForm,
}) {
  const item = node.item;
  const comment = item.comment || {};
  const commentKey = getCommentKey(
    comment.commentId,
  );

  if (
    commentKey === null ||
    ancestorCommentIds.has(commentKey)
  ) {
    return null;
  }

  const nextAncestorCommentIds = new Set(
    ancestorCommentIds,
  );
  const isDeleted = comment.deleted === true;
  const isReplyFormOpen = (
    getCommentKey(activeReplyCommentId) ===
    commentKey
  );

  nextAncestorCommentIds.add(commentKey);

  return (
    <>
      <CommentItem
        item={item}
        depth={depth}
        postId={postId}
        currentUserId={currentUserId}
        isRequestCurrent={isRequestCurrent}
        isReplyFormOpen={isReplyFormOpen}
        isReplyActionDisabled={
          isReplyActionDisabled
        }
        onReloadComments={onReloadComments}
        onPageMessage={onPageMessage}
        onToggleReply={onToggleReply}
      />

      {!isDeleted && isReplyFormOpen ? (
        renderReplyForm({
          item,
          depth: depth + 1,
        })
      ) : null}

      {node.children.map((childNode) => (
        <CommentTreeItem
          key={childNode.item.comment.commentId}
          node={childNode}
          depth={depth + 1}
          ancestorCommentIds={
            nextAncestorCommentIds
          }
          activeReplyCommentId={
            activeReplyCommentId
          }
          isReplyActionDisabled={
            isReplyActionDisabled
          }
          postId={postId}
          currentUserId={currentUserId}
          isRequestCurrent={isRequestCurrent}
          onReloadComments={onReloadComments}
          onPageMessage={onPageMessage}
          onToggleReply={onToggleReply}
          renderReplyForm={renderReplyForm}
        />
      ))}
    </>
  );
}
