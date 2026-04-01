(function () {
  const SESSION_KEY = "finwise_session_v2";
  const USERS_KEY = "finwise_users_v1";

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

  function loadUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function mapToSessionUser(user) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      username: user.username,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
    };
  }

  async function signup(firstName, lastName, email, password) {
    const normalizedEmail = normalizeEmail(email);
    const users = loadUsers();

    if (users.some((user) => user.email === normalizedEmail)) {
      return { success: false, message: "An account with that email already exists." };
    }

    const username = normalizedEmail.split("@")[0];
    const user = {
      id: Date.now(),
      firstName: (firstName || "").trim(),
      lastName: (lastName || "").trim(),
      email: normalizedEmail,
      username,
      password: password || "",
    };

    users.push(user);
    saveUsers(users);

    const sessionUser = mapToSessionUser(user);
    storeSessionUser(sessionUser);
    return { success: true, user: sessionUser };
  }

  async function login(identifier, password) {
    const key = normalizeUsername(identifier);
    const users = loadUsers();
    const user = users.find((candidate) => candidate.email === key || candidate.username === key);

    if (!user || user.password !== (password || "")) {
      return { success: false, message: "Invalid credentials." };
    }

    const sessionUser = mapToSessionUser(user);
    storeSessionUser(sessionUser);
    return { success: true, user: sessionUser };
  }

  async function upsertGoogleUser(profile) {
    const email = normalizeEmail(profile?.email);
    if (!email) return { success: false, message: "Missing Google account email." };

    const users = loadUsers();
    let user = users.find((candidate) => candidate.email === email);

    if (!user) {
      user = {
        id: Date.now(),
        firstName: (profile?.given_name || "").trim(),
        lastName: (profile?.family_name || "").trim(),
        email,
        username: email.split("@")[0],
        password: "",
      };
      users.push(user);
      saveUsers(users);
    }

    const sessionUser = mapToSessionUser(user);
    storeSessionUser(sessionUser);
    return { success: true, user: sessionUser };
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
      return getStoredSessionUser();
    },
    logout: function () {
      localStorage.removeItem(SESSION_KEY);
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
