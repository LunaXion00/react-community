import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Header from "../components/Header.jsx";
import { useForm } from "../hooks/useForm.js";
import { getPostDetail, modifyPost } from "../services/postApi.js";
import { getLoginUser, requireLogin } from "../utils/auth.js";

const INITIAL_MODIFY_STATUS_MESSAGE = {
  text: "기존 게시글을 불러오는 중입니다.",
  type: "",
};

const titleRules = {
  required: {
    message: "제목을 입력해주세요.",
  },
  validate: (value) => (
    String(value ?? "").trim().length <= 26 ||
    "제목은 최대 26자입니다."
  ),
};

const postBodyRules = {
  required: {
    message: "내용을 입력해주세요.",
  },
};

function getRequestErrorMessage(error) {
  return typeof error?.message === "string"
    ? error.message
    : "요청을 처리하지 못했습니다.";
}

export default function PostModifyPage() {
  const navigate = useNavigate();
  const { postId } = useParams();
  const loginUserRef = useRef(undefined);

  if (loginUserRef.current === undefined) {
    loginUserRef.current = getLoginUser();
  }

  const currentUserId = loginUserRef.current.userId;
  const [isPostLoaded, setIsPostLoaded] = useState(false);
  const [ modifyStatusMessage, setModifyStatusMessage ] = useState(INITIAL_MODIFY_STATUS_MESSAGE);
  const initializationRef = useRef({
    postId: undefined,
    request: undefined,
  });
  const {
    formRef,
    register,
    handleSubmit,
    errors,
    formError,
    isSubmitting,
    setError,
    clearErrors,
    setFormError,
    reset,
  } = useForm({
    defaultValues: {
      title: "",
      postBody: "",
      postImageUrl: "",
    },
  });

  const isFormDisabled = (
    !isPostLoaded || isSubmitting
  );

  useEffect(() => {
    document.title = "게시글 수정";

    if (initializationRef.current.postId !== postId) {
      initializationRef.current = {
        postId,
        request: undefined,
      };
    }

    let request = initializationRef.current.request;

    if (request === undefined) {
      const accessToken = requireLogin(navigate);

      if (!accessToken) {
        initializationRef.current.request = null;
        return undefined;
      }

      if (!postId) {
        initializationRef.current.request = null;
        window.alert("게시글 ID가 없습니다.");
        navigate("/posts");
        return undefined;
      }

      setIsPostLoaded(false);
      clearErrors();
      setFormError("");
      setModifyStatusMessage(
        INITIAL_MODIFY_STATUS_MESSAGE,
      );
      request = getPostDetail({
        postId,
      });
      initializationRef.current.request = request;
    }

    if (request === null) {
      return undefined;
    }

    let isActive = true;

    async function loadPostForModify() {
      try {
        const result = await request;

        if (!isActive) {
          return;
        }

        const author = result.data?.author || {};
        const post = result.data?.post || {};

        const isPostOwner = (
          author.userId != null &&
          currentUserId != null &&
          String(author.userId) === String(currentUserId)
        );

        if (!isPostOwner) {
          window.alert(
            "게시글 작성자만 수정할 수 있습니다.",
          );
          navigate(`/posts/${postId}`);
          return;
        }

        reset({
          title: post.title || "",
          postBody: post.postBody || "",
          postImageUrl: post.postImageUrl || "",
        });
        setIsPostLoaded(true);
        setModifyStatusMessage({
          text: (
            "게시글을 불러왔습니다. " +
            "수정 후 저장할 수 있습니다."
          ),
          type: "success",
        });
      } catch (error) {
        if (isActive) {
          setFormError(
            getRequestErrorMessage(error),
          );
          setModifyStatusMessage({
            text: "게시글을 불러오지 못했습니다.",
            type: "error",
          });
        }
      }
    }

    loadPostForModify();

    return () => {
      isActive = false;
    };
  }, [
    clearErrors,
    currentUserId,
    navigate,
    postId,
    reset,
    setFormError,
  ]);

  function handleInvalidSubmit(nextErrors) {
    const firstErrorName = [
      "title",
      "postBody",
    ].find((name) => nextErrors[name]);

    if (!firstErrorName) {
      return;
    }

    const field = formRef.current?.elements.namedItem(
      firstErrorName,
    );

    if (typeof field?.focus === "function") {
      field.focus();
    }
  }

  async function submitModifyPost(rawValues) {
    if (!isPostLoaded) {
      return;
    }

    setModifyStatusMessage({
      text: "수정 내용을 저장하는 중입니다.",
      type: "",
    });

    try {
      await modifyPost({
        postId,
        title: rawValues.title.trim(),
        postBody: rawValues.postBody,
        postImageUrl:
          rawValues.postImageUrl.trim() || null,
      });

      navigate(`/posts/${postId}`);
    } catch (error) {
      let hasFieldError = false;

      if (
        typeof error?.data?.title === "string" &&
        error.data.title
      ) {
        setError("title", error.data.title);
        hasFieldError = true;
      }

      if (
        typeof error?.data?.postBody === "string" &&
        error.data.postBody
      ) {
        setError("postBody", error.data.postBody);
        hasFieldError = true;
      }

      if (!hasFieldError) {
        setFormError(
          getRequestErrorMessage(error),
        );
      }

      setModifyStatusMessage({
        text: "저장 중 문제가 발생했습니다.",
        type: "error",
      });
    }
  }

  return (
    <>
      <Header />

      <main className="post-create-page">
        <section className="post-create-panel">
          <div className="post-create-title">
            <h1>게시글 수정</h1>
            <p>
              기존 게시글의 제목, 내용, 이미지 URL을
              수정할 수 있습니다.
            </p>
          </div>

          <form
            ref={formRef}
            id="modifyPostForm"
            className="post-create-layout"
            noValidate
            onSubmit={handleSubmit(
              submitModifyPost,
              handleInvalidSubmit,
            )}
          >
            <div className="post-editor-fields">
              <div className="post-field">
                <label htmlFor="title">
                  제목
                </label>
                <input
                  id="title"
                  type="text"
                  placeholder="제목을 입력해주세요."
                  maxLength={26}
                  disabled={isFormDisabled}
                  {...register("title", titleRules)}
                />
                <p
                  id="titleHelper"
                  className={errors.title
                    ? "helper-text error"
                    : "helper-text"}
                >
                  {errors.title || ""}
                </p>
              </div>

              <div className="post-field">
                <label htmlFor="postBody">
                  내용
                </label>
                <textarea
                  id="postBody"
                  className="post-body-input"
                  placeholder="내용을 입력해주세요."
                  disabled={isFormDisabled}
                  {...register(
                    "postBody",
                    postBodyRules,
                  )}
                />
                <p
                  id="postBodyHelper"
                  className={errors.postBody
                    ? "helper-text error"
                    : "helper-text"}
                >
                  {errors.postBody || ""}
                </p>
              </div>

              <div className="post-field">
                <label htmlFor="postImageUrl">
                  이미지 URL
                </label>
                <input
                  id="postImageUrl"
                  type="text"
                  placeholder="선택 사항입니다."
                  disabled={isFormDisabled}
                  {...register("postImageUrl")}
                />
                <p className="helper-text">
                  이미지가 필요 없다면 비워두면 됩니다.
                </p>
              </div>

              <p
                id="modifyMessage"
                className="message"
              >
                {formError}
              </p>
            </div>

            <aside className="post-create-side-panel">
              <h2>수정 상태</h2>
              <p
                id="modifyStatusMessage"
                className={modifyStatusMessage.type
                  ? `message ${modifyStatusMessage.type}`
                  : "message"}
              >
                {modifyStatusMessage.text}
              </p>

              <div className="post-create-actions">
                <button
                  type="submit"
                  disabled={isFormDisabled}
                >
                  수정 완료
                </button>

                <Link
                  id="postDetailLink"
                  className="secondary-link"
                  to={`/posts/${postId}`}
                >
                  상세로 돌아가기
                </Link>

                <Link
                  className="secondary-link"
                  to="/posts"
                >
                  목록으로 돌아가기
                </Link>
              </div>
            </aside>
          </form>
        </section>
      </main>
    </>
  );
}
