# 🚀 Quick Setup Guide for Developers

This guide will help you get the Herland Laundry System running on your local machine in under 10 minutes.

---

## ✅ Prerequisites Checklist

Before you start, make sure you have:

- [ ] **Node.js** (v18 or higher) installed
- [ ] **Git** installed

---

## 📋 Step-by-Step Setup

### Step 1: Clone the Repository

```bash
git clone -b Tea-Branch-2 --single-branch https://github.com/ilsu-vc/herland-laundry-system.git
cd herland-laundry-system
```

### Step 2: Create Environment Files

Run these commands in the **root folder** (`herland-laundry-system/`):

```bash
# Backend env file
cp herland-laundry-system-backend/.env.example herland-laundry-system-backend/.env

# Frontend client env file
cp herland-laundry-system-frontend/client/.env.example herland-laundry-system-frontend/client/.env
```

### Step 3: Configure Environment Variables

Edit the `.env` files with your actual credentials:

1. **`herland-laundry-system-backend/.env`**:
   ```env
   PORT=5000
   NODE_ENV=development
   SUPABASE_URL=https://pipjndxdustaobgonnam.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   VITE_GOOGLE_MAPS_API_KEY=AIzaSyDf8AmofnJ6skkxMRX0CRsKsQwZWyggJyA
   ```

2. **`herland-laundry-system-frontend/client/.env`**:
   ```env
   VITE_API_URL=http://localhost:5000
   VITE_SUPABASE_URL=https://pipjndxdustaobgonnam.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   VITE_GOOGLE_MAPS_API_KEY=AIzaSyDf8AmofnJ6skkxMRX0CRsKsQwZWyggJyA
   ```

### Step 4: Start Backend

Open a terminal and run:
```bash
cd herland-laundry-system-backend
npm install
npm run dev
```

Wait for this message:
```
✅ Connection Successful! Database is talking to the Backend.
🚀 Herland Backend running on http://localhost:5000
```

### Step 5: Start Frontend

Open a second terminal and run:
```bash
cd herland-laundry-system-frontend/client
npm install
npm run dev
```

Wait for this message:
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

### Step 6: Open in Browser

- **Frontend App:** http://localhost:5173
- **Backend API:** http://localhost:5000

---

## 🛑 Common Issues & Solutions

### Issue 1: "Service rates not loading on landing page"

**Symptoms:** The service rates section shows a loading spinner forever.

**Solution:**
1. Check that backend is running (you should see "✅ Connection Successful!" in terminal)
2. Verify `herland-laundry-system-frontend/client/.env` has:
   ```
   VITE_API_URL=http://localhost:5000
   ```
   (No `/api/v1` at the end!)
3. Make sure your Supabase database has the `service_items` table populated (run `database_migration.sql`)

### Issue 2: "No terminal output / Can't see backend/frontend logs"

**Solution:**
```bash
# View backend logs
docker compose logs -f backend-dev

# View frontend logs
docker compose logs -f frontend-dev
```

### Issue 3: "Port already in use"

**Symptoms:** Error like "port 5000 is already allocated"

**Solution:**
```bash
# Stop all containers
docker compose --profile dev down

# Check what's using the port (Windows)
netstat -ano | findstr :5000

# Kill the process or change the port in docker-compose.yml
```

### Issue 4: "Environment variables not working"

**Solution:**
1. Make sure you created the `.env` files (not `.env.example`)
2. Restart Docker containers after changing `.env`:
   ```bash
   docker compose --profile dev down
   docker compose --profile dev up --build
   ```

### Issue 5: "Navbar scroll cuts off sections"

**Fixed in latest version!** Pull the latest code:
```bash
git pull origin main
```

---

## 🧹 Clean Up / Reset

If things are broken and you want to start fresh:

```bash
# Stop all containers
docker compose --profile dev down

# Remove all Docker images and containers
docker system prune -af

# Start again
docker compose --profile dev up --build
```

---

## 📞 Need Help?

If you're still stuck:
1. Check the main `README.md` for more detailed documentation
2. Ask in the team chat
3. Contact the project lead

---

## 🎉 Success!

If you see both the backend and frontend URLs in your terminal, you're all set! Open http://localhost:5173 in your browser and start developing.
