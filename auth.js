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

  function normalizeEmail(email) {
    return (email || "").trim().toLowerCase();
  }

  function normalizeUsername(username) {
    return (username || "").trim().toLowerCase();
  }

  function deriveUsernameFromEmail(email) {
    return normalizeEmail(email).split("@")[0] || "user";
  }

  function buildSessionUser(user) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      provider: user.provider,
      createdAt: user.createdAt,
      lastLoginAt: new Date().toISOString(),
    };
  }

  function createSession(user) {
    const safeUser = buildSessionUser(user);
    localStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
    return safeUser;
  }

  function findUserByLoginIdentifier(users, identifier) {
    const normalizedIdentifier = (identifier || "").trim().toLowerCase();
    if (!normalizedIdentifier) return null;
    return users.find(
      (u) => u.email === normalizedIdentifier || u.username === normalizedIdentifier
    );
  }

  function validateSession(sessionCandidate) {
    if (!sessionCandidate?.id || !sessionCandidate?.email) return null;

    const users = getUsers();
    const user = users.find(
      (u) =>
        u.id === sessionCandidate.id &&
        u.email === normalizeEmail(sessionCandidate.email)
    );

    if (!user) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    const refreshedSession = buildSessionUser(user);
    localStorage.setItem(SESSION_KEY, JSON.stringify(refreshedSession));
    return refreshedSession;
  }

  function signup(firstName, lastName, email, password) {
    const users = getUsers();
    const normalizedEmail = normalizeEmail(email);

    if (users.some((u) => u.email === normalizedEmail)) {
      return { success: false, message: "An account with this email already exists." };
    }

    const user = {
      id: crypto.randomUUID(),
      username: deriveUsernameFromEmail(normalizedEmail),
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

    return { success: true, user: createSession(user) };
  }

  function login(identifier, password) {
    const users = getUsers();
    const user = findUserByLoginIdentifier(users, identifier);

    if (!user || user.passwordHash !== hashPassword(password)) {
      return { success: false, message: "Invalid username/email or password." };
    }

    return { success: true, user: createSession(user) };
  }

  function upsertGoogleUser(profile) {
    const users = getUsers();
    const normalizedEmail = normalizeEmail(profile.email);
    let user = users.find((u) => u.email === normalizedEmail);

    if (!user) {
      const fullName = profile.name || "";
      const [firstName = "Google", ...rest] = fullName.trim().split(" ");
      const lastName = rest.join(" ") || "User";

      user = {
        id: crypto.randomUUID(),
        username: deriveUsernameFromEmail(normalizedEmail),
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
      user.username = user.username || deriveUsernameFromEmail(normalizedEmail);
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
        const raw = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
        return validateSession(raw);
      } catch {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
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
