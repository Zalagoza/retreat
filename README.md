# Kia Memoirs (photo library)

1. Copy .env.example to .env.local and fill it in (Neon Postgres, Vercel Blob, admin login, SESSION_SECRET).
2. npm install
3. npm run dev
4. Open /admin/login, upload photos, view analytics at /admin/analytics.

Tables are created automatically on first query.
Location (country/city) comes from Vercel's edge headers, so it only fills in once deployed on Vercel.

