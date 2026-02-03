This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## PhotoLoad – Google login (Supabase)

1. **Create a Supabase project** at [supabase.com](https://supabase.com) and get your project URL and anon key (Dashboard → Settings → API).
2. **Enable Google auth**: Dashboard → Authentication → Providers → Google. Add your Google OAuth Client ID and Secret (from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)).
3. **Redirect URL**: In Supabase → Authentication → URL Configuration, add `http://localhost:3000/auth/callback` (and your production URL later).
4. **Env vars**: Copy `.env.local.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

5. **Photos (upload/gallery)**: In Supabase go to **SQL Editor** → New query → paste the contents of `supabase-setup.sql` → Run. This creates the `photos` table and the `photos` storage bucket with policies so users can only see and delete their own photos.

### How to test that the database is working

1. **In Supabase Dashboard**
   - **Table Editor** → open **photos**. After you upload in the app, new rows should appear (user_id, path, filename, created_at).
   - **Storage** → open the **photos** bucket. After upload you should see a folder named with your user UUID; inside it are the image files.
   - **Authentication** → **Users**: you should see your Google account there after signing in.

2. **In the app**
   - Sign in with Google (top nav **Home** → Sign in with Google).
   - Go to **Upload** → click **Select Images** → pick one or more images. You should see progress, then the list clears and **Gallery** shows the new photos.
   - If nothing happens: check for a red error message on the Upload page, or open the browser **Developer Tools** (F12) → **Console** and look for "Storage upload error" or "Photos insert error".

3. **If the bucket doesn’t exist**
   - In Supabase go to **Storage** → **New bucket** → name: **photos**, set to **Private** → Create. Then run only the storage policy parts of `supabase-setup.sql` (the four `CREATE POLICY` on `storage.objects`).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
