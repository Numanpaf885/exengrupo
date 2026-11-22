# exengrupo — project brief and rules

This file holds the whole brief so future sessions don't need it pasted again.
Read it fully before working. Decisions below are final: do not reopen them.

## Objective

A Swiss-design study-group app for Android (installable APK) and iPhone (the same
app as a web app opened in Safari and added to the home screen). A study group
shares a "space". Any member takes a 0.5x (ultra-wide) photo of homework or
practice-test questions, two free vision-AI APIs answer it, and every member of
the space sees the short answers instantly.

Built in 5 slices. Do ONE slice at a time, then stop and wait for the user to say
"continue".

## Context (decisions already made)

- Purpose: homework, practice tests and study groups. Personal use, free plans only.
- One codebase: Expo (latest stable SDK) + TypeScript + Expo Router.
  - Android: native APK built by GitHub Actions. No Play Store, no paid EAS features.
  - iPhone: the Expo web build, hosted on Vercel at https://exengrupo.vercel.app,
    used from Safari "Add to Home Screen" (PWA). No native iOS build.
- Backend: Vercel serverless functions in `/api` (Node, TypeScript), in the same
  repo and the same Vercel project "exengrupo". The Android app calls
  `https://exengrupo.vercel.app/api/...`.
- Database: the Google Sheet "exengrupo DB", accessed through a service account.
  Tabs and row-1 headers are fixed; NEVER change them:
  - `users`: user_id, username, password_hash, created_at, last_login
  - `spaces`: space_id, name, join_code, channel_id, creator_id, created_at, deleted
  - `members`: space_id, user_id, role, joined_at, removed
  - `posts`: post_id, space_id, user_id, photo_key, status, answer, models, created_at, photo_expires_at
  - `ajustes` (added 2026-11-22 with the user's approval; created by the app on the
    first admin save): clave, valor, actualizado. Admin-entered AI keys (encrypted)
    and model IDs. The four tabs above stay exactly as they are.
  - `files` (added 2026-11-22, created by the user): file_id, space_id, user_id,
    name, type, file_key, text_key, size_bytes, pages, status, error, created_at, deleted.
    Reference files of a space (see "Reference files" below).
- Login: a username + password page. Hash passwords with bcryptjs on the server
  only. Session = a signed token valid for 30 days, stored with expo-secure-store
  on Android and localStorage on web.
- Accounts are INVITE-ONLY (user decision 2026-11-22, like the Libros project):
  there is no public sign-up. The admin creates a user and gets a one-time code
  (XXXX-XXXX-XXXX, 72 h, 5 tries, stored only as a keyed hash); the person opens
  "Tengo un código" (/activar), types username + code + a new password.
