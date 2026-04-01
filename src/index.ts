interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetFetcher;
  USERS_KV: KVNamespace;
  SESSIONS_KV: KVNamespace;
}

interface StoredUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash?: string;
  provider: "password" | "google";
  googleId?: string;
  avatar?: string;
  createdAt: string;
}

const SESSION_COOKIE = "finwise_token";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function normalizeEmail(email = ""): string {
  return email.trim().toLowerCase();
}

function normalizeIdentifier(identifier = ""): string {
  return identifier.trim().toLowerCase();
}

function publicUser(user: StoredUser) {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    provider: user.provider,
    createdAt: user.createdAt,
    avatar: user.avatar,
  };
}

function badRequest(message: string): Response {
  return json({ success: false, message }, 400);
}

function unauthorized(message: string): Response {
  return json({ success: false, message }, 401);
}

function makeSessionCookie(token: string, maxAge = SESSION_TTL_SECONDS): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function getSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = cookieHeader.split(";").map((item) => item.trim());
  const hit = cookies.find((item) => item.startsWith(`${SESSION_COOKIE}=`));
  return hit ? hit.slice(SESSION_COOKIE.length + 1) : null;
}

async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const useSalt = salt || crypto.randomUUID().replace(/-/g, "");
  const data = new TextEncoder().encode(`${useSalt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  const hash = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return { hash, salt: useSalt };
}

function userIdKey(userId: string): string {
  return `user:id:${userId}`;
}

function userEmailKey(email: string): string {
  return `user:email:${email}`;
}

function userUsernameKey(username: string): string {
  return `user:username:${username}`;
}

function sessionKey(token: string): string {
  return `session:${token}`;
}

async function loadUserById(env: Env, id: string): Promise<StoredUser | null> {
  if (!id) return null;
  return env.USERS_KV.get<StoredUser>(userIdKey(id), "json");
}

async function loadUserByIdentifier(env: Env, identifier: string): Promise<StoredUser | null> {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return null;

  const emailUserId = await env.USERS_KV.get(userEmailKey(normalized));
  if (emailUserId) {
    return loadUserById(env, emailUserId);
  }

  const usernameUserId = await env.USERS_KV.get(userUsernameKey(normalized));
  if (!usernameUserId) return null;
  return loadUserById(env, usernameUserId);
}

async function saveUser(env: Env, user: StoredUser): Promise<void> {
  await Promise.all([
    env.USERS_KV.put(userIdKey(user.id), JSON.stringify(user)),
    env.USERS_KV.put(userEmailKey(user.email), user.id),
    env.USERS_KV.put(userUsernameKey(user.username.toLowerCase()), user.id),
  ]);
}

async function createSession(env: Env, userId: string): Promise<string> {
  const token = crypto.randomUUID();
  await env.SESSIONS_KV.put(sessionKey(token), userId, { expirationTtl: SESSION_TTL_SECONDS });
  return token;
}

async function parseJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

async function handleSignup(request: Request, env: Env): Promise<Response> {
  const body = await parseJson<{ firstName?: string; lastName?: string; email?: string; password?: string }>(request);
  if (!body) return badRequest("Invalid JSON body.");

  const firstName = (body.firstName || "").trim();
  const lastName = (body.lastName || "").trim();
  const email = normalizeEmail(body.email || "");
  const password = body.password || "";

  if (!firstName || !lastName || !email || !password) {
    return badRequest("Missing required fields.");
  }

  if (password.length < 6) {
    return badRequest("Password must be at least 6 characters.");
  }

  const existing = await loadUserByIdentifier(env, email);
  if (existing) {
    return json({ success: false, message: "An account with this email already exists." }, 409);
  }

  const usernameBase = email.split("@")[0] || "user";
  const username = `${usernameBase}${Math.floor(Math.random() * 1000)}`;
  const { hash, salt } = await hashPassword(password);

  const user: StoredUser = {
    id: crypto.randomUUID(),
    username,
    firstName,
    lastName,
    email,
    passwordHash: `${salt}:${hash}`,
    provider: "password",
    createdAt: new Date().toISOString(),
  };

  await saveUser(env, user);
  const sessionToken = await createSession(env, user.id);

  const response = json({ success: true, user: publicUser(user) }, 201);
  response.headers.append("set-cookie", makeSessionCookie(sessionToken));
  return response;
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = await parseJson<{ identifier?: string; password?: string }>(request);
  if (!body) return badRequest("Invalid JSON body.");

  const identifier = body.identifier || "";
  const password = body.password || "";

  if (!identifier || !password) {
    return badRequest("Email/username and password are required.");
  }

  const user = await loadUserByIdentifier(env, identifier);
  if (!user || !user.passwordHash) {
    return unauthorized("Invalid username/email or password.");
  }

  const [salt, expectedHash] = user.passwordHash.split(":");
  const { hash } = await hashPassword(password, salt);
  if (hash !== expectedHash) {
    return unauthorized("Invalid username/email or password.");
  }

  const sessionToken = await createSession(env, user.id);
  const response = json({ success: true, user: publicUser(user) });
  response.headers.append("set-cookie", makeSessionCookie(sessionToken));
  return response;
}

async function handleGoogleAuth(request: Request, env: Env): Promise<Response> {
  const body = await parseJson<{ email?: string; given_name?: string; family_name?: string; sub?: string; picture?: string }>(request);
  if (!body?.email) {
    return badRequest("Missing Google profile email.");
  }

  const email = normalizeEmail(body.email);
  let user = await loadUserByIdentifier(env, email);

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      username: email.split("@")[0] || `user${Date.now()}`,
      firstName: (body.given_name || "Google").trim() || "Google",
      lastName: (body.family_name || "User").trim() || "User",
      email,
      provider: "google",
      googleId: body.sub,
      avatar: body.picture,
      createdAt: new Date().toISOString(),
    };
  } else {
    user.provider = "google";
    user.googleId = body.sub || user.googleId;
    user.avatar = body.picture || user.avatar;
  }

  await saveUser(env, user);
  const sessionToken = await createSession(env, user.id);
  const response = json({ success: true, user: publicUser(user) });
  response.headers.append("set-cookie", makeSessionCookie(sessionToken));
  return response;
}

async function requireAuthedUser(request: Request, env: Env): Promise<StoredUser | null> {
  const token = getSessionToken(request);
  if (!token) return null;

  const userId = await env.SESSIONS_KV.get(sessionKey(token));
  if (!userId) return null;

  return loadUserById(env, userId);
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({ success: true, message: "FinWise API running on Cloudflare Workers + KV." });
  }

  if (url.pathname === "/api/auth/signup" && request.method === "POST") {
    return handleSignup(request, env);
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    return handleLogin(request, env);
  }

  if (url.pathname === "/api/auth/google" && request.method === "POST") {
    return handleGoogleAuth(request, env);
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    const token = getSessionToken(request);
    if (token) {
      await env.SESSIONS_KV.delete(sessionKey(token));
    }

    const response = json({ success: true });
    response.headers.append("set-cookie", clearSessionCookie());
    return response;
  }

  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    const user = await requireAuthedUser(request, env);
    if (!user) return unauthorized("Not authenticated.");
    return json({ success: true, user: publicUser(user) });
  }

  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
