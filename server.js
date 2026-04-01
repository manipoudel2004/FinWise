const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const TOKEN_COOKIE = 'finwise_token';
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

function ensureUsersFile() {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, '[]', 'utf8');
  }
}

function readUsers() {
  ensureUsersFile();
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function normalizeEmail(email = '') {
  return email.trim().toLowerCase();
}

function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    provider: user.provider,
    createdAt: user.createdAt,
    lastLoginAt: new Date().toISOString(),
  };
}

function issueToken(res, userId) {
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function authMiddleware(req, res, next) {
  const token = req.cookies[TOKEN_COOKIE];
  if (!token) return res.status(401).json({ success: false, message: 'Not authenticated.' });

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Session expired.' });
  }
}

app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'FinWise backend is running.' });
});

app.post('/api/auth/signup', (req, res) => {
  const { firstName, lastName, email, password } = req.body || {};
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  }

  const users = readUsers();
  const normalizedEmail = normalizeEmail(email);

  if (users.some((u) => u.email === normalizedEmail)) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
  }

  const username = normalizedEmail.split('@')[0] || `user${users.length + 1}`;
  const user = {
    id: crypto.randomUUID(),
    username,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    email: normalizedEmail,
    passwordHash: bcrypt.hashSync(password, 10),
    provider: 'password',
    createdAt: new Date().toISOString(),
    profile: {
      riskProfile: null,
      savedGoals: [],
      calculators: {},
    },
  };

  users.push(user);
  writeUsers(users);
  issueToken(res, user.id);

  return res.status(201).json({ success: true, user: toPublicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Email/username and password are required.' });
  }

  const users = readUsers();
  const normalizedIdentifier = String(identifier).trim().toLowerCase();
  const user = users.find(
    (u) => u.email === normalizedIdentifier || String(u.username || '').toLowerCase() === normalizedIdentifier
  );

  if (!user || !user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ success: false, message: 'Invalid username/email or password.' });
  }

  issueToken(res, user.id);
  return res.json({ success: true, user: toPublicUser(user) });
});

app.post('/api/auth/google', (req, res) => {
  const profile = req.body || {};
  if (!profile.email) {
    return res.status(400).json({ success: false, message: 'Missing Google profile email.' });
  }

  const users = readUsers();
  const normalizedEmail = normalizeEmail(profile.email);
  let user = users.find((u) => u.email === normalizedEmail);

  if (!user) {
    const fullName = profile.name || '';
    const [firstName = 'Google', ...rest] = fullName.trim().split(' ');
    const lastName = rest.join(' ') || 'User';
    user = {
      id: crypto.randomUUID(),
      username: normalizedEmail.split('@')[0] || `user${users.length + 1}`,
      firstName,
      lastName,
      email: normalizedEmail,
      provider: 'google',
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
    user.provider = 'google';
    user.googleId = profile.sub || user.googleId;
    user.avatar = profile.picture || user.avatar;
  }

  writeUsers(users);
  issueToken(res, user.id);
  return res.json({ success: true, user: toPublicUser(user) });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(TOKEN_COOKIE);
  res.json({ success: true });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const users = readUsers();
  const user = users.find((u) => u.id === req.auth.sub);
  if (!user) {
    return res.status(401).json({ success: false, message: 'User not found.' });
  }
  return res.json({ success: true, user: toPublicUser(user) });
});

app.use(express.static(__dirname));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`FinWise backend listening on http://localhost:${PORT}`);
});
