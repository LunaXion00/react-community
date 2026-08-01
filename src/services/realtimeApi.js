import { request } from "../apiClient.js";
import {
  getAccessToken,
  handleUnauthorized,
} from "../utils/auth.js";

const EVENT_NAMES = new Set([
  "connected",
  "post-created",
  "comment-created",
]);

function createHttpError(status) {
  const error = new Error(`실시간 연결 실패 (${status})`);
  error.status = status;
  return error;
}

function parseEvent(eventName, dataLines, onEvent) {
  if (!EVENT_NAMES.has(eventName) || dataLines.length === 0) {
    return;
  }

  let data;

  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    // A malformed event must not terminate the stream.
    return;
  }

  onEvent({
    event: eventName,
    data,
  });
}

export async function connectRealtimeStream({
  accessToken = getAccessToken(),
  signal,
  onEvent,
}) {
  const response = await fetch("/api/realtime/stream", {
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });

  if (response.status === 401) {
    handleUnauthorized();
  }

  if (!response.ok) {
    throw createHttpError(response.status);
  }

  if (!response.body) {
    throw new Error("실시간 응답 스트림이 없습니다.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "";
  let dataLines = [];

  function resetEvent() {
    eventName = "";
    dataLines = [];
  }

  function processLine(line) {
    if (line === "") {
      parseEvent(eventName, dataLines, onEvent);
      resetEvent();
      return;
    }

    if (line.startsWith(":")) {
      return;
    }

    const separatorIndex = line.indexOf(":");
    const field = separatorIndex === -1
      ? line
      : line.slice(0, separatorIndex);
    let value = separatorIndex === -1
      ? ""
      : line.slice(separatorIndex + 1);

    if (value.startsWith(" ")) {
      value = value.slice(1);
    }

    if (field === "event") {
      eventName = value;
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  function processLines(flush = false) {
    while (true) {
      const lineBreak = /\r\n|\r|\n/.exec(buffer);

      if (!lineBreak) {
        return;
      }

      if (
        !flush &&
        lineBreak[0] === "\r" &&
        lineBreak.index + 1 === buffer.length
      ) {
        return;
      }

      const line = buffer.slice(0, lineBreak.index);
      buffer = buffer.slice(
        lineBreak.index + lineBreak[0].length,
      );
      processLine(line);
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        buffer += decoder.decode();
        processLines(true);
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      processLines();
    }
  } finally {
    reader.releaseLock();
  }
}

export function updateRealtimeInterest({
  connectionId,
  type,
  postId = null,
  revision,
}) {
  return request(
    `/api/realtime/connections/${connectionId}/interest`,
    {
      method: "PATCH",
      body: {
        type,
        postId: type === "POST_DETAIL" ? postId : null,
        revision,
      },
    },
  );
}
