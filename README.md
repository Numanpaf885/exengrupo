# exengrupo

**Photograph homework or practice-test questions, and your whole study group gets short answers in seconds.**

exengrupo is a study-group app for Android and iPhone. A group shares a *space*; any member takes a
0.5x (ultra-wide) photo of the questions, two vision AIs answer them, and every member of the space sees
the answers live, one per line, with the AI that gave each one. Groups can add their course book or the
teacher's notes, and the AI uses them as its main source.

[![Android APK](https://github.com/Numanpaf885/exengrupo/actions/workflows/android.yml/badge.svg)](https://github.com/Numanpaf885/exengrupo/actions/workflows/android.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg)](LICENSE)

- **Android:** [download the latest APK](https://github.com/Numanpaf885/exengrupo/releases/latest/download/exengrupo.apk)
- **iPhone / computer:** https://exengrupo.vercel.app (on iPhone: Safari → Share → *Add to Home Screen*)
- **How to use it:** [USAGE.md](USAGE.md)

> The app's interface is in Spanish.

---

## Contents

- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started (development)](#getting-started-development)
- [Deploying your own copy](#deploying-your-own-copy)
- [Configuration](#configuration)
- [API](#api)
- [Testing](#testing)
- [Known limitations](#known-limitations)
- [Privacy and security](#privacy-and-security)
- [License](#license)

---

## Features

**Answers from a photo**
- Camera opens at **0.5x (ultra-wide)** when the phone exposes that lens, otherwise the widest lens
  with a "0.5x no disponible" notice. "Usar cámara del teléfono" opens the phone's own camera app for
  phones that hide the ultra-wide lens from other apps.
- Full-screen camera: tap the picture or the long **Tomar foto** button.
- Photos are shrunk on the device (long edge ≤ 2000 px, JPEG, < 3 MB) before upload.
- **Two AIs answer in parallel**, in preference order **Claude → Gemini → Groq → OpenRouter** (only
  providers with a key count). If one fails, hits a rate limit or returns invalid JSON, the next one
  takes its place.
- Answers are merged per question: agreement shows the answer, disagreement shows `b/c ?`.
- One answer per line, with the AI that gave it:

  ```
  1.  a              Claude + Gemini
  2.  b/c ?          Claude: b · Gemini: c
  3.  El corazón.    Claude
  ```

**Study groups ("spaces")**
- Only the people the admin allows can create a space. The creator ticks who to share it with and it
  appears in their list straight away; a 6-letter join code + invite link also work. Any member can send photos.
- **Live updates** to every open phone via Supabase Realtime Broadcast.
- The creator can rename the space, add or remove members, or delete it.
- Android **App Links**: invite links open the app directly.

**Reference files**
- Add the course book or notes to a space: **PDF, DOCX, TXT, Markdown (.md), HTML, JPG/PNG** (up to 50 MB, 500 pages,
  20 files per space).
- Text PDFs are read directly; scanned PDFs (≤ 30 pages) and images are OCR'd by the vision AI.
- When answering, the app transcribes the questions, searches the space's files (accent-insensitive
  Spanish keyword search, no external service) and gives both AIs up to 6,000 characters of
  "Referencia del espacio", with the rule that the reference wins when it answers the question.
- Files are AI-only: members see the name and status, never the content.

**Accounts and admin**
- **Invite-only** accounts: the admin creates a user and hands over a one-time code
  (`XXXX-XXXX-XXXX`, 72 h, 5 tries).
- Hidden **admin panel**: hold the "exengrupo" title for 3 s (or tap it 7 times). It has four tabs:
  - **Usuarios:** create users, give new codes, delete users, choose who may create spaces.
  - **Espacios:** every space and its members; create spaces for users, add/remove members, delete.
  - **Claves IA:** add, test and remove AI keys and model IDs. Keys are stored encrypted.
  - **Uso:** AI usage (photos, errors, quota hits, answers per AI, OpenRouter credits).

**Design**
- Modern Apple-style **dark** interface. Inter font, red `#DA291C` accent, smooth animations that
  respect "reduce motion".
- Mobile layout on phones; a centred desktop layout in wide browser windows.
- Offline banner, loading states and clear Spanish error messages.

---

## How it works

```
 Phone (Android APK / iPhone home-screen web app)
   │  1. photo (≤ 2000 px JPEG) ──────────────► Vercel /api  (Node, TypeScript)
   │                                              │ 2. store photo ──► Cloudflare R2 (private, 7-day lifecycle)
   │                                              │ 3. posts row "processing" ──► Google Sheet
   │                                              │ 4. [space has files] transcribe questions → search chunks
   │                                              │ 5. two vision AIs in parallel (Claude/Gemini/Groq/OpenRouter)
   │                                              │ 6. merge → save answer line ──► Google Sheet
   │  8. fetch the post with my session ◄──────── │ 7. broadcast { post_id } ──► Supabase Realtime
   ▼
 Every member of the space sees the answers live
```

- **Database:** a Google Sheet ("exengrupo DB") through a service account. Tabs: `users`, `spaces`,
  `members`, `posts`, `files`, `ajustes`.
- **Realtime:** only `{ post_id }` goes through Supabase. Answer text never does; clients fetch it
  from `/api` with their session.
- **Keep-alive:** a daily Vercel cron pings Supabase so the free project never pauses.

---

## Tech stack

| Area | Technology |
| --- | --- |
| App | [Expo](https://expo.dev) SDK 58, React Native 0.88, TypeScript, Expo Router |
| Camera | react-native-vision-camera v5 (Android); `getUserMedia` (web) |
| Backend | Vercel serverless functions (`/api`, Node, web-standard handlers) |
| Data | Google Sheets API (service account, no SDK) |
| Storage | Cloudflare R2 (S3 API, SigV4 via `aws4fetch`) |
| Realtime | Supabase Realtime Broadcast |
| AI | Anthropic Claude (`@anthropic-ai/sdk`), Google Gemini, Groq, OpenRouter |
| Files | `unpdf`, `pdf-lib`, `mammoth`, `minisearch` |
| Auth | `bcryptjs`, HMAC-signed session tokens (30 days) |
| Tests | Vitest |
| CI | GitHub Actions: signed release APK on every push and PR, GitHub Release on `main` |

---

## Project structure

```
api/                 Vercel functions (thin): auth, spaces (one router), admin, cron, health
server/              Server-only code: Sheets client, sessions, handlers, storage, realtime
  ai/                Providers, answer parsing/merging, which-AI labels, retry info
  files/             Reference files: extraction, chunking, search, upload tokens
src/
  app/               Expo Router screens (home, space feed, camera, files, members, admin…)
  features/          Screen logic; *.web.tsx files are the web versions
  components/        UI primitives (Screen, Button, Section, ListRow, Shutter…)
  lib/               Pure logic with unit tests (validation, lens picking, compression…)
  theme/             Design tokens and motion
plugins/             Expo config plugin for the Android release keystore
public/              Web template, PWA manifest, icons, assetlinks.json
.github/workflows/   Android APK build and release
CLAUDE.md            Full project brief and implementation notes
```

---

## Getting started (development)

Requirements: **Node.js 22+** and npm. For Android: Android Studio / JDK 17, only if you build locally.

```bash
git clone https://github.com/Numanpaf885/exengrupo.git
```

```bash
cd exengrupo && npm ci
```

```bash
npx expo start --web
```

Useful commands:

```bash
npm test                     # unit tests (Vitest)
```

```bash
npx tsc --noEmit             # type check
```

```bash
npx expo export -p web       # production web build → dist/
```

```bash
npx expo run:android         # local Android build on a device or emulator
```

The web app calls its own origin's `/api`. To run the API locally, use the
[Vercel CLI](https://vercel.com/docs/cli) (`vercel dev`) with the environment variables below.

---

## Deploying your own copy

1. **Google Sheet:** create a sheet with the tabs `users`, `spaces`, `members`, `posts` and `files`, each
   with the row-1 headers listed in [CLAUDE.md](CLAUDE.md). The `ajustes` tab is created by the app.
   Share it with a Google Cloud service account as **Editor**.
2. **Cloudflare R2:** create a private bucket. Add a lifecycle rule that deletes objects with the prefix
   **`spaces/`** after 7 days. That prefix holds the photos; reference files under `refs/` are kept.
3. **Supabase:** create a free project with a `public.heartbeat` table holding one row. Copy the
   project URL, the publishable key and the secret key.
4. **AI keys:** at least one of Gemini, Groq, OpenRouter or Claude. You can add them later in the admin
   panel.
5. **Vercel:** import the repository and add the environment variables below. `vercel.json` builds the
   web app and serves `/api`, the rewrites and the daily cron.
6. **Android APK:** GitHub Actions builds it on every push. To keep the same signing key across builds,
   add the secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and
   `ANDROID_KEY_PASSWORD`. Without them it uses the shared debug key. Builds on `main` are published as
   GitHub Releases.
7. Open the app, hold the title for 3 s, sign in with `ADMIN_PASSWORD`, and create the first user.

---

## Configuration

All names are listed in [`.env.example`](.env.example). Never commit real values.

| Variable | Where | Purpose |
| --- | --- | --- |
| `SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Vercel | Google Sheet database |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Vercel | Photo and file storage |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Vercel | Realtime broadcast and heartbeat |
| `SESSION_SECRET` | Vercel | Signs sessions and encrypts stored AI keys |
| `CRON_SECRET` | Vercel | Protects the daily heartbeat |
| `ADMIN_PASSWORD` | Vercel | Admin panel password |
| `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY` | Vercel or admin panel | AI providers (the admin panel wins) |
| `CLAUDE_MODEL`, `GEMINI_MODEL`, `GROQ_MODEL`, `OPENROUTER_MODEL` | optional | Model IDs (defaults in `server/ai/providers.ts`) |
| `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | build time | Public client settings |

---

## API

All endpoints are under `/api`, JSON in and out, with errors as `{ "error": "<Spanish message>" }`. A
`Bearer` session token is required except where noted.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/auth/login` | Sign in (no token) |
| `POST` | `/auth/activate` | Activate an account with a one-time code (no token) |
| `GET` | `/auth/me` | Current user |
| `GET` / `POST` | `/spaces` | My spaces / create a space |
| `POST` | `/spaces/join` | Join with a code |
| `GET` | `/spaces/people` | People who can be added (space creators only) |
| `POST` | `/spaces/:id/members` | Add people (creator) |
| `GET` / `PATCH` / `DELETE` | `/spaces/:id` | Details / rename / delete (creator) |
| `DELETE` | `/spaces/:id/members/:userId` | Remove a member (creator) |
| `GET` / `POST` | `/spaces/:id/posts` | Feed / send a photo (multipart `photo`) |
| `GET` | `/spaces/:id/posts/:postId` | One post |
| `GET` / `POST` | `/spaces/:id/files` | Reference files / start an upload |
| `PUT` | `/spaces/:id/files/:fileId/chunks/:n` | Upload a ≤ 4 MB piece (`x-upload-token`) |
| `POST` | `/spaces/:id/files/:fileId/process` | Run one processing step |
| `DELETE` | `/spaces/:id/files/:fileId` | Delete a file (uploader or creator) |
| `*` | `/admin/*` | Admin panel (admin token): users, who may create spaces, spaces, AI keys, usage |
| `GET` | `/cron/heartbeat` | Daily keep-alive (`CRON_SECRET`) |

---

## Testing

```bash
npm test
```

The tests cover the pure logic and the server handlers with in-memory stores:
- answer parsing, merging and formatting, and which-AI labels;
- sessions, one-time codes and validation;
- join codes;
- reference-file chunking, search and upload tokens;
- camera lens picking and stream release;
- Sheets quota handling.

External services are always mocked; tests never call real services.

---

## Known limitations

- **Xiaomi / MIUI phones** hide the 0.6x lens from other apps. Use **Usar cámara del teléfono** and
  pick 0.6x in the phone's camera.
- **iPhone** uses the web app, so shared links open in Safari rather than the app, and there's no
  vibration on capture.
- **Android Chrome (web)** can't tell which lens is ultra-wide; Android users should use the APK.
- **Free AI quotas apply.** When every provider is out of quota, the app shows "Límite de IA alcanzado,
  prueba en X min".
- **Speed:** a Google Sheet is the database, which is fine for study groups but not for thousands of users.

---

## Privacy and security

- Passwords are hashed with bcrypt on the server; sessions are HMAC-signed and expire after 30 days.
- One-time codes are stored only as keyed hashes. Resetting or deleting a user signs them out on every
  device.
- AI keys entered in the admin panel are stored encrypted (AES-256-GCM); the panel only ever shows the
  last 4 characters.
- Photos are private in R2 and deleted after 7 days. Answer text never passes through Supabase.

---

## License

[MIT](LICENSE) © 2026 Numanpaf885
