import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  connectRealtimeStream,
  updateRealtimeInterest,
} from "../services/realtimeApi.js";
import { getAccessToken, getLoginUser } from "../utils/auth.js";

const EMPTY_SET = new Set();

function getAuthSignature() {
  const loginUser = getLoginUser();

  if (!loginUser.token?.accessToken) {
    return "";
  }

  return `${loginUser.userId ?? ""}:${loginUser.token.accessToken}`;
}

function getRouteInterest(pathname) {
  if (pathname === "/posts") {
    return {
      type: "POST_LIST",
      postId: null,
    };
  }

  const detailMatch = pathname.match(/^\/posts\/([1-9]\d*)$/);

  if (
    detailMatch &&
    Number.isSafeInteger(Number(detailMatch[1]))
  ) {
    return {
      type: "POST_DETAIL",
      postId: Number(detailMatch[1]),
    };
  }

  return {
    type: "NONE",
    postId: null,
  };
}

function isSameInterest(left, right) {
  return (
    left.type === right.type &&
    left.postId === right.postId
  );
}

function isAuthError(error) {
  return error?.status === 401 || error?.status === 403;
}

function isPositiveId(value) {
  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}

function removeIds(current, snapshot) {
  if (!snapshot || snapshot.size === 0) {
    return current;
  }

  const next = new Set(current);
  snapshot.forEach((id) => next.delete(id));

  return next.size === current.size ? current : next;
}

