import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";

import { logout } from "../services/authApi.js";
import {
  clearLoginUser,
  getAccessToken,
  getLoginUser,
} from "../utils/auth.js";

export default function Header() {
  const [
    isProfileMenuOpen,
    setIsProfileMenuOpen,
  ] = useState(false);
  const profileMenuRef = useRef(null);
  const navigate = useNavigate();
  const {
    profileImageUrl,
  } = getLoginUser();
  const hasProfileImage = Boolean(
    profileImageUrl &&
    profileImageUrl !== "null" &&
    profileImageUrl !== "undefined",
  );

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return undefined;
    }

    function handleDocumentClick(event) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(
          event.target,
        )
      ) {
        setIsProfileMenuOpen(false);
      }
    }

    document.addEventListener(
      "click",
      handleDocumentClick,
    );

    return () => {
      document.removeEventListener(
        "click",
        handleDocumentClick,
      );
    };
  }, [isProfileMenuOpen]);

  function handleProfileMenuToggle() {
    setIsProfileMenuOpen(
      (previous) => !previous,
    );
  }

  async function handleLogout() {
    try {
      if (getAccessToken()) {
        await logout();
      }
    } catch (error) {
      console.log(error);
    } finally {
      clearLoginUser();
      navigate("/login", {
        replace: true,
      });
    }
  }

  return (
    <div id="header">
      <header className="site-header">
        <Link
          className="site-title"
          to="/posts"
        >
          community test
        </Link>

        <div
          ref={profileMenuRef}
          className="header-profile"
        >
          <button
            id="profileMenuButton"
            className="profile-menu-button"
            type="button"
            onClick={handleProfileMenuToggle}
          >
            {hasProfileImage ? (
              <img
                src={profileImageUrl}
                alt="프로필 이미지"
              />
            ) : (
              <span
                className="profile-placeholder"
              />
            )}
          </button>

          <nav
            id="profileDropdown"
            className="profile-dropdown"
            hidden={!isProfileMenuOpen}
          >
            <Link to="/modify-info">
              회원정보 수정
            </Link>

            <Link to="/modify-password">
              비밀번호 변경
            </Link>

            <button
              id="logoutButton"
              type="button"
              onClick={handleLogout}
            >
              로그아웃
            </button>
          </nav>
        </div>
      </header>
    </div>
  );
}
