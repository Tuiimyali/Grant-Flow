# Grant Management App

A Next.js application for discovering, tracking, and writing grant applications — backed by Supabase.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database / Auth**: Supabase (PostgreSQL + Row Level Security)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` with your Supabase project credentials (see [Environment Variables](#environment-variables)).

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase project anon/public key |

Both values are found in your Supabase dashboard under **Project Settings → API**.

---

## Deploying to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "ready for deployment"
git push
```

### 2. Import project on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel auto-detects Next.js — no build settings changes needed

### 3. Add environment variables

In Vercel → Project → **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

Apply to **Production**, **Preview**, and **Development** environments.

### 4. Configure Supabase Auth redirect URLs

In your Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: add `https://your-app.vercel.app/**`

For preview deployments also add: `https://*.vercel.app/**`

### 5. Deploy

Click **Deploy** in Vercel, or push to main — Vercel deploys automatically.

---

## Project Structure

```
app/
  (dashboard)/      # Protected routes (grants, drafts, pipeline, etc.)
  auth/             # Sign in / sign up pages
  page.tsx          # Root redirect
lib/
  hooks/            # React hooks (useGrants, useDrafts, ...)
  scoring/          # Fit score calculation
  supabase/         # Supabase client (browser + server + middleware)
  types/            # Database types
  utils/            # Formatting, scoring utilities
components/         # Shared UI components
middleware.ts       # Auth session refresh + route protection
```
