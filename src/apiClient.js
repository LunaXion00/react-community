import {
  getToken,
  handleUnauthorized,
} from "./utils/auth.js";

export async function request(
  endpoint,
  {
    method = "GET",
    body,
    headers = {},
    auth = true,
  } = {},
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
        : `API 요청 실패 : ${response.status}`,
    );

    error.status = response.status;
    error.data = (
      errorData !== null &&
      typeof errorData === "object" &&
      "data" in errorData
    )
      ? errorData.data
      : null;
    error.body = responseBody;

    if (auth && response.status === 401) {
      handleUnauthorized();
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
