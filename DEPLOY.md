# PhotoLoad: GitHub + Deploy (Phase 2)

## Part 1: Put PhotoLoad on GitHub

### 1. Create a new repo on GitHub

1. Go to [github.com](https://github.com) and sign in.
2. Click **"+"** (top right) → **New repository**.
3. **Repository name:** `photoload` (or `PhotoLoad`).
4. **Public**, leave **"Add a README"** unchecked (you already have one).
5. Click **Create repository**.

### 2. Push your app from your machine

Open a terminal and run these from the **photoload** folder (the one with `package.json`):

```bash
cd /Users/shabia/Apps/Cursor-PhotoLibrary/photoload

# If this folder isn’t a git repo yet:
git init
git add .
git commit -m "PhotoLoad: initial commit (Next.js + Supabase)"

# Use YOUR GitHub repo URL (replace YOUR_USERNAME with your GitHub username):
git remote add origin https://github.com/YOUR_USERNAME/photoload.git

# Push (use main or master depending on your default branch):
git branch -M main
git push -u origin main
```

If GitHub asks you to sign in, use your GitHub account (or a Personal Access Token if you use 2FA).

**Important:** `.env.local` is in `.gitignore`, so it will **not** be pushed. You’ll add the same env vars again when you deploy.

---

## Part 2: Run it on a server (Vercel)

Vercel runs Next.js apps and connects to GitHub so every push can auto-deploy.

### 1. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. Click **Add New…** → **Project**.
3. **Import** the `photoload` repo (select it from the list).
4. **Root Directory:** leave as **`.`** (repo root = photoload app).
5. **Environment Variables:** click **Add** and add:
   - **Name:** `NEXT_PUBLIC_SUPABASE_URL`  
     **Value:** your Supabase project URL (same as in `.env.local`).
   - **Name:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
     **Value:** your Supabase anon key (same as in `.env.local`).
6. Click **Deploy**. Wait for the build to finish.

### 2. Get your live URL

When the deploy finishes, Vercel shows a URL like:

`https://photoload-xxxx.vercel.app`

Copy that URL; you’ll use it in the next step.

### 3. Tell Supabase and Google about the live URL

**Supabase**

1. **Authentication** → **URL Configuration**.
2. **Site URL:** set to your Vercel URL, e.g. `https://photoload-xxxx.vercel.app`.
3. **Redirect URLs:** add:
   - `https://photoload-xxxx.vercel.app`
   - `https://photoload-xxxx.vercel.app/auth/callback`
4. Save.

**Google (only if you use Google sign-in)**

1. [Google Cloud Console](https://console.cloud.google.com) → your project → **APIs & Services** → **Credentials**.
2. Open your **PhotoLoad** OAuth client (Web application).
3. **Authorized redirect URIs:** you already have the Supabase callback. You do **not** add the Vercel URL here; Google redirects to Supabase, then Supabase redirects to your app. So no change needed if Supabase redirect URLs are set as above.
4. **Authorized JavaScript origins (optional):** you can add your Vercel URL, e.g. `https://photoload-xxxx.vercel.app`, then Save.

### 4. Test the live app

1. Open your Vercel URL in the browser.
2. Sign in with Google.
3. Upload a photo and open Gallery. If anything fails, check the browser console and Vercel **Deployments** → **Functions** / **Logs** for errors.

---

## Summary

| Step | Where | What |
|------|--------|------|
| 1 | GitHub | New repo `photoload`, then push from `photoload` folder. |
| 2 | Vercel | Import repo, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, deploy. |
| 3 | Supabase | Set Site URL and Redirect URLs to your Vercel URL (and `/auth/callback`). |
| 4 | Browser | Open Vercel URL and test sign-in + upload + gallery. |

After that, every push to `main` on GitHub can auto-deploy to Vercel so your “second test” runs on a real server.
