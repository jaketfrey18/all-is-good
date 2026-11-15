# Auth testing
- Admin seeded from backend/.env (ADMIN_EMAIL / ADMIN_PASSWORD); see /app/memory/test_credentials.md
- POST /api/auth/login returns {token, user}; send `Authorization: Bearer <token>` for admin routes
- GET /api/auth/me returns admin user; without token -> 401
- Admin-only: POST/PUT/DELETE /api/projects, /api/admin/dropbox/*
- 5 failed logins for same ip+email -> 429 for 15 min
