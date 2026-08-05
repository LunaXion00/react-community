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
      localStorage.removeItem("token");
      return null;
    }

    return token;
  } catch {
    localStorage.removeItem("token");
    return null;
  }
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
}

export function handleUnauthorized() {
  clearLoginUser();
  window.location.replace("/login");
}
