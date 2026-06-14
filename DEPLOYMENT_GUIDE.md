# 🚀 Full Deployment Guide

This guide will walk you through deploying the **Herland Laundry System** to production using **Railway** for the backend, **Vercel** for the frontend, and **Supabase** for the database.

---

## 🛠️ 1. Supabase (Database & Auth)

Make sure your Supabase project is set up and has all the required tables. If not, refer to `SETUP_GUIDE.md` or run the `database_migration.sql` directly in your Supabase SQL Editor.

### Get your credentials ready
You will need the following from your Supabase project settings (`Project Settings` -> `API`):
- `Project URL`
- `anon public key`
- `service_role key`

---

## 🚂 2. Railway (Backend Deployment)

Railway is perfect for running Express.js applications seamlessly from GitHub.

### Step 1: Create a Railway Project
1. Go to [Railway.app](https://railway.app/) and sign in.
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select your personal `Laundry-Booking` repository.

### Step 2: Configure the Backend Service
Since the repository contains both frontend and backend, we need to tell Railway where the backend is.
1. After the repo is connected, click on your deployment in Railway.
2. Go to **Settings** -> **Deploy** -> **Root Directory**.
3. Type `/herland-laundry-system-backend` and press enter to set it.
4. Under **Build Command**, enter: `npm install`
5. Under **Start Command**, enter: `npm start` (or `npm run start:prod` if you have a specific production script).

### Step 3: Add Environment Variables
Go to the **Variables** tab in your Railway service and add all the required backend environment variables:

| Variable Name | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `5000` (Optional, Railway automatically assigns a port but you can provide this if required) |
| `SUPABASE_URL` | *(Your Supabase URL)* |
| `SUPABASE_ANON_KEY` | *(Your Supabase Anon Key)* |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Your Supabase Service Role Key)* |
| `VITE_GOOGLE_MAPS_API_KEY` | *(Your Google Maps API Key)* |

### Step 4: Generate a Domain
1. Go back to **Settings** -> **Environment** -> **Domains**.
2. Click **Generate Domain**.
3. Copy this generated URL (e.g., `https://your-app-production.up.railway.app`). This is your new `VITE_API_URL` for the frontend.

---

## 🔺 3. Vercel (Frontend Deployment)

Vercel is optimized for deploying Vite/React applications.

### Step 1: Create a Vercel Project
1. Go to [Vercel.com](https://vercel.com) and sign in.
2. Click **Add New** -> **Project**.
3. Import your personal `Laundry-Booking` GitHub repository.

### Step 2: Configure the Project
1. Under **Framework Preset**, select `Vite`.
2. Expand **Root Directory**, click `Edit` and select `herland-laundry-system-frontend/client`.
3. The Build Command should automatically detect `npm run build`, and Output Directory should be `dist`.

### Step 3: Add Environment Variables
Expand the **Environment Variables** section and add the frontend variables:

| Variable Name | Value |
| --- | --- |
| `VITE_API_URL` | *(Your Railway Backend URL from the previous step)* |
| `VITE_SUPABASE_URL` | *(Your Supabase URL)* |
| `VITE_SUPABASE_ANON_KEY` | *(Your Supabase Anon Key)* |
| `VITE_GOOGLE_MAPS_API_KEY` | *(Your Google Maps API Key)* |

### Step 4: Deploy
Click **Deploy**! Once Vercel finishes building, your frontend will be live on a Vercel subdomain.

---

## ✅ 4. Final Checklist

1. **Test the Application**: Go to your Vercel URL and check if the Service Rates are loading. If they are, it means the frontend is successfully talking to your Railway backend!
2. **CORS Update (If Needed)**: Make sure the Vercel URL is allowed in your backend's CORS policy. You might need to update an environment variable or code in your backend if it strictly checks the origin.
3. **Database Seed**: Double-check that your `service_items` table is fully populated so the system functions properly.

🎉 **Congratulations! Your system is now deployed and live!**
