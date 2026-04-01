(function () {
  const USERS_KEY = "finwise_users_v1";
  const SESSION_KEY = "finwise_session_v1";

  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function hashPassword(password) {
    // Lightweight obfuscation for static hosting demo apps.
    // Replace with server-side hashing (bcrypt/argon2) in production.
    return btoa(unescape(encodeURIComponent(password))).split("").reverse().join("");
  }

  function createSession(user) {
    const safeUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      provider: user.provider,
      createdAt: user.createdAt,
      lastLoginAt: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
    return safeUser;
  }

  function signup(firstName, lastName, email, password) {
    const users = getUsers();
    const normalizedEmail = email.toLowerCase();

    if (users.some((u) => u.email === normalizedEmail)) {
      return { success: false, message: "An account with this email already exists." };
    }

    const user = {
      id: crypto.randomUUID(),
      firstName,
      lastName,
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      provider: "password",
      createdAt: new Date().toISOString(),
      profile: {
        riskProfile: null,
        savedGoals: [],
        calculators: {},
      },
    };

    users.push(user);
    saveUsers(users);
    createSession(user);

    return { success: true, user: createSession(user) };
  }

  function login(email, password) {
    const users = getUsers();
    const normalizedEmail = email.toLowerCase();
    const match = users.find(
      (u) => u.email === normalizedEmail && u.passwordHash === hashPassword(password)
    );

    if (!match) {
      return { success: false, message: "Invalid email or password." };
    }

    return { success: true, user: createSession(match) };
  }

  function upsertGoogleUser(profile) {
    const users = getUsers();
    const normalizedEmail = (profile.email || "").toLowerCase();
    let user = users.find((u) => u.email === normalizedEmail);

    if (!user) {
      const fullName = profile.name || "";
      const [firstName = "Google", ...rest] = fullName.trim().split(" ");
      const lastName = rest.join(" ") || "User";

      user = {
        id: crypto.randomUUID(),
        firstName,
        lastName,
        email: normalizedEmail,
        provider: "google",
        googleId: profile.sub,
        avatar: profile.picture,
        createdAt: new Date().toISOString(),
        profile: {
          riskProfile: null,
          savedGoals: [],
          calculators: {},
        },
      };
      users.push(user);
    } else {
      user.provider = "google";
      user.googleId = profile.sub || user.googleId;
      user.avatar = profile.picture || user.avatar;
    }

    saveUsers(users);
    return { success: true, user: createSession(user) };
  }

  function decodeJwtPayload(token) {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  }

  function handleGoogleCredentialResponse(response, onSuccess, onError) {
    try {
      const profile = decodeJwtPayload(response.credential);
      if (!profile?.email) throw new Error("Missing Google profile email");
      const result = upsertGoogleUser(profile);
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
      try {
        return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      } catch {
        return null;
      }
    },
    logout: function () {
      localStorage.removeItem(SESSION_KEY);
    },
  };
})();
