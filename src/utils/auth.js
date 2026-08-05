export const AUTH_CHANGE_EVENT = "community-auth-change";

const TERMINAL_AUTH_MESSAGES = new Set([
  "access_token_invalid",
  "unauthorized_user",
  "refresh_token_missing",
  "refresh_token_invalid",
]);

let refreshPromise = null;

function dispatchAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  }
}

function removeStoredToken() {
  const hadToken = localStorage.getItem("token") !== null;
  localStorage.removeItem("token");

  if (hadToken) {
    dispatchAuthChange();
  }
}

export function getToken() {
  const storedToken = localStorage.getItem("token");

  if (storedToken === null) {
    return null;
  }

  try {
    const token = JSON.parse(storedToken);

    if (
      token === null ||
      typeof token !== "object" ||
      Array.isArray(token) ||
      typeof token.grantType !== "string" ||
      !token.grantType ||
      typeof token.accessToken !== "string" ||
      !token.accessToken
    ) {
      removeStoredToken();
      return null;
    }

    return token;
  } catch {
    removeStoredToken();
    return null;
  }
}

export function saveLoginToken(token) {
  localStorage.setItem(
    "token",
    JSON.stringify({
      grantType: token.grantType,
      accessToken: token.accessToken,
    }),
  );
  dispatchAuthChange();
}

export function getAccessToken() {
  const token = getToken();

  return token ? token.accessToken : null;
}

export function getLoginUser() {
  return {
    userId: localStorage.getItem("userId"),
    token: getToken(),
    nickname: localStorage.getItem("nickname"),
    profileImageUrl: localStorage.getItem("profileImageUrl"),
  };
}

export function requireLogin(navigate) {
  const accessToken = getAccessToken();

  if (accessToken) {
    return accessToken;
  }

  alert("로그인이 필요합니다.");
  navigate("/login");

  return null;
}

export function redirectIfLoggedIn(navigate) {
  if (getAccessToken()) {
    navigate("/posts");
  }
}

export function clearLoginUser() {
  localStorage.removeItem("token");
  localStorage.removeItem("userId");
  localStorage.removeItem("nickname");
  localStorage.removeItem("profileImageUrl");
  dispatchAuthChange();
}

export function handleUnauthorized() {
  clearLoginUser();
  window.location.replace("/login");
}

export function handleAuthFailure(message, expectedAccessToken) {
  if (!TERMINAL_AUTH_MESSAGES.has(message)) {
    return false;
  }

  if (
    expectedAccessToken !== undefined &&
    getAccessToken() !== expectedAccessToken
  ) {
    return false;
  }

  handleUnauthorized();
  return true;
}

function createAuthError(message) {
  return new Error(message);
}

async function refreshTokenAfterLock(failedAccessToken) {
  const currentAccessToken = getAccessToken();

  if (!currentAccessToken) {
    throw createAuthError("unauthorized_user");
  }

  if (currentAccessToken !== failedAccessToken) {
    return currentAccessToken;
  }

  const { refresh } = await import("../services/authApi.js");
  let result;

  try {
    result = await refresh();
  } catch (error) {
    const latestAccessToken = getAccessToken();

    if (
      latestAccessToken &&
      latestAccessToken !== failedAccessToken
    ) {
      return latestAccessToken;
    }

    throw error;
  }

  const latestAccessToken = getAccessToken();

  if (!latestAccessToken) {
    throw createAuthError("unauthorized_user");
  }

  if (latestAccessToken !== failedAccessToken) {
    return latestAccessToken;
  }

  const nextToken = result?.data;

  if (
    nextToken === null ||
    typeof nextToken !== "object" ||
    Array.isArray(nextToken) ||
    typeof nextToken.grantType !== "string" ||
    !nextToken.grantType ||
    typeof nextToken.accessToken !== "string" ||
    !nextToken.accessToken
  ) {
    throw createAuthError("session_unavailable");
  }

  saveLoginToken(nextToken);
  return nextToken.accessToken;
}

export function refreshAccessToken(failedAccessToken) {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const locks = (
        typeof navigator !== "undefined" &&
        navigator.locks &&
        typeof navigator.locks.request === "function"
      )
        ? navigator.locks
        : null;

      if (locks) {
        return await locks.request(
          "community-access-token-refresh",
          () => refreshTokenAfterLock(failedAccessToken),
        );
      }

      return await refreshTokenAfterLock(failedAccessToken);
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
