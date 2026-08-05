import { request } from "../apiClient.js";

export function login({
  email,
  password,
}) {
  return request("/api/auth/login", {
    method: "POST",
    body: {
      email,
      password,
    },
    auth: false,
  });
}

export function refresh() {
  return request("/api/auth/refresh", {
    method: "POST",
    auth: false,
  });
}

export function logout() {
  return request("/api/auth/logout", {
    method: "POST",
  });
}
