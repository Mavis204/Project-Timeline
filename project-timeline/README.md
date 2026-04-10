# Project Timeline Tracker — Full-Stack

React + Vite frontend · Express + Node.js backend · PostgreSQL database

---

## Project Structure

```
project-timeline/
│
├── client/                          ← React + Vite frontend
│   ├── index.html                   ← HTML shell (CSS variables live here)
│   ├── vite.config.js               ← Dev server + /api proxy to Express
│   ├── package.json
│   └── src/
│       ├── main.jsx                 ← ReactDOM.createRoot entry point
│       ├── App.jsx                  ← All UI components (6000+ lines, self-contained)
│       ├── services/
│       │   └── api.js               ← ★ THE ONLY FILE THAT TALKS TO EXPRESS
│       ├── utils/
│       │   ├── dateUtils.js         ← Pure date helpers (fd, pd, addD, fmt, …)
│       │   ├── plotUtils.js         ← Gantt plotting algorithm (plotPartialDays)
│       │   └── stateManager.js      ← bootstrapState, migrateState, mkInitialState
│       └── constants/
│           └── index.js             ← PRIORITIES, WT_BASE, ALL_SLOTS, DEF_SETTINGS
│
└── server/                          ← Express + Node.js backend
    ├── index.js                     ← App entry: middleware, routes, static serving
    ├── package.json
    ├── routes/
    │   └── state.js                 ← GET/PUT /api/state
    ├── controllers/
    │   └── stateController.js       ← PostgreSQL queries
    ├── middleware/
    │   └── requireAuth.js           ← Auth guard stub (enable after adding login)
    └── db/
        ├── pool.js                  ← pg.Pool singleton
        └── schema.sql               ← CREATE TABLE statements
```

---

## Quick Start

### 1. PostgreSQL

```bash
# Create database
createdb project_timeline

# Run schema (creates users, user_sessions, and app_state tables)
psql project_timeline < server/db/schema.sql
```

### 2. Environment Variables

```bash
cp .env.example .env
# Edit .env with your database credentials and SESSION_SECRET
```

### 3. Server

```bash
cd server
npm install
node index.js
# ✓ PostgreSQL connected
# ✓ Server listening on http://localhost:3001
```

### 4. Client

```bash
cd client
npm install
npm run dev
# → http://localhost:5173
```

---

## Authentication

The app includes full user authentication with:

- **User Registration**: `/api/auth/register` - Create new accounts
- **Login**: `/api/auth/login` - Authenticate users
- **Session Management**: Express sessions stored in PostgreSQL
- **Protected Routes**: State endpoints require authentication

### How It Works

1. User registers/logs in via the `AuthScreen` component
2. Session is created and stored in the `user_sessions` table
3. User data is fetched on app load (`api.getMe()`)
4. All API requests include `credentials: 'include'` to send session cookies
5. State is saved/loaded under the authenticated user's ID
6. Logout clears the session

### Auth Endpoints

```
POST   /api/auth/register  { email, password }  → { userId, email }
POST   /api/auth/login     { email, password }  → { userId, email }
POST   /api/auth/logout                         → 204
GET    /api/auth/me                             → { userId, email }
```

State endpoints are protected:

```
GET    /api/state                               → requires auth → { state }
PUT    /api/state          { state }            → requires auth → 204
GET    /api/state/legacy                        → requires auth → { legacy }
```

---

## How the Migration Works

The only file that changes between localStorage and PostgreSQL is
**`client/src/services/api.js`**.

Every method has a comment showing exactly what to replace:

```js
// CURRENT (localStorage):
async loadState() {
  try { const raw = localStorage.getItem(SK); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
},

// FULL-STACK (replace body with):
async loadState() {
  const res = await fetch('/api/state', { credentials: 'include' });
  return res.ok ? res.json() : null;
},
```

The Vite dev proxy (`vite.config.js`) forwards `/api/*` to Express on port 3001,
so `fetch('/api/state')` works identically in development.

---

## API Endpoints

| Method | Path              | Controller | Description               |
| ------ | ----------------- | ---------- | ------------------------- |
| GET    | /api/state        | getState   | Load full app state       |
| PUT    | /api/state        | putState   | Save full app state       |
| GET    | /api/state/legacy | getLegacy  | Migration helper (→ null) |
| GET    | /api/health       | inline     | Server health check       |

---

## State Shape (what PostgreSQL stores as JSONB)

```js
{
  settings: {
    excludeDays: [5],           // day-of-week numbers (0=Sun, 5=Fri)
    holidays: ["2026-04-09"],   // ISO date strings
    priorityColors: {           // optional overrides
      hp: "#ef4444",
      mp: "#f97316",
      lp: "#3b82f6"
    }
  },
  teams: [{ id: "t1", name: "Technical Team" }],
  activeTeamId: "t1",
  teamData: {
    "t1": {
      projects: [
        { id: "p1", name: "HRIS", members: ["JASMINE"], color: "#0ea5e9" }
      ],
      currentTimeline: {
        id: "abc123",
        name: "Apr 1, 2026",
        plotStart: "2026-04-01",
        finishedDate: null,
        tasks: {
          "p1": {
            plotStart: "2026-04-01",
            priorityHours: { hp_bug: 8, hp_nf: 24, mp_enh: 16 }
          }
        }
      },
      archives: [...],  // same shape as currentTimeline but with finishedDate set
      trash: [...]      // same shape but with trashedAt set
    }
  }
}
```

---

## Adding Authentication (next steps for Copilot)

1. `npm install express-session connect-pg-simple bcryptjs` (in server/)
2. Add `users` table to `schema.sql`
3. Add session middleware in `server/index.js`
4. Create `server/routes/auth.js` with POST `/api/auth/login` and `/register`
5. Uncomment `requireAuth` in `server/routes/state.js`
6. Update `getUserId()` in `stateController.js` to use `req.session.userId`
7. Update `api.js` on client to include `credentials: 'include'` (already stubbed)

---

## Production Build

```bash
cd client && npm run build          # outputs to client/dist/
NODE_ENV=production node server/index.js   # Express serves client/dist/
```

---

## Docker

### Production (one command)

```bash
cp .env.example .env          # edit POSTGRES_PASSWORD at minimum
docker compose up --build -d
```

That's it. Visit **http://localhost** (or the port set by `CLIENT_PORT`).

What runs:
| Container | Role | Internal port |
|-----------|------|---------------|
| `db` | PostgreSQL 16 | 5432 (internal only) |
| `server` | Express API | 3001 (internal only) |
| `client` | nginx serving React + proxying /api | 80 → host |

The schema (`server/db/schema.sql`) runs automatically on first start via
PostgreSQL's `docker-entrypoint-initdb.d/` mechanism.

### Development (hot reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

| Service          | URL                   |
| ---------------- | --------------------- |
| React (Vite HMR) | http://localhost:5173 |
| Express API      | http://localhost:3001 |
| PostgreSQL       | localhost:5432        |

Edit files locally — the server restarts via nodemon, the client hot-reloads via Vite.

### Useful commands

```bash
# View logs
docker compose logs -f

# Logs for one service
docker compose logs -f server

# Restart just the server after code changes (prod)
docker compose up --build -d server

# Open a psql shell
docker compose exec db psql -U postgres -d project_timeline

# Wipe everything including the database volume
docker compose down -v
```
