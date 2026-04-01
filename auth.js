(function () {
  const SESSION_KEY = "finwise_session_v2";

  function normalizeEmail(email) {
    return (email || "").trim().toLowerCase();
  }

  function normalizeUsername(username) {
    return (username || "").trim().toLowerCase();
  }

  function storeSessionUser(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return user;
  }

  function getStoredSessionUser() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  async function request(path, options) {
    const response = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...options,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = { success: false, message: "Unexpected server response." };
    }

    if (!response.ok) return { success: false, message: payload?.message || "Request failed." };
    return payload;
  }

  async function signup(firstName, lastName, email, password) {
    const result = await request("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ firstName, lastName, email: normalizeEmail(email), password }),
    });

    if (result.success && result.user) storeSessionUser(result.user);
    return result;
  }

  async function login(identifier, password) {
    const result = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });

    if (result.success && result.user) storeSessionUser(result.user);
    return result;
  }

  async function upsertGoogleUser(profile) {
    const result = await request("/api/auth/google", {
      method: "POST",
      body: JSON.stringify(profile),
    });

    if (result.success && result.user) storeSessionUser(result.user);
    return result;
  }

  function decodeJwtPayload(token) {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
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

  window.finwiseAuth = {
    signup,
    login,
    initGoogleButton,
    getCurrentUser: function () {
      return getStoredSessionUser();
    },
    refreshSession: async function () {
      const result = await request("/api/auth/me", { method: "GET" });
      if (result.success && result.user) {
        storeSessionUser(result.user);
        return result.user;
      }
      localStorage.removeItem(SESSION_KEY);
      return null;
    },
    logout: function () {
      localStorage.removeItem(SESSION_KEY);
      fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    },

    requireAuth: function (redirectTo) {
      const user = this.getCurrentUser();
      if (!user) {
        window.location.href = redirectTo || "login.html";
        return null;
      }
      return user;
    },
    helpers: {
      normalizeUsername,
    },
  };
})();
