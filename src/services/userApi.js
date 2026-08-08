import { request } from "../apiClient.js";

export async function signup({
  email,
  password,
  passwordConfirm,
  nickname,
  profileImageUrl = null,
}) {
  return request("/api/users/signup", {
    method: "POST",
    body: {
      email,
      password,
      passwordConfirm,
      nickname,
      profileImageUrl,
    },
    auth: false,
  });
}

export async function modifyInfo({
  userId,
  nickname,
  profileImageUrl,
}) {
  return request(`/api/users/${userId}/info`, {
    method: "PATCH",
    body: {
      nickname,
      profileImageUrl,
    },
  });
}

export async function modifyPassword({
  userId,
  password,
  passwordConfirm,
}) {
  return request(
    `/api/users/${userId}/password`,
    {
      method: "PATCH",
      body: {
        password,
        passwordConfirm,
      },
    },
  );
}

export async function withdrawn({
  userId,
}) {
  return request(`/api/users/${userId}`, {
    method: "DELETE",
  });
}
