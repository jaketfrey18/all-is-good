# ALL IS GOOD × COOKED WORLD — PRD

## Original problem statement (latest, abridged in user's words)
"Continue building the existing Cooked World application into a fully functional, collaborative creative workspace powered by All Is Good… five core systems: Google Login and user permissions; Live Canvas workspace; Real-time collaborative Lyric Pad; Basic functional video/audio editor (Clip Studio); Session Drop with automatic Dropbox organization… Build functionality, not another visual prototype." Earlier directives: homepage light ink/red style with 3D carousel + frosted search, nav only Worlds · Media · Tools; dark dotted infinite canvas; Lyric Pad with CRDT real-time; Clip Studio (Clip | Captions | AI Assist) with FFmpeg exports; references for Clip Studio UI and a World landing page (GWA — The Studio) were supplied.

## Architecture
- FastAPI (server.py, core.py, auth.py, dropbox_svc.py, collab.py, clips.py) + MongoDB; React (CRA) + Tailwind/shadcn
- Real-time: custom Yjs websocket provider ↔ FastAPI websocket rooms using pycrdt (server merges + persists CRDT state): /api/ws/lyrics/{id}, /api/ws/canvas/{id}
- Lyric editor: TipTap v2 + Collaboration + CollaborationCursor
- Media: Dropbox (OAuth refresh token encrypted), FFmpeg via imageio-ffmpeg; exports to backend/exports, background asyncio jobs with progress
- Auth: JWT email/password; admin seeded from env (allisgoodworld@yahoo.com); admin creates collaborator accounts

## Implemented
- 2026-11-15: portfolio, Dropbox OAuth (new-tab flow), project↔folder mapping, admin
- 2026-11-16: homepage restyle (ink/red, logo cropped from approved reference), Worlds/Media/Tools nav; Media search (name/type/folder, world filter, collapsible results, preview); collaborators + per-item sharing; dark canvas (pan/zoom, notes, frames, Dropbox drag-drop, image/video/audio-waveform/doc cards, move/resize/group/connect, contextual bar, undo/redo, multiple canvases, presence) synced live via Yjs; Lyric Pad (real-time multiuser, cursors, sections, undo/redo, versions, .txt export, Dropbox backup, focus mode); Clip Studio phase 1 (preview, timeline scrub/zoom/In-Out/trim handles, split, segments, clip queue, aspect 16:9/9:16/1:1/4:5, crop, volume/mute/fades, autosave, MP4/MP3/WAV batch export with progress, Dropbox destination)
- Tests: iteration_5 (lyrics realtime pass), iteration_6 (canvas live sync + Clip Studio pass; duration drift fixed afterwards and verified manually)

## Backlog
- P0: Google login (Emergent-managed) + Owner/Editor/Viewer roles per World, email invites, make world files private to members
- P0: Dropbox write permission (user: tick files.content.write, reconnect) for backups/exports/Session Drop
- P1: Session Drop + Sessions records; World landing page (reference GWA — The Studio) with Open Canvas / Lyric Pad / Clip Studio / Session Drop / Files
- P1: Clip Studio: timeline thumbnails, video waveform, local upload, text overlays, assembled sequence export; Lyric PDF export
- P2: Captions (transcription, editor, styles, SRT/VTT, burn-in); AI Assist (long-to-short, hooks, reframing)
