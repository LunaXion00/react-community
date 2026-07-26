import { request } from "../apiClient.js";

export async function getCommentList({
  postId,
}) {
  return request(
    `/api/posts/${postId}/comments`,
    {
      method: "GET",
    },
  );
}

export async function postComment({
  postId,
  commentBody,
  parentCommentId = null,
}) {
  return request(
    `/api/posts/${postId}/comments`,
    {
      method: "POST",
      body: {
        commentBody,
        parentCommentId,
      },
    },
  );
}

export async function modifyComment({
  postId,
  commentId,
  commentBody,
}) {
  return request(
    `/api/posts/${postId}/comments/${commentId}`,
    {
      method: "PATCH",
      body: {
        commentBody,
      },
    },
  );
}

export async function deleteComment({
  postId,
  commentId,
}) {
  return request(
    `/api/posts/${postId}/comments/${commentId}`,
    {
      method: "DELETE",
    },
  );
}
