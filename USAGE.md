# Using exengrupo

A quick guide for group members. The app is in Spanish; button names are shown as they appear.

## 1. Install

- **Android:** download and install
  [exengrupo.apk](https://github.com/Numanpaf885/exengrupo/releases/latest/download/exengrupo.apk).
  If Android asks, allow installing apps from your browser. New versions install over the old one.
- **iPhone:** open **https://exengrupo.vercel.app** in **Safari** → **Share** → **Add to Home Screen** → **Add**.
  Always open exengrupo from that icon.
- **Computer:** open **https://exengrupo.vercel.app** in any browser.

## 2. Sign in

Accounts are invite-only. Ask the admin for a username and a one-time code.

1. On the sign-in screen tap **Tengo un código**.
2. Type your username, the code (`XXXX-XXXX-XXXX`) and a new password (8+ characters). The code expires after 72 hours.
3. Next time just use **Entrar** with your username and password. You stay signed in for 30 days.

## 3. Join or create a space

- **Crear espacio:** give it a name; you get a 6-letter code and an **Invitar** link to share.
- **Unirme:** type the 6-letter code you were sent, or just open the invite link.

## 4. Get answers from a photo

1. Open a space and tap **Tomar foto**.
2. Frame all the questions and tap the picture or the white **Tomar foto** button.
   The app uses the 0.5x (ultra-wide) lens when the phone allows it. If it says **0.5x no disponible**,
   tap **Usar cámara del teléfono** and pick 0.5x/0.6x in your phone's camera.
3. In a few seconds everyone in the space sees the answers, one per line, with the AI that gave each one:

   ```
   1.  a        Claude + Gemini
   2.  b/c ?    Claude: b · Gemini: c
   3.  V        Gemini
   ```

   `b/c ?` (in red) means the two AIs disagreed. Double-check those.

Messages you may see: **No se lee bien, repite la foto** (retake it closer and in focus) and
**Límite de IA alcanzado, prueba en X min** (the free AI quota is used up; wait and retry).

## 5. Add the course book or notes (optional)

In a space tap **Archivos** → **Añadir archivo** and choose a PDF, Word (.docx), text (.txt/.md) or image
(up to 50 MB and 500 pages, 20 files per space). When it shows **Listo**, answers in that space follow
your files first. Files are only read by the AI; nobody can open or download them in the app.

## 6. Manage a space (creator only)

**Miembros** → rename the space, remove a member (**Quitar**) or **Eliminar espacio**.

## For the admin

Hold the big **exengrupo** title for 3 seconds (or tap it 7 times) on the home or sign-in screen,
then enter the admin password.

- **Usuarios:** create users (the one-time code is shown once), give a new code, delete.
- **Claves IA:** add, test or remove the AI keys and models.
- **Uso:** photos, errors and answers per AI.