- Admin panel (/admin): opened by HOLDING the big "exengrupo" title for 3 s, or
  tapping it 7 times within 4 s (home and sign-in screens, app and web; a short
  vibration confirms on Android); its own password ADMIN_PASSWORD (Vercel).
  Tabs: Usuarios, Claves IA, Uso (AI usage).
  Users: create (shows the code once), new code (also signs the person out on
  every device), delete (can't sign in, leaves every space). Claves IA: add,
  change, remove and test (free endpoints, no tokens) the AI keys and model IDs,
  including a Claude (Anthropic) slot.
- Spaces: after login, a user creates a space (which gets a 6-letter join code +
  link) or joins one with a code or link. Any member can send photos. Only the
  creator can rename the space, remove members or delete it (soft delete: set
  deleted/removed = TRUE).
- Live push: Supabase Realtime Broadcast only. No Supabase Auth, and no Supabase
  tables except the existing `public.heartbeat`. Each space has a random
  channel_id of at least 32 characters. After an answer is saved, the server
  broadcasts only `{post_id}`; each client then fetches the answer from `/api`
  with its session. Answer text NEVER goes through Supabase. Check Supabase's
  current docs for broadcasting from a server with the new `sb_secret_` key.
- Keep-alive: a Vercel cron runs once a day and calls `/api/cron/heartbeat`
  (protected by CRON_SECRET). That endpoint updates the single row in
  `public.heartbeat` so the free Supabase project never pauses.
- Photos: compressed on the device (long edge ≤ 2000 px, JPEG, < 3 MB) and
  uploaded to `/api`, NOT straight to R2. Stored in the private Cloudflare R2
  bucket `exengrupo-fotos` as `spaces/{space_id}/{post_id}.jpg` via the S3 API.
  R2 already deletes them after 7 days (lifecycle rule). Set
  `photo_expires_at = created_at + 7 days`.
- AI: send each photo to TWO vision providers in parallel. Preference order
  (user decision 2026-11-22): Claude, Gemini, Groq, OpenRouter, counting only
  providers that have a key; the two most preferred answer, and when one fails,
  hits a rate limit or returns invalid JSON, the next one in the order takes its
  place. Claude is paid (the user approved this exception to "free plans only");
  without a Claude key it's Gemini + Groq with OpenRouter as the fallback. Check
  each provider's CURRENT official docs for its model IDs and request format.
  NEVER hardcode model names from memory; make each model ID an env var with a
  documented default (the admin panel can override keys and models).
  - Models must return JSON only, in this shape:
    `[{"n":1,"type":"mc","answer":"a"},{"n":2,"type":"tf","answer":"V"},{"n":3,"type":"open","answer":"..."}]`.
    Open answers: simple Spanish, at most ~12 words.
  - Merge per question number. If both agree, show that answer. If they differ,
    show `b/c ?`. If only one model answered, show its answer. For open answers,
    use the first model's text with no flag.
  - The saved answer line is exactly like `1.a  2.c  3.b/c ?  4.V  5. El agua hierve a 100 °C.`
    and nothing else: no explanations. The app shows it ONE ANSWER PER LINE
    ("1. a", "2. c", "3. b/c ?", …) with the AI that gave each answer on the right
    ("Claude + Gemini", "Claude: b · Gemini: c") — user decision 2026-11-22.
  - Unreadable photo → "No se lee bien, repite la foto". All providers out of
    quota → "Límite de IA alcanzado, prueba en X min" (X from the provider's
    retry info if it gives one, otherwise 5).
- Design (user decisions 2026-11-22, replace the original Swiss style): a modern
  Apple-style interface, DARK ONLY (no light theme, no toggle). Pure-black grouped
  background #000000 with #1C1C1E rounded cards and inset grouped lists, hairline separators, large titles, "‹ Atrás" nav,
  a frosted pinned bottom bar, capsule chips, soft banners. One tint colour, the
  exengrupo red #DA291C, for filled buttons (red text/links use #FF6259 for
  contrast on dark; tinted = secondary). Inter (400/500/600/700) on an 8 px grid (4 px half-steps), body 17,
  large bold type for answers, iOS-camera chrome (a long full-width white "Tomar
  foto" capsule; tapping the preview also takes the photo; translucent pills).
  No gradients, no heavy shadows, no emoji. All UI text in Spanish.
- Camera: MUST open at 0.5x (ultra-wide) when the phone exposes that lens. If it
  doesn't, use the widest lens available and show "0.5x no disponible".

## Env vars (names only; the user adds the values in Vercel)

- Server: SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY (convert
  literal "\n" to newlines), R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY, GEMINI_API_KEY,
  GROQ_API_KEY, OPENROUTER_API_KEY, SESSION_SECRET, CRON_SECRET, ADMIN_PASSWORD.
  Optional: ANTHROPIC_API_KEY, CLAUDE_MODEL, GEMINI_MODEL, GROQ_MODEL,
  OPENROUTER_MODEL (AI keys and models can also be set in the admin panel, which
  wins over Vercel).
- Client (public, inlined at build time): EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Ask the user for
  the two Supabase values when a slice needs them; they are safe to commit.
- `.env.example` lists the names with no values. NEVER print, log or commit a
  secret value.

## Slices

1. **Lens test** (done in PR "Slice 1: …")
   - Scaffold the Expo + TypeScript + Expo Router project with Swiss theme
     tokens, the Inter font and Spanish UI.
   - One screen, "Prueba de lente":
     - list every back camera the device exposes (its label, plus on Android its
       physical devices and min/neutral/max zoom);
     - open the ultra-wide camera at its widest view;
     - take a photo and show it full width with the lens used, its resolution,
       and "0.5x: sí" or "0.5x: no".
   - Android: react-native-vision-camera. Choose the ultra-wide physical device,
     or a multi-camera device at its minimum zoom (0.5x).
   - Web / iPhone Safari: call enumerateDevices after camera permission is
     granted. Pick the ultra-wide camera by its label, matching both English and
     Spanish iOS labels (e.g. "Back Ultra Wide Camera", "ultra gran angular"). If
     there's none, use a virtual dual-wide/triple camera; if there's none of
     those either, use the default back camera. Capture from the video stream at
     full track resolution into a canvas, then export a JPEG.
   - GitHub Actions: on every push to main and every pull request, build an
     installable Android release APK (expo prebuild + Gradle) and upload it as a
     workflow artifact. Consecutive builds MUST use the same signing key so an
     update installs over the old version.
   - Vercel: `vercel.json` builds the web export (`npx expo export -p web` →
     `dist`) and serves the `/api` functions. Web manifest (name exengrupo,
     black/white icon, display standalone) so "Add to Home Screen" on iPhone
     opens full screen.
   - Write CLAUDE.md containing this whole brief.
2. **Accounts**: `/api` auth (register, login, me), the Sheets client, bcryptjs
   and sessions. Swiss-style Spanish login and register screens, plus logout.
3. **Spaces**: create, join by code or link, list my spaces and their members,
   and the creator-only rename / remove member / delete.
4. **Photos → live answers**: the slice 1 camera inside a space → upload → R2 →
   two AIs → merge → save to posts → Supabase broadcast → every open phone shows
   the new answer at the top of the space feed. Add the heartbeat cron.
5. **Polish**: every error message above, loading states, an offline message,
   and a design pass at 360 px and 430 px screen widths.

## Rules

- Build only what the brief asks. No extra features, analytics, ads, push
  notifications or extra services. (The app is dark-only by user decision.)
- Add only the dependencies a slice needs, and list each new one in the slice
  report with a one-line reason.
- Unit-test the pure logic (answer parsing, merging, formatting, join-code
  generation, session tokens). Mock external services in tests; NEVER call the
  user's real services from tests.
- Put each slice on its own branch and open a pull request titled "Slice N: …".
  NEVER push to main.
- Stop and ask before deleting files you didn't create in the current session,
  changing the Sheet schema, adding a service or paid plan not listed here, or
  doing anything that needs an account action from the user.

## Done, for every slice

- `npx tsc --noEmit` passes, the tests pass and `npx expo export -p web`
  succeeds. Show the command output.
- The GitHub Actions run on the PR succeeds and produces the APK artifact. If you
  can't see the run's status, say so.
- The PR description says what was built, how to test it on the user's phones
  step by step in simple English, and which env vars or GitHub secrets must be
  added before merging.
- Then stop and wait for "continue".

---

## Implementation notes (kept up to date by each slice)

### Layout

- `src/app/` — Expo Router routes only. `_layout.tsx` wraps everything in
  `AuthProvider` and uses `Stack.Protected`: signed in → `index` (my spaces),
  `crear`, `unirse/index`, `espacio/[id]/index` (feed), `espacio/[id]/camara`,
  `espacio/[id]/miembros`, `lente`; signed out → `login`, `register`;
  `unirse/[code]` (join link) works either way.
- `src/features/` — screens. A `*.web.tsx` file next to a `*.tsx` file is the web
  version; Metro picks it on web, so native-only libraries (VisionCamera) are
  never bundled for web.
- `src/lib/` — pure logic with `*.test.ts` unit tests (Vitest, `npm test`).
- `src/theme/tokens.ts` — the only place colours, radii, grid, fonts and type sizes live.
- `src/components/` — UI primitives: Text (variants + tones), Button (primary /
  secondary / ghost / destructive / small), Screen (nav row, frosted footer),
  Section + Card (inset grouped lists), ListRow (cell with leading/trailing, chevron),
  Badge / Chip, TextField, Notice, LoadingBar, Shutter, FadeIn.
- `api/` — Vercel functions (web-standard `GET`/`POST` handlers), kept thin.
- `server/` — server-only code imported by `api/` (never by the app): Sheets
  client, sessions, auth handlers. Use relative imports here (no `@/` alias).
- `plugins/withAndroidReleaseSigning.js` — config plugin for the release keystore.
- `public/` — `index.html` (web template with PWA/iOS meta tags), `manifest.json`, icons.
  Icons are generated by `python3 scripts/make-icons.py`.

### Commands

- `npm test` · `npx tsc --noEmit` · `npx expo export -p web`
- In this cloud container, Expo's API host is blocked: prefix Expo CLI commands
  with `EXPO_OFFLINE=1` (e.g. `EXPO_OFFLINE=1 npx expo install <pkg>`).
- `android/` and `ios/` are generated by `expo prebuild` and git-ignored. Never edit them.

### Camera (slice 1)

- VisionCamera **v5** (Nitro modules; needs `react-native-nitro-modules` and
  `react-native-nitro-image`). v5 has no `neutralZoom`; it is derived in
  `src/lib/lens/nativeLens.ts`.
- Android pick order: physical ultra-wide → logical multi-camera with
  minZoom < 1 (opened at minZoom) → virtual camera containing an ultra-wide →
  widest back camera ("0.5x no disponible").
- Android Chrome (web) labels are "camera2 N, facing back", so the web build
  cannot identify an ultra-wide there; Android users use the APK.
- Web pick order: ultra-wide by label (EN/ES, accent-insensitive) → virtual
  dual-wide/triple (at minimum `zoom` if the track supports it) → default back
  camera. Only an ultra-wide label counts as "0.5x: sí" on web.
- Web camera release (2026-11-22): every stream a screen opens is registered in
  `CameraStreams` (`src/lib/lens/cameraStreams.ts`) and `useReleaseCamera` stops
  them all on leaving/covering the screen, page hidden, pagehide and unmount; a
  stream that arrives after the screen closed is stopped at once; the camera stops
  as soon as the frame is copied; one start at a time ("Abriendo cámara…" instead of
  the "Abrir cámara" button during startup). Before, leaving during startup or a
  second tap left a camera running and the phone's indicator on until the tab closed.

### Accounts (slice 2)

- `POST /api/auth/register`, `POST /api/auth/login` → `{ token, user: { user_id, username } }`;
  `GET /api/auth/me` (Bearer token) → `{ user }`. Errors are `{ error: "<Spanish message>" }`.
- Handlers in `server/auth.ts` take injected deps (`AuthDeps`) so tests use an
  in-memory store; `server/http.ts` wires the real Sheets store, bcryptjs (cost 10)
  and env vars.
- Sheets: `server/sheets.ts` signs a service-account JWT with `node:crypto` (no
  Google SDK), maps columns by row-1 header name, writes RAW values, never row 1.
  Google allows ~60 reads/min: a tab read is shared for 4 s per server instance
  (writes to that tab clear it) and 429/5xx answers are retried after 0.8/2/4 s.
- Session token: `v1.<base64url JSON {sub, usr, exp}>.<HMAC-SHA256>`, 30 days,
  `SESSION_SECRET`. Logout = delete the token on the device.
- Usernames: 3–20 chars `[a-z0-9._-]`, stored lowercase. Passwords: 8+ chars, ≤ 72 bytes.
  Rules live in `src/lib/auth/validation.ts`, shared by screens and server.
- Device storage: `src/lib/session/tokenStore.ts` (expo-secure-store) and
  `tokenStore.web.ts` (localStorage). On start the stored session is used at once,
  then checked with `/api/auth/me`; only a 401 signs the user out (offline keeps it).
- API base: web calls its own origin (Vercel previews work); Android uses
  `EXPO_PUBLIC_API_URL` (set in the workflow), default https://exengrupo.vercel.app.
- TypeScript 6 loads no global types by default: tsconfig sets `"types": ["node"]`.

### Spaces (slice 3)

- One Vercel function serves every `/api/spaces/*` route (`api/spaces.ts` +
  `server/router.ts`): Hobby allows only 12 functions. `vercel.json` rewrites
  `/api/spaces/:path*` → `/api/spaces?__path=:path*`. Route list is at the top of `api/spaces.ts`.
- Handlers in `server/spaces.ts` / `server/posts.ts` take `DataDeps` (tables over
  Sheet tabs via `server/table.ts`); tests use `memoryTable` (`server/testing.ts`).
- Join code: 6 letters from `ABCDEFGHJKMNPQRSTUVWXYZ` (no I/L/O), unique among
  active spaces. channel_id: 24 random bytes → 32 base64url chars.
- Roles: `creator` / `member`. Booleans are written as "TRUE"/"FALSE"; a ticked
  checkbox also reads as TRUE. A removed member can't rejoin with the code.
- Join link: `https://exengrupo.vercel.app/unirse/CODE`. Signed out → login/register,
  then `pendingJoin` makes home open the link again.

### Photos → live answers (slice 4)

- Camera inside a space: `src/features/camera/PhotoCapture(.web).tsx` (same lens
  rules as slice 1, plus "Usar cámara del teléfono"). Compression:
  `src/lib/photo/compress(.web).ts` → long edge ≤ 2000 px, JPEG, < 3 MB.
- Upload: multipart field `photo` to `POST /api/spaces/:id/posts`; the camera
  screen hands it to `src/features/spaces/uploads.ts` and returns to the feed.
- ANDROID GOTCHA (found 2026-11-22): in Expo SDK 58 the global `fetch` on native is
  `expo/fetch`. It CANNOT send a FormData file part given as `{ uri, name, type }`
  ("uri is not supported") and cannot read local `file://` URIs; it throws and the
  app showed "Sin conexión". Native uploads and local file reads use React Native's
  XMLHttpRequest instead (`src/lib/xhr.ts`: `xhrPostForm`, `readLocalBlob`). Web
  keeps using fetch with real Blobs. Never `fetch(localUri)` in native code.
- Server pipeline (`server/posts.ts`): R2 `spaces/{space_id}/{post_id}.jpg`
  (aws4fetch SigV4, `server/storage.ts`) → posts row `processing` → broadcast →
  AI → row `done`/`error` with the answer line and `models` → broadcast.
  `photo_expires_at = created_at + 7 days`.
- AI (`server/ai/`): Gemini + Groq in parallel; a failed/rate-limited slot is
  replaced by OpenRouter (one shared call). Model IDs: env `GEMINI_MODEL`,
  `GROQ_MODEL`, `OPENROUTER_MODEL`, defaults in `DEFAULT_MODELS` (providers.ts).
  Verified Nov 2026 from the official SDK/docs repos on GitHub (the docs sites are
  blocked from the cloud container): `gemini-3.8-flash` (cookbook/js-genai),
  `meta-llama/llama-4-scout-17b-16e-instruct` (groq-sdk 1.6.0 model enum).
  The OpenRouter default `google/gemma-3-27b-it:free` could NOT be verified —
  check https://openrouter.ai/models?max_price=0&input_modalities=image.
- `parseAnswers` / `mergeAnswers` / `formatAnswers` in `server/ai/answers.ts`
  implement the exact display format; messages: UNREADABLE, quota ("prueba en X
  min", X from RetryInfo / Retry-After / X-RateLimit-Reset, else 5), AI_FAILED.
- Realtime: server → `POST {SUPABASE_URL}/realtime/v1/api/broadcast/{channel_id}/events/post`
  with header `apikey: SUPABASE_SECRET_KEY` (never Bearer: sb_ keys aren't JWTs),
  body `{post_id}` only. App: `@supabase/realtime-js` on a public channel with the
  publishable key (`src/lib/realtime.ts`), then fetches the post from /api.
  The public Supabase URL and publishable key are committed as defaults in
  `src/lib/config.ts` (EXPO_PUBLIC_* env vars override them), so the APK needs no
  GitHub Variables.
- Heartbeat: Vercel cron `17 6 * * *` → `/api/cron/heartbeat` (Bearer
  CRON_SECRET) → reads the one row of `public.heartbeat` and PATCHes its
  `last_*`/`*ping*`/`*beat*`/`updated*` column (or another non-created timestamp,
  or the id to itself) via PostgREST with the secret key.

### Polish (slice 5)

- Offline: any /api call that can't connect sets `src/lib/connectivity.ts`;
  `Screen` shows a black "Sin conexión. Revisa tu internet." bar until a call
  succeeds (web also listens to online/offline events).
- Loading states: "Cargando…", "Creando…", "Uniéndome…", "Enviando y analizando…",
  "Analizando…". Destructive actions confirm first (`src/lib/confirm(.web).ts`).
- Answers use the `answer` text style (bold 32/40); on display only, the "?" is
  glued to its answer with a non-breaking space and web keeps the double spaces.
- Checked at 360 px and 430 px with no horizontal overflow (Playwright, mocked /api).

### UI/UX pass (added 2026-11-22, user request)

- Motion: `src/theme/motion.ts` (durations, ease-out curve, reduced-motion check).
  RN `Animated` only (no Reanimated dependency), opacity/transform only, skipped when
  the phone asks for reduced motion. `FadeIn` (enter + list stagger), `usePressScale`
  (buttons, rows, shutter), `LoadingBar` (indeterminate black bar), stack slide transitions.
- `Screen` has `headerRight` (ghost text links), a pinned `footer` (main action in
  the thumb zone: "Tomar foto", "Crear espacio"/"Unirme") and pull-to-refresh.
- Camera: full screen, never scrolls (`src/features/camera/CameraChrome.tsx`):
  top bar (Volver + lens status), preview fills the middle, shutter + "Cámara del
  teléfono" at the bottom, white flash + haptic tick on capture (expo-haptics).
  The photo is compressed on the camera screen first ("Preparando la foto…", about
  a second), then the camera closes and the upload continues in the background
  (`startUpload`, rows show "Enviando y analizando…"). (Compressing after the camera
  had closed stopped Android photos from being sent, 2026-11-22.)
- "Subir foto" (user request 2026-11-22): a round tinted button next to "Tomar foto"
  in the space footer (`RoundUploadButton`, same 64 px height; 40 px in the desktop
  toolbar) sends an existing photo for answers: `pickPhoto()` (gallery on Android,
  file picker on web/iPhone) → `compressPhoto` → `startUpload`, same pipeline as the camera.
- Android + phone camera app: MIUI often closes exengrupo while the camera app is
  open. The space id is kept in SecureStore before launching it and
  `RecoverPendingPhoto` (root layout) sends the photo from
  `ImagePicker.getPendingResultAsync()` when the app restarts.
- The server logs every rejected photo (`photo rejected (status): reason bytes=N`).
- Speed: `src/lib/memo.ts` in-memory stale-while-revalidate cache (cleared on
  logout) + `src/features/spaces/cache.ts`; touching a space row prefetches it.

### Desktop layout (added 2026-11-22, user request)

- Only web windows ≥ 900 px wide (`useDesktop()` in `src/lib/useDesktop.ts`) get it;
  the Android app and phone browsers keep the mobile layout unchanged.
- `Screen` renders `DesktopScreen`: a centred 760 px column (440 px and vertically
  centred for forms: `narrow` on sign-in/activate, crear, unirse), a toolbar with
  "‹ Atrás" on the left and the header links plus the mobile footer actions as
  compact buttons on the right. `Button` with `flex` becomes a compact toolbar
  button on desktop. Rows and buttons get hover states (react-native-web `hovered`).
- Camera on desktop: the preview stays full width; the controls are a 480 px column.

### Reference files (added 2026-11-22, user request)

- Members add PDF / JPG / PNG / .txt / .md / .docx to a space (screen
  `espacio/[id]/archivos`). Limits: 50 MB, 500 pages, 20 files per space. Any member
  adds; uploader or creator deletes (soft delete + R2 objects removed). AI-only: the
  app never offers to open or download them.
- R2 keys: photos `spaces/{space_id}/{post_id}.jpg` (the 7-day lifecycle rule must
  use prefix `spaces/` only); files `refs/{space_id}/{file_id}.{ext}` and their chunks
  `refs/{space_id}/{file_id}.chunks.json` (kept). Keys in `server/storage.ts`.
- Upload (changed 2026-11-22: the browser's direct presigned PUT to R2 was
  rejected): `POST /api/spaces/:id/files {name,size}` → row "procesando" + an upload
  token (`server/files/uploadToken.ts`, HMAC, 1 h) → the phone sends the bytes
  through /api in ≤ 4 MB pieces, `PUT …/files/:fileId/chunks/:n` (header
  `x-upload-token`, no Sheet reads; stored as `refs/…/{file_id}.part{n}`) →
  `POST …/files/:fileId/process {step, chunks}`; step 0 joins the pieces into the
  file and deletes them. No R2 CORS rule is needed. Images are shrunk on the
  phone to a ≤ 2000 px JPEG before upload.
- Processing (`server/files/extract.ts`, one step per call so each fits in 60 s):
  .txt/.md as is; .docx with mammoth; PDF text layer with unpdf; scanned PDF (>50 %
  pages without text, ≤ 30 pages) or image → OCR by the vision AI (PDFs only Claude or
  Gemini, 3 pages per step via pdf-lib). Text → ~1,000-char chunks with page numbers
  (`chunk.ts`) → JSON at text_key. Every failure ends as "error"; a "procesando" row
  older than 15 min is shown as an error (`FILE_LIMITS.staleMs`).
- Answering (`server/files/refs.ts`): if the space has ready files, one call
  transcribes the questions, MiniSearch (accent-insensitive Spanish, `search.ts`)
  picks chunks up to 6,000 chars, both answer calls get "Referencia del espacio" +
  the rule "follow the reference when it answers". `posts.models` gets
  `… | ref: file p12; notes.docx` (never shown). Without files nothing changes.
- Providers are `VisionClient`s (`call({prompt, mime, data})`, image or PDF) built by
  `buildClients()`; `answerProvider()` turns one into the old `Provider`.

### Which AI answered + AI usage (added 2026-11-22, user request)

- `server/ai/sources.ts`: `mergeSources` follows the merge rules and is stored in the
  fixed `posts.models` cell as an extra segment:
  `claude:…, gemini:… | by 1:claude+gemini 2:claude=b,gemini=c | ref: …`.
  `answerLabels()` turns it into `labels` on PostView (only for "done" posts); old
  posts answered by a single model get that model's name. The other segments are
  never sent to the app.
- App: `src/lib/answerLines.ts` splits the line; the feed shows one answer per line
  with its label (`AnswerList` in `espacio/[id]/index.tsx`); "b/c ?" in red.
- Admin "Uso" tab (`GET /api/admin/usage`, `server/usage.ts`): photos, errors, quota
  hits, unreadable and reference use in 24 h / 7 days / total, a 7-day bar chart,
  answers per provider with its latest model, and OpenRouter credits (free
  `/api/v1/key`). Gemini, Groq and Claude have no free usage API.

### Admin, invite-only accounts and AI keys (added 2026-11-22)

- Account state lives in the fixed `users.password_hash` cell
  (`server/accountState.ts`): bcrypt hash = active; `setup:v1:<hmac>:<expiresMs>:<tries>`
  = waiting for a one-time code; `deleted:v1:<iso>` = deleted (the row is reused
  if the admin re-creates that username, with a new user_id).
- Session tokens carry `pv` (a fingerprint of password_hash). `authenticate()` in
  `server/context.ts` reads the user on every request: reset/deleted accounts and
  old passwords are signed out on every device.
- `POST /api/auth/activate` replaces the old register endpoint. Screen: `/activar`
  (AuthForm mode "activate"); "Tengo un código" on the sign-in screen.
- Admin API: one function `api/admin.ts` (route list at its top), rewrite
  `/api/admin/:path*` like spaces. Admin token `a1.<…>.<HMAC>` (12 h, memory only
  in the app); sign-in compares HMACs of ADMIN_PASSWORD, 8 failures per IP lock
  15 min (per instance). Screen `src/app/admin.tsx`, panels in `src/features/admin/`.
- AI keys/models: `server/settings.ts` (tab "ajustes", created on first save,
  30 s cache), keys AES-256-GCM encrypted with a key derived from SESSION_SECRET
  (`server/secretbox.ts`; changing SESSION_SECRET makes stored keys unreadable, so
  re-enter them). `server/ai/config.ts` resolves admin > Vercel > default, builds
  providers in order, and `testProviderKey` uses free endpoints (model lookups,
  key info). The admin UI only ever sees the last 4 characters of a key.
- Claude: `server/ai/claude.ts`, official `@anthropic-ai/sdk`, default model
  `claude-opus-5-5`, effort `medium`, server-side refusal fallbacks
  (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`), maxRetries 0.
- `analyzePhoto(providers, …)` takes the ordered list; per-call timeout 26 s and
  no new fallback after ~28 s so a photo stays inside Vercel's 60 s.
- Expo Router: `Stack.Protected` groups need explicit `redirectTo` (signed out →
  `/login`, signed in → `/`), otherwise a signed-out visitor lands on `/admin`.

### Android App Links (links open the app)

- `app.json` → `android.intentFilters` (autoVerify) for
  `https://exengrupo.vercel.app/unirse/*` and `/activar*`; Expo Router routes the
  path. `public/.well-known/assetlinks.json` (exported to `dist`, served by
  Vercel) lists the SHA-256 of every certificate that signs the APK.
- Today the APK is signed with the shared debug key
  (FA:C6:17:45:…:03:3B:9C). When the ANDROID_* signing secrets are added, the
  CI step "Check App Links fingerprint" prints the new SHA-256 and warns until
  it is added to assetlinks.json (keep the old one too while old installs exist).
- iPhone: the app is a home-screen web app; iOS never opens those from links
  (Universal Links need a native iOS app, excluded by the brief).
- Invite links: `/activar?u=<username>` pre-fills the username; the code is
  never put in a link.

### Android signing (GitHub secrets)

The release APK is signed with a keystore from repository secrets:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`. Without them, CI still builds but signs with the shared
debug key and names the artifact `exengrupo-<run>-debugkey`. versionCode = the
GitHub run number, so each build installs over the previous one.

### APK downloads (GitHub Releases)

Every successful build on `main` publishes a GitHub Release `build-<run number>`
with `exengrupo.apk` attached. The newest APK is always at
https://github.com/Numanpaf885/exengrupo/releases/latest/download/exengrupo.apk.
PR builds only upload a workflow artifact.

### Known device limits

- Redmi Note 10 Pro (MIUI): the 0.6x ultra-wide is hidden from third-party apps;
  only "Back Camera" (wide-angle, zoom 1x–10x) is exposed. The app correctly
  falls back to it and shows "0.5x no disponible". No camera library can reach
  that lens. Workaround (Android only): the "Usar cámara del teléfono" button opens
  the phone's own camera app via expo-image-picker (ACTION_IMAGE_CAPTURE); the
  user picks 0.6x there. The lens is then read from EXIF FocalLengthIn35mmFilm
  (< 20 mm = ultra-wide; missing = "0.5x: no se sabe"), see `src/lib/lens/exif.ts`.
  The web build has the same button: a hidden `<input type="file" capture="environment">`
  opens the phone camera app; EXIF is read by `src/lib/lens/jpegExif.ts`.
