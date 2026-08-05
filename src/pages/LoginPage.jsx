import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useForm } from "../hooks/useForm.js";
import { login } from "../services/authApi.js";
import {
  redirectIfLoggedIn,
  saveLoginToken,
} from "../utils/auth.js";
import { validateEmail, validatePassword } from "../utils/validation.js";

const emailRules = {
  validate: (value) => validateEmail(value.trim()),
};

const passwordRules = {
  validate: (value) => validatePassword(value),
};

function saveLoginUser(data) {
  saveLoginToken(data.token);
  localStorage.setItem("userId", data.userId);
  localStorage.setItem("nickname", data.nickname);

  if (
    data.profileImageUrl &&
    data.profileImageUrl !== "null" &&
    data.profileImageUrl !== "undefined"
  ) {
    localStorage.setItem(
      "profileImageUrl",
      data.profileImageUrl,
    );
  } else {
    localStorage.removeItem("profileImageUrl");
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [ isPasswordVisible, setIsPasswordVisible ] = useState(false);
  const {
    formRef,
    register,
    handleSubmit,
    errors,
    formError,
    isSubmitting,
    setError,
    setFormError,
  } = useForm();

  useEffect(() => {
    document.title = "로그인";
    redirectIfLoggedIn(navigate);
  }, [navigate]);

  async function submitLogin(rawValues) {
    try {
      const result = await login({
        email: rawValues.email.trim(),
        password: rawValues.password,
      });

      saveLoginUser(result.data);
      navigate("/posts");
    } catch (error) {
      if (
        error.status === 401 &&
        error.message === "user_not_found"
      ) {
        setError(
          "email",
          "등록되지 않은 이메일입니다",
        );
        return;
      }

      if (
        error.status === 401 &&
        error.message === "password_invalid"
      ) {
        setError(
          "password",
          "비밀번호가 올바르지 않습니다.",
        );
        return;
      }

      setFormError(
        "이메일 또는 비밀번호를 확인해주세요.",
      );
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-title">
          <h1>로그인</h1>
          <p>
            계정으로 로그인하고 커뮤니티를
            이용해보세요.
          </p>
        </div>

        <form
          id="loginForm"
          ref={formRef}
          className="auth-form"
          noValidate
          onSubmit={handleSubmit(submitLogin)}
        >
          <div className="auth-field">
            <label htmlFor="loginEmail">
              이메일
            </label>
            <input
              id="loginEmail"
              type="email"
              autoComplete="email"
              {...register("email", emailRules)}
            />
            <p
              id="emailHelper"
              className={errors.email
                ? "helper-text error"
                : "helper-text"}
            >
              {errors.email || ""}
            </p>
          </div>

          <div className="auth-field">
            <label htmlFor="loginPassword">
              비밀번호
            </label>
            <div className="password-input-row">
              <input
                id="loginPassword"
                type={isPasswordVisible
                  ? "text"
                  : "password"}
                autoComplete="current-password"
                {...register(
                  "password",
                  passwordRules,
                )}
              />
              <button
                type="button"
                className="password-toggle-button"
                data-toggle-password="loginPassword"
                onClick={() => {
                  setIsPasswordVisible(
                    (isVisible) => !isVisible,
                  );
                }}
              >
                {isPasswordVisible ? "숨기기" : "보기"}
              </button>
            </div>
            <p
              id="passwordHelper"
              className={errors.password
                ? "helper-text error"
                : "helper-text"}
            >
              {errors.password || ""}
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
          >
            로그인
          </button>
        </form>

        <p
          id="loginMessage"
          className={formError
            ? "message error"
            : "message"}
        >
          {formError || ""}
        </p>

        <p className="auth-switch">
          아직 계정이 없나요?{" "}
          <Link to="/signup">회원가입</Link>
        </p>
      </section>
    </main>
  );
}
