# ALL IS GOOD — Cooked World

## Original problem statement
User uploaded a landing mockup (no text spec) and said "Start the task now". Mockup: nav (Home/Projects/Archive/Studio/Contact + search/bell/help/profile), warm coral/cream illustrated hero (sun, clouds, red swoosh, LA skyline + palms, golden wireframe terrain, flowers), fortune-cookie search bar "All is good. Search the Cooked World..." + ENTER, category row PROJECTS / WORLDS / MEDIA / PRESENTATIONS, 3D coverflow of GWA, Yakshalokaus, Jasmin's Journey, WBA, Riley's Magical Meals.
User choices: full Dropbox OAuth + real file browsing/preview/search; JWT admin password login (single seeded admin); layered CSS/SVG parallax hero; agent picks fonts. Project images not supplied yet (AI-generated covers used).

## Architecture
- Backend FastAPI (server.py, auth.py, dropbox_svc.py), MongoDB collections: users, projects, connections (encrypted Dropbox refresh token), oauth_states (TTL), login_attempts
- Frontend React + Swiper coverflow + framer-motion parallax SVG hero; fonts Cabinet Grotesk / Manrope / JetBrains Mono
- Public: projects, project file browsing scoped to the linked Dropbox folder only, temp links, thumbnails, global search (projects + files in linked folders)
- Admin (/admin): Dropbox connect/disconnect, project CRUD, Dropbox folder picker

## Personas
- Visitors browsing the studio's worlds/projects; studio admin managing projects & Dropbox mapping

## Implemented (2026-11-15)
- Landing page matching mockup, Projects bento, Archive list, Studio/Contact (placeholder copy), Search page, Workspace with file grid/breadcrumbs/search/preview (image/video/audio/pdf)
- JWT admin login (allisgoodworld@yahoo.com), brute-force lockout, admin panel
- Dropbox OAuth (offline refresh token, encrypted at rest) — awaiting DROPBOX_APP_KEY / DROPBOX_APP_SECRET
- Tested: iteration_1 (backend 25/27 → both failures fixed, mobile overflow fixed)

## Backlog
- P0: add Dropbox keys, connect, link folders per project
- P1: replace AI covers with real project images (upload in admin); real Studio/Contact copy
- P2: contact form, featured video on workspace header
