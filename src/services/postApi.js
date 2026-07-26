import { request } from "../apiClient.js";

export async function postUpload({
  title,
  postBody,
  postImageUrl = null,
}) {
  return request("/api/posts", {
    method: "POST",
    body: {
      title,
      postBody,
      postImageUrl,
    },
  });
}

export async function getPostList({
  page = 0,
} = {}) {
  return request(`/api/posts?page=${page}`, {
    method: "GET",
  });
}

export async function getPostDetail({
  postId,
}) {
  return request(`/api/posts/${postId}`, {
    method: "GET",
  });
}

export async function modifyPost({
  postId,
  title,
  postBody,
  postImageUrl,
}) {
  return request(`/api/posts/${postId}`, {
    method: "PATCH",
    body: {
      title,
      postBody,
      postImageUrl,
    },
  });
}

export async function deletePost({
  postId,
}) {
  return request(`/api/posts/${postId}`, {
    method: "DELETE",
  });
}

export async function likePost({
  postId,
}) {
  return request(`/api/posts/${postId}/likes`, {
    method: "POST",
  });
}

export async function unlikePost({
  postId,
}) {
  return request(`/api/posts/${postId}/likes`, {
    method: "DELETE",
  });
}

export async function reportPost({
  postId,
  reason,
  description,
}) {
  return request(`/api/posts/${postId}/report`, {
    method: "POST",
    body: {
      reason,
      description,
    },
  });
}
