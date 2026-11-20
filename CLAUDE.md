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
- Login: a username + password page. Hash passwords with bcryptjs on the server
  only. Session = a signed token valid for 30 days, stored with expo-secure-store
  on Android and localStorage on web.
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
- AI: send each photo to TWO free vision providers in parallel: Gemini and Groq
  first, with an OpenRouter free vision model as the fallback when either fails
  or hits a rate limit. Check each provider's CURRENT official docs for its free
  vision model IDs and request format. NEVER hardcode model names from memory;
  make each model ID an env var with a documented default.
  - Models must return JSON only, in this shape:
    `[{"n":1,"type":"mc","answer":"a"},{"n":2,"type":"tf","answer":"V"},{"n":3,"type":"open","answer":"..."}]`.
    Open answers: simple Spanish, at most ~12 words.
  - Merge per question number. If both agree, show that answer. If they differ,
    show `b/c ?`. If only one model answered, show its answer. For open answers,
    use the first model's text with no flag.
  - The display format is exactly like `1.a  2.c  3.b/c ?  4.V  5. El agua hierve a 100 °C.`
    and nothing else: no explanations.
  - Unreadable photo → "No se lee bien, repite la foto". All providers out of
    quota → "Límite de IA alcanzado, prueba en X min" (X from the provider's
    retry info if it gives one, otherwise 5).
- Design: Swiss / International Typographic Style. White #FFFFFF background,
  black #000000 text, and one accent, Swiss red #DA291C, used only for primary
  actions and the shutter button. Inter font, strict 8 px grid, flush-left text,
  large type for answers. No rounded corners, shadows, gradients or emoji. All UI
  text in Spanish.
- Camera: MUST open at 0.5x (ultra-wide) when the phone exposes that lens. If it
  doesn't, use the widest lens available and show "0.5x no disponible".

## Env vars (names only; the user adds the values in Vercel)

- Server: SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY (convert
  literal "\n" to newlines), R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY, GEMINI_API_KEY,
  GROQ_API_KEY, OPENROUTER_API_KEY, SESSION_SECRET, CRON_SECRET.
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
  notifications, dark mode or extra services.
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

- `src/app/` — Expo Router routes only (`_layout.tsx`, `index.tsx`).
- `src/features/` — screens. A `*.web.tsx` file next to a `*.tsx` file is the web
  version; Metro picks it on web, so native-only libraries (VisionCamera) are
  never bundled for web.
- `src/lib/` — pure logic with `*.test.ts` unit tests (Vitest, `npm test`).
- `src/theme/tokens.ts` — the only place colours, grid, fonts and type sizes live.
- `src/components/` — Swiss primitives (Text, Button, Shutter, InfoRow, Screen).
- `api/` — Vercel functions (web-standard `GET`/`POST` handlers).
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
  that lens.
