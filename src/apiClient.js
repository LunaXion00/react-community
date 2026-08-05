import {
  getToken,
  handleAuthFailure,
  refreshAccessToken,
} from "./utils/auth.js";

function parseError(responseBody, status) {
  let errorData = null;

  if (responseBody) {
    try {
      errorData = JSON.parse(responseBody);
    } catch {
      errorData = null;
    }
  }

  const hasErrorMessage = (
    errorData !== null &&
    typeof errorData === "object" &&
    typeof errorData.message === "string" &&
    errorData.message
  );
  const error = new Error(
    hasErrorMessage
      ? errorData.message
      : `API 요청 실패 : ${status}`,
  );

  error.status = status;
  error.data = (
    errorData !== null &&
    typeof errorData === "object" &&
    "data" in errorData
  )
    ? errorData.data
    : null;
  error.body = responseBody;

  return error;
}

async function requestWithRetry(
  endpoint,
  {
    method = "GET",
    body,
    headers = {},
    auth = true,
  } = {},
  canRefresh = true,
) {
  const requestHeaders = {};
  const token = getToken();

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (auth && token) {
    requestHeaders.Authorization = (
      `${token.grantType} ${token.accessToken}`
    );
  }

  const response = await fetch(endpoint, {
    method,
    headers: {
      ...requestHeaders,
      ...headers,
    },
    body: body !== undefined
      ? JSON.stringify(body)
      : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  const responseBody = await response.text();

  if (!response.ok) {
    const error = parseError(
      responseBody,
      response.status,
    );

    if (
      auth &&
      response.status === 401 &&
      error.message === "access_token_expired" &&
      canRefresh
    ) {
      try {
        await refreshAccessToken(token?.accessToken || null);
      } catch (refreshError) {
        handleAuthFailure(refreshError.message);
        throw refreshError;
      }

      return requestWithRetry(
        endpoint,
        {
          method,
          body,
          headers,
          auth,
        },
        false,
      );
    }

    if (auth && response.status === 401) {
      handleAuthFailure(error.message);
    }

    throw error;
  }

  if (!responseBody) {
    return null;
  }

  try {
    return JSON.parse(responseBody);
  } catch {
    return responseBody;
  }
}

export function request(endpoint, options = {}) {
  return requestWithRetry(endpoint, options);
}
