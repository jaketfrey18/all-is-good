# ALL IS GOOD × COOKED WORLD — PRD

## Original problem statement (latest, abridged in user's words)
"Continue building the existing Cooked World application into a fully functional, collaborative creative workspace powered by All Is Good… five core systems: Google Login and user permissions; Live Canvas workspace; Real-time collaborative Lyric Pad; Basic functional video/audio editor (Clip Studio); Session Drop with automatic Dropbox organization… Build functionality, not another visual prototype." Earlier directives: homepage light ink/red style with 3D carousel + frosted search, nav only Worlds · Media · Tools; dark dotted infinite canvas; Lyric Pad with CRDT real-time; Clip Studio (Clip | Captions | AI Assist) with FFmpeg exports; references for Clip Studio UI and a World landing page (GWA — The Studio) were supplied.
Latest (2026-11-16): "okay lets change GWAS landing page to the reference. keep going. how much you think caption and ai edit will cost? i guess dont build those yet. GWA add the session drop definitely" — choices: use the reference picture itself; only GWA gets the new layout; one Dropbox folder per session split by type; keep files in the app until Dropbox write is on; keep credit use reasonable.

## Architecture
- FastAPI (server.py, core.py, auth.py, dropbox_svc.py, collab.py, clips.py, sessions.py) + MongoDB; React (CRA) + Tailwind/shadcn
- Real-time: custom Yjs websocket provider ↔ FastAPI websocket rooms using pycrdt: /api/ws/lyrics/{id}, /api/ws/canvas/{id}
- Media: Dropbox (OAuth refresh token encrypted), FFmpeg via imageio-ffmpeg
- Session Drop: Emergent object storage (EMERGENT_LLM_KEY) holds files; chunked 8MB uploads; sync to Dropbox `{world}/Sessions/{YYYY-MM-DD Name}/{Audio|Video|Images|Docs|Other}/` when files.content.write granted
- Auth: JWT email/password; admin seeded from env; admin creates collaborators

## Implemented
- 2026-11-15: portfolio, Dropbox OAuth, project↔folder mapping, admin
- 2026-11-16: homepage restyle; Media search; collaborators/sharing; dark live canvas; Lyric Pad realtime; Clip Studio phase 1 (tests iteration_5/6)
- 2026-11-16: GWA landing page per reference (/p/gwa: studio hero cropped from reference → /gwa-studio.jpg, 5 tiles, Recent Sessions, tools lists, Files & Media). Session Drop drawer (GWA page + canvas button): sessions CRUD, multi-file chunked upload, auto-sort by type with manual override, download, delete, Dropbox send (409 until write permission). Tested iteration_7 (all pass; minor fixes applied after: unicode download filename, blank session name, mobile delete button, count labels)
- 2026-11-16 (Media Capture + Cross-World Reuse V1): user request "Browser Audio Capture … Cross-World Asset Reuse … Simple Asset Suggestions … Save & Organization". Choices: only World members can search/reuse a World's assets (admin assigns per World); Dropbox files on World pages are now members-only.
  - Tab audio recorder (getDisplayMedia + MediaRecorder, WebM; server FFmpeg remux + WAV download) in Media → World Library, Canvas + menu, Clip Studio header; recordings saved to object storage as `assets` (kind recording) with rename/tags; auto-push to Dropbox `{world}/Recordings/` when write is on
  - Media page: World Library tab (recordings + references + Suggested Assets) and Search All Worlds tab (filename/type/#tag/World filters, tag editing for Dropbox files via file_meta, Use in This World → deduped reference asset, original untouched)
  - Permissions: projects.members; /api/worlds/mine; members dialog in Admin → Projects; project file endpoints + search members-only; references locked without source access; media served via 6h asset-scoped tokens
  - Session Drop uploads now stored as object-storage parts
  - Tested iteration_8 (all pass; tester fixed recorder blob URL bug; follow-ups applied: scoped media tokens, reference tag sync + deleted-original flag, admin hidden from members dialog)

## Backlog
- P0: Google login (Emergent-managed) + Owner/Editor/Viewer roles per World, invites (now: admin-assigned World members)
- P1: stream long recordings (>1h) instead of in-memory processing
- P0: Dropbox write permission (user: tick files.content.write, reconnect) — needed for Session Drop sync, backups, Dropbox exports
- P1: Session Drop: per-world sorting rules, link session files to canvas/clip studio; apply studio layout to other worlds
- P1: Clip Studio: timeline thumbnails, local upload, text overlays, sequence export; Lyric PDF export
- P2 (deferred by user): Captions (~$0.006/min transcription) and AI Assist (~1–5¢/video)
