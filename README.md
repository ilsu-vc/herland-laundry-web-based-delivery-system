# 🧺 Herland Laundry System

A full-stack laundry booking and management system built with **React + Vite** (frontend) and **Express.js** (backend), powered by **Supabase** for authentication and database.

---

## 📦 Project Structure

```
herland-laundry-system-main/
├── docker-compose.yml              ← One file to run everything
├── .env.example                    ← Root env vars (for production Docker builds)
│
├── herland-laundry-system-backend/
│   ├── Dockerfile                  ← Multi-stage: dev + production
│   ├── .env.example                ← Backend secrets template
│   └── src/                        ← Express API source code
│
├── herland-laundry-system-frontend/
│   ├── Dockerfile                  ← Multi-stage: dev + builder + production
│   ├── nginx.conf                  ← Production nginx config (SPA routing)
│   └── client/
│       ├── .env.example            ← Frontend secrets template
│       └── src/                    ← React source code
│
└── database_migration.sql          ← Supabase schema + seed data
```

---

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** installed and running — [Download here](https://www.docker.com/products/docker-desktop/)
- **Git** installed

### 1. Clone the repository

```bash
git clone -b main --single-branch https://github.com/ilsu-vc/herland-laundry-system.git
cd herland-laundry-system-main
```

### 2. Set up environment variables

Create `.env` files from the provided templates:

**For Backend:**
```bash
cp herland-laundry-system-backend/.env.example herland-laundry-system-backend/.env
```

**For Frontend:**
```bash
cp herland-laundry-system-frontend/client/.env.example herland-laundry-system-frontend/client/.env
```

**For Root (production builds only):**
```bash
cp .env.example .env
```

> ⚠️ **IMPORTANT:** Fill in the actual values in each `.env` file (Supabase keys, Google Maps API key, etc.). Ask the project lead for the credentials. The system will NOT work without proper environment variables.

> ⚠️ **Never commit `.env` files.** They are already listed in `.gitignore`.

### 3. Start the application

#### 🔧 Development mode (with hot-reload)

```bash
docker compose --profile dev up --build
```

**Wait for these messages in the terminal:**

Backend should show:
```
✅ Connection Successful! Database is talking to the Backend.
🚀 Herland Backend running on http://localhost:5000
```

Frontend should show:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:5173       |
| Backend  | http://localhost:5000       |

- Edit any file in your IDE → changes reflect instantly inside the containers.
- Press `Ctrl + C` to stop, or run `docker compose --profile dev down`.

#### 🏭 Production mode (optimized build)

```bash
docker compose --profile prod up --build -d
```

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost (port 80)  |
| Backend  | http://localhost:5000       |

- The frontend is compiled into static files and served by **nginx** (~30 MB image).
- The backend runs with plain **Node.js** (no nodemon) (~60 MB image).
- Stop with: `docker compose --profile prod down`

---

## 🖥️ Running WITHOUT Docker (native)

If Docker is too heavy for your machine, you can run the services directly:

**Terminal 1 — Backend:**
```bash
cd herland-laundry-system-backend
npm install
npm run dev
```

You should see:
```
✅ Connection Successful! Database is talking to the Backend.
🚀 Herland Backend running on http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd herland-laundry-system-frontend/client
npm install
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

The frontend runs at `http://localhost:5173` and the backend at `http://localhost:5000`.

---

## 🔧 Troubleshooting

### Service rates not loading on landing page

**Symptoms:** The service rates section shows a loading spinner forever or is empty.

**Causes & Solutions:**

1. **Backend not running:** Make sure the backend is running and you see the "✅ Connection Successful!" message.

2. **Wrong API URL:** Check `herland-laundry-system-frontend/client/.env` and ensure:
   ```
   VITE_API_URL=http://localhost:5000
   ```
   (No `/api/v1` at the end!)

3. **Database not seeded:** The `service_items` table might be empty. Run the `database_migration.sql` script in your Supabase SQL editor.

4. **CORS issues:** If you see CORS errors in the browser console, make sure the backend `.env` has the correct frontend URL allowed.

### No terminal output for backend/frontend

**Symptoms:** After running `docker compose --profile dev up --build`, you don't see the expected "🚀 Herland Backend running..." or Vite messages.

**Solutions:**

1. **Check Docker logs:**
   ```bash
   docker compose logs -f backend-dev
   docker compose logs -f frontend-dev
   ```

2. **Rebuild from scratch:**
   ```bash
   docker compose --profile dev down
   docker system prune -f
   docker compose --profile dev up --build
   ```

3. **Check environment variables:** Make sure all `.env` files are created and filled with valid values.

### Navbar scroll not centering sections

**Fixed in latest version.** The navbar now accounts for the fixed header height when scrolling to sections.

---

## 🌐 Live Deployment

| Layer    | Platform | URL               |
|----------|----------|-------------------|
| Frontend | Vercel   | [https://laundry-booking-rho.vercel.app](https://laundry-booking-rho.vercel.app) |
| Backend  | Render   | [https://laundry-booking-5gb4.onrender.com](https://laundry-booking-5gb4.onrender.com) |
| Database | Supabase | *(managed)*         |

Both Vercel and Render track the `main` branch. Pushing to `main` automatically triggers a new deployment.

👉 **Check out the [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed, step-by-step instructions on deploying the project.**

---

## 🐳 Docker Architecture

```
┌──────────────────────────────────────────────────┐
│              docker-compose.yml                  │
│                                                  │
│  ┌─────────────────┐    ┌──────────────────────┐ │
│  │  backend (Node)  │    │  frontend (nginx)    │ │
│  │  Port: 5000      │◄───│  Port: 80 (prod)     │ │
│  │                  │    │  Port: 5173 (dev)    │ │
│  └────────┬─────────┘    └──────────────────────┘ │
│           │                                       │
│           ▼                                       │
│  ┌─────────────────┐                              │
│  │  Supabase (cloud)│                             │
│  │  Auth + Database │                             │
│  └──────────────────┘                              │
└──────────────────────────────────────────────────┘
```

### What Docker provides:

- **Consistency** — Every developer and the client's server run the exact same Node 20 + Alpine Linux environment.
- **Isolation** — The app's dependencies never conflict with anything else on the machine.
- **One-command setup** — `docker compose --profile dev up --build` and everything works.
- **Production-ready images** — The `prod` profile builds optimized, lightweight images that can be deployed to any server.
- **Health checks** — Docker automatically monitors the backend API and restarts it if it goes down.

---

## 📋 Useful Docker Commands

| Command | What it does |
|---------|-------------|
| `docker compose --profile dev up --build` | Start dev mode (hot-reload) |
| `docker compose --profile prod up --build -d` | Start production mode (background) |
| `docker compose --profile dev down` | Stop dev containers |
| `docker compose --profile prod down` | Stop production containers |
| `docker compose --profile dev --profile prod down` | Stop ALL containers |
| `docker compose logs -f backend-dev` | Tail backend logs (dev) |
| `docker compose logs -f frontend-prod` | Tail frontend logs (prod) |
| `docker system prune -f` | Clean up unused images/containers |

---

## 🔑 Environment Variables Reference

### Backend (`herland-laundry-system-backend/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | API server port (default: `5000`) |
| `NODE_ENV` | `development` or `production` |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_KEY` | Supabase API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin access) |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key |

### Frontend (`herland-laundry-system-frontend/client/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL (default: `http://localhost:5000/api/v1`) |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key |

---

## 👥 Team

Built by Team Vybe for Herland Laundry.
