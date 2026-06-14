# 🚀 Herland Laundry System Deployment Guide

This guide covers deploying the **Frontend** to Vercel and the **Backend** to Railway.

## 🌟 Prerequisites
Before starting, ensure you have:
1. Pushed your code to your GitHub repository (e.g., `Lance-Siyhian16/Laundry-Booking`).
2. Your Supabase project set up and its API keys (`SUPABASE_URL`, `SUPABASE_KEY`, etc.) ready.

---

## 🚄 1. Deploying the Backend to Railway

Railway is excellent for Node.js backends. It will automatically detect your `package.json` and start the Express server.

### Steps:
1. Go to [Railway.app](https://railway.app/) and log in with GitHub.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your repository (`Laundry-Booking`).
4. **Important Configuration:** Since the backend is in a subfolder, you need to configure the Root Directory.
   - Go to the newly created service's **Settings**.
   - Under **Build**, find **Root Directory** and set it to: `/herland-laundry-system-backend`
5. Go to the **Variables** tab and add your environment variables:
   - `PORT=5000` (Optional, Railway assigns one automatically, but good for consistency)
   - `NODE_ENV=production`
   - `SUPABASE_URL=your_supabase_url`
   - `SUPABASE_ANON_KEY=your_supabase_anon_key`
   - `SUPABASE_KEY=your_supabase_key`
   - `SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key`
6. Go to the **Settings** tab → **Environment**, and under **Domains**, click **Generate Domain**.
   - **Save this URL!** (e.g., `https://your-backend-railway.app`). You will need it for the frontend.

---

## 🔺 2. Deploying the Frontend to Vercel

Vercel is optimized for Vite/React applications.

### Steps:
1. Go to [Vercel.com](https://vercel.com/) and log in with GitHub.
2. Click **Add New** → **Project**.
3. Import your GitHub repository (`Laundry-Booking`).
4. In the **Configure Project** screen:
   - **Framework Preset**: Vite
   - **Root Directory**: Click "Edit" and select `herland-laundry-system-frontend/client`.
5. Open the **Environment Variables** section and add:
   - `VITE_API_URL=https://your-backend-railway.app/api/v1` *(Replace with your generated Railway domain)*
   - `VITE_SUPABASE_URL=your_supabase_url`
   - `VITE_SUPABASE_ANON_KEY=your_supabase_anon_key`
   - `VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key` (if applicable)
6. Click **Deploy**. Vercel will build your frontend and assign a live URL!

---

## 🔄 3. Update CORS on Backend (Important)

Once your frontend is deployed on Vercel, it gets a domain (e.g., `https://laundry-booking.vercel.app`). You must allow this domain to talk to your backend.

1. Go back to **Railway** → your Backend service → **Variables**.
2. Add a new variable: `FRONTEND_URL=https://your-vercel-domain.vercel.app`
3. Railway will auto-redeploy the backend.

*(Note: Your backend code already uses `cors()`, which by default allows all origins. If you restrict it later in `src/server.js`, use this variable).*

---

## 🎉 You're Live!
- **Frontend:** Visit your Vercel URL.
- **Backend API:** Visit your Railway URL.
- Any new commits pushed to your `main` branch on GitHub will now **automatically trigger redeployments** on both Vercel and Railway!
