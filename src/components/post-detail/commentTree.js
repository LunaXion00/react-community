function getCommentId(item) {
  const commentId = item?.comment?.commentId;

  if (commentId === null || commentId === undefined) {
    return null;
  }

  return String(commentId);
}

function getParentCommentId(item) {
  const parentCommentId = (
    item?.comment?.parentCommentId
  );

  if (
    parentCommentId === null ||
    parentCommentId === undefined
  ) {
    return null;
  }

  return String(parentCommentId);
}

function getCreatedAtTime(node) {
  const createdAtTime = Date.parse(
    node.item.comment.createdAt,
  );

  return Number.isNaN(createdAtTime)
    ? 0
    : createdAtTime;
}

function compareCommentIds(left, right, direction) {
  const leftId = left.item.comment.commentId;
  const rightId = right.item.comment.commentId;
  const leftNumber = Number(leftId);
  const rightNumber = Number(rightId);

  if (
    Number.isFinite(leftNumber) &&
    Number.isFinite(rightNumber) &&
    leftNumber !== rightNumber
  ) {
    return direction * (leftNumber - rightNumber);
  }

  return direction * String(leftId).localeCompare(
    String(rightId),
  );
}

function compareRootComments(left, right) {
  const timeDifference = (
    getCreatedAtTime(right) -
    getCreatedAtTime(left)
  );

  return timeDifference || compareCommentIds(
    left,
    right,
    -1,
  );
}

function compareChildComments(left, right) {
  const timeDifference = (
    getCreatedAtTime(left) -
    getCreatedAtTime(right)
  );

  return timeDifference || compareCommentIds(
    left,
    right,
    1,
  );
}

function hasCyclicParent(node, nodesById) {
  const visitedParentIds = new Set();
  let parentId = node.parentId;

  while (parentId !== null) {
    if (parentId === node.id) {
      return true;
    }

    if (visitedParentIds.has(parentId)) {
      return false;
    }

    visitedParentIds.add(parentId);

    const parentNode = nodesById.get(parentId);

    if (!parentNode) {
      return false;
    }

    parentId = parentNode.parentId;
  }

  return false;
}

export function buildCommentTree(comments) {
  if (!Array.isArray(comments)) {
    return [];
  }

  const nodesById = new Map();

  comments.forEach((item) => {
    const id = getCommentId(item);

    if (id === null || nodesById.has(id)) {
      return;
    }

    nodesById.set(id, {
      id,
      parentId: getParentCommentId(item),
      item,
      children: [],
    });
  });

  const roots = [];

  nodesById.forEach((node) => {
    const parentNode = node.parentId === null
      ? null
      : nodesById.get(node.parentId);

    if (
      !parentNode ||
      hasCyclicParent(node, nodesById)
    ) {
      roots.push(node);
      return;
    }

    parentNode.children.push(node);
  });

  roots.sort(compareRootComments);
  nodesById.forEach((node) => {
    node.children.sort(compareChildComments);
  });

  return roots;
}