export default function useRealtime(pathname, search) {
  const routeInterest = useMemo(
    () => getRouteInterest(pathname),
    [pathname],
  );
  const [authSignature, setAuthSignature] = useState(
    getAuthSignature,
  );
  const [pendingPostIds, setPendingPostIds] = useState(
    EMPTY_SET,
  );
  const [pendingCommentIds, setPendingCommentIds] = useState(
    () => new Map(),
  );
  const [postListRefreshRequest, setPostListRefreshRequest] = (
    useState(null)
  );
  const [detailCommentsRefreshRequest, setDetailCommentsRefreshRequest] = (
    useState(null)
  );
  const refreshNonceRef = useRef(0);
  const pendingPostIdsRef = useRef(pendingPostIds);
  const pendingCommentIdsRef = useRef(pendingCommentIds);
  const connectionRef = useRef(null);
  const streamControllerRef = useRef(null);
  const interestRef = useRef({
    type: "NONE",
    postId: null,
    revision: 0,
  });
  const revisionRef = useRef(0);
  const generationRef = useRef(0);
  const authFailureRef = useRef(false);

  pendingPostIdsRef.current = pendingPostIds;
  pendingCommentIdsRef.current = pendingCommentIds;

  useEffect(() => {
    function syncAuthSignature() {
      setAuthSignature((currentSignature) => {
        const nextSignature = getAuthSignature();

        return currentSignature === nextSignature
          ? currentSignature
          : nextSignature;
      });
    }

    window.addEventListener("storage", syncAuthSignature);

    return () => {
      window.removeEventListener("storage", syncAuthSignature);
    };
  }, []);

  useEffect(() => {
    setAuthSignature(getAuthSignature());
  }, [pathname, search]);

  useEffect(() => {
    setPendingPostIds(EMPTY_SET);
    setPendingCommentIds(new Map());
    setPostListRefreshRequest(null);
    setDetailCommentsRefreshRequest(null);
  }, [authSignature]);

  const handleRealtimeEvent = useCallback((event) => {
    if (event.event === "post-created") {
      const postId = isPositiveId(event.data?.postId);

      if (postId === null) {
        return;
      }

      setPendingPostIds((current) => {
        if (current.has(postId)) {
          return current;
        }

        const next = new Set(current);
        next.add(postId);
        return next;
      });
      return;
    }

    if (event.event === "comment-created") {
      const postId = isPositiveId(event.data?.postId);
      const commentId = isPositiveId(event.data?.commentId);

      if (postId === null || commentId === null) {
        return;
      }

      setPendingCommentIds((current) => {
        const existing = current.get(postId);

        if (existing?.has(commentId)) {
          return current;
        }

        const next = new Map(current);
        const nextIds = new Set(existing || []);
        nextIds.add(commentId);
        next.set(postId, nextIds);
        return next;
      });
    }
  }, []);

  const handlePostListRefreshSuccess = useCallback((snapshot) => {
    setPendingPostIds((current) => removeIds(current, snapshot));
  }, []);

  const handleCommentsRefreshSuccess = useCallback((postId, snapshot) => {
    const normalizedPostId = isPositiveId(postId);

    if (normalizedPostId === null) {
      return;
    }

    setPendingCommentIds((current) => {
      const existing = current.get(normalizedPostId);

      if (!existing || !snapshot || snapshot.size === 0) {
        return current;
      }

      const nextIds = removeIds(existing, snapshot);

      if (nextIds === existing) {
        return current;
      }

      const next = new Map(current);

      if (nextIds.size === 0) {
        next.delete(normalizedPostId);
      } else {
        next.set(normalizedPostId, nextIds);
      }

      return next;
    });
  }, []);

  const requestPostListRefresh = useCallback(({
    snapshot,
    targetPage,
  }) => {
    refreshNonceRef.current += 1;
    setPostListRefreshRequest({
      nonce: refreshNonceRef.current,
      snapshot: new Set(snapshot || []),
      targetPage: targetPage ?? null,
    });
  }, []);

  const completePostListRefresh = useCallback((nonce) => {
    setPostListRefreshRequest((current) => (
      current?.nonce === nonce ? null : current
    ));
  }, []);

  const completeCommentsRefresh = useCallback((nonce) => {
    setDetailCommentsRefreshRequest((current) => (
      current?.nonce === nonce ? null : current
    ));
  }, []);

  useEffect(() => {
    const previousInterest = interestRef.current;

    if (isSameInterest(previousInterest, routeInterest)) {
      return;
    }

    const nextInterest = {
      ...routeInterest,
      revision: ++revisionRef.current,
    };
    interestRef.current = nextInterest;

    if (routeInterest.type !== "POST_LIST") {
      setPostListRefreshRequest(null);
    }

    if (routeInterest.type !== "POST_DETAIL") {
      setDetailCommentsRefreshRequest(null);
    }

    if (!authSignature || !connectionRef.current) {
      return;
    }

    const connection = connectionRef.current;

    updateRealtimeInterest({
      connectionId: connection.id,
      type: nextInterest.type,
      postId: nextInterest.postId,
      revision: nextInterest.revision,
    }).catch((error) => {
      if (
        connectionRef.current !== connection ||
        interestRef.current.revision !== nextInterest.revision
      ) {
        return;
      }

      if (isAuthError(error)) {
        authFailureRef.current = true;
      }

      streamControllerRef.current?.abort();
    });
  }, [authSignature, routeInterest]);

  useEffect(() => {
    const generation = ++generationRef.current;
    let isStopped = false;
    let reconnectTimer;
    let hasConnected = false;
    authFailureRef.current = false;

    function isActive() {
      return (
        !isStopped &&
        generationRef.current === generation
      );
    }

    function scheduleReconnect() {
      if (
        !isActive() ||
        reconnectTimer !== undefined ||
        authFailureRef.current
      ) {
        return;
      }

      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined;
        connect();
      }, 3000);
    }

    async function registerInterest(connection, isReconnect) {
      const interest = interestRef.current;

      try {
        await updateRealtimeInterest({
          connectionId: connection.id,
          type: interest.type,
          postId: interest.postId,
          revision: interest.revision,
        });
      } catch (error) {
        if (
          isActive() &&
          connectionRef.current === connection &&
          interestRef.current.revision === interest.revision
        ) {
          if (isAuthError(error)) {
            authFailureRef.current = true;
          }

          streamControllerRef.current?.abort();
        }

        return;
      }

      if (
        !isActive() ||
        connectionRef.current !== connection ||
        interestRef.current.revision !== interest.revision
      ) {
        return;
      }

      if (!isReconnect) {
        return;
      }

      if (interest.type === "POST_LIST") {
        setPostListRefreshRequest({
          nonce: ++refreshNonceRef.current,
          snapshot: new Set(pendingPostIdsRef.current),
          targetPage: null,
        });
      } else if (
        interest.type === "POST_DETAIL" &&
        interest.postId !== null
      ) {
        const snapshot = (
          pendingCommentIdsRef.current.get(interest.postId) ||
          EMPTY_SET
        );
        setDetailCommentsRefreshRequest({
          nonce: ++refreshNonceRef.current,
          postId: interest.postId,
          snapshot: new Set(snapshot),
        });
      }
    }

    async function connect() {
      if (!isActive() || !authSignature) {
        return;
      }

      const accessToken = getAccessToken();

      if (!accessToken) {
        return;
      }

      const controller = new AbortController();
      const isReconnect = hasConnected;
      streamControllerRef.current = controller;
      let shouldReconnect = true;

      try {
        await connectRealtimeStream({
          accessToken,
          signal: controller.signal,
          onEvent: (event) => {
            if (!isActive()) {
              return;
            }

            if (event.event === "connected") {
              const connectionId = event.data?.connectionId;

              if (typeof connectionId !== "string" || !connectionId) {
                return;
              }

              const connection = {
                id: connectionId,
                generation,
              };
              connectionRef.current = connection;
              hasConnected = true;
              void registerInterest(connection, isReconnect);
              return;
            }

            handleRealtimeEvent(event);
          },
        });
      } catch (error) {
        if (isAuthError(error)) {
          authFailureRef.current = true;
        }

        if (
          !isActive() ||
          controller.signal.aborted ||
          error?.name === "AbortError" ||
          isAuthError(error)
        ) {
          shouldReconnect = !authFailureRef.current;
          return;
        }
      } finally {
        if (streamControllerRef.current === controller) {
          streamControllerRef.current = null;
        }

        if (
          connectionRef.current?.generation === generation
        ) {
          connectionRef.current = null;
        }

        if (isActive() && shouldReconnect) {
          scheduleReconnect();
        }
      }
    }

    if (authSignature) {
      void connect();
    }

    return () => {
      isStopped = true;
      generationRef.current += 1;

      window.clearTimeout(reconnectTimer);
      streamControllerRef.current?.abort();
      streamControllerRef.current = null;

      connectionRef.current = null;
    };
  }, [authSignature, handleRealtimeEvent]);

  const currentDetailCommentIds = (
    routeInterest.type === "POST_DETAIL"
      ? pendingCommentIds.get(routeInterest.postId) || EMPTY_SET
      : EMPTY_SET
  );

  return {
    pendingPostIds,
    pendingCommentIds: currentDetailCommentIds,
    postListRefreshRequest,
    detailCommentsRefreshRequest,
    onPostListRefreshRequest: requestPostListRefresh,
    onPostListRefreshSuccess: handlePostListRefreshSuccess,
    onPostListRefreshComplete: completePostListRefresh,
    onCommentsRefreshSuccess: handleCommentsRefreshSuccess,
    onCommentsRefreshComplete: completeCommentsRefresh,
  };
}
