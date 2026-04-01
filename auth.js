(function () {
  const SESSION_KEY = "finwise_session_v3";

  function normalizeIdentifier(value) {
    return (value || "").trim().toLowerCase();
  }

  function storeSessionUser(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return user;
  }

  function clearSessionUser() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getStoredSessionUser() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  async function api(path, options) {
    const response = await fetch(path, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      ...options,
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = { success: false, message: "Unexpected server response." };
    }

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: data?.message || "Request failed.",
      };
    }

    return data;
  }

  async function signup(firstName, lastName, email, password) {
    const result = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        firstName: (firstName || "").trim(),
        lastName: (lastName || "").trim(),
        email: normalizeIdentifier(email),
        password: password || "",
      }),
    });

    if (result.success && result.user) {
      storeSessionUser(result.user);
    }

    return result;
  }

  async function login(identifier, password) {
    const result = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: normalizeIdentifier(identifier),
        password: password || "",
      }),
    });

    if (result.success && result.user) {
      storeSessionUser(result.user);
    }

    return result;
  }

  async function upsertGoogleUser(profile) {
    const result = await api("/api/auth/google", {
      method: "POST",
      body: JSON.stringify(profile || {}),
    });

    if (result.success && result.user) {
      storeSessionUser(result.user);
    }

    return result;
  }

  function decodeJwtPayload(token) {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  }

  async function handleGoogleCredentialResponse(response, onSuccess, onError) {
    try {
      const profile = decodeJwtPayload(response.credential);
      if (!profile?.email) throw new Error("Missing Google profile email");
      const result = await upsertGoogleUser(profile);
      if (!result.success) throw new Error(result.message || "Google sign-in failed");
      onSuccess(result);
    } catch (error) {
      if (typeof onError === "function") onError(error);
    }
  }

  function initGoogleButton(containerId, options) {
    const { clientId, onSuccess, onError, text = "continue_with" } = options;
    const container = document.getElementById(containerId);

    if (!container) return;

    if (!clientId || !window.google?.accounts?.id) {
      container.innerHTML = '<p class="text-xs text-amber-400">Google sign-in unavailable. Add your Google Client ID.</p>';
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => handleGoogleCredentialResponse(response, onSuccess, onError),
    });

    container.innerHTML = "";
    window.google.accounts.id.renderButton(container, {
      theme: "outline",
      size: "large",
      width: 320,
      text,
      shape: "pill",
    });
  }

  async function refreshSession() {
    const result = await api("/api/auth/me", { method: "GET" });
    if (!result.success || !result.user) {
      clearSessionUser();
      return null;
    }
    return storeSessionUser(result.user);
  }

  window.finwiseAuth = {
    signup,
    login,
    initGoogleButton,
    getCurrentUser: function () {
      return getStoredSessionUser();
    },
    refreshSession,
    logout: function () {
      clearSessionUser();
      fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(function () {
        return null;
      });
    },

    requireAuth: function (redirectTo) {
      const user = this.getCurrentUser();
      if (user) {
        refreshSession().catch(function () {
          return null;
        });
        return user;
      }

      refreshSession().then(function (freshUser) {
        if (!freshUser) {
          window.location.href = redirectTo || "login.html";
        }
      });
      return null;
    },
  };
})();
