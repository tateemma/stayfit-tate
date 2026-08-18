---

## Part 1 — Put it on GitHub Pages (free hosting)

1. Go to [github.com](https://github.com) and sign in (or create a free account).
2. Click the **+** in the top right → **New repository**.
   - Name it `stayfit-tate`.
   - Keep it **Public** (required for free GitHub Pages) — it's just your workout app, no personal data lives in the code itself.
   - Don't add a README/gitignore (we already have files).
3. On your Mac, open Terminal in this folder (`gym-tracker-app`) and run:
   ```bash
   git init
   git add .
   git commit -m "Initial StayFit Tate app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/stayfit-tate.git
   git push -u origin main
   ```
4. On GitHub, go to your repo → **Settings** → **Pages** (left sidebar).
5. Under "Build and deployment", set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`. Save.
6. Wait ~1 minute, then refresh — GitHub shows you the live URL, something like:
   `https://<your-username>.github.io/stayfit-tate/`
7. Open that URL on your phone's browser (Safari on iPhone, Chrome on Android).
8. **Install it:**
   - **iPhone (Safari):** tap the Share icon → **Add to Home Screen**.
   - **Android (Chrome):** tap the ⋮ menu → **Add to Home screen** / **Install app**.

It now behaves like a real app icon and works offline after the first load.

### Updating later
Whenever you change the app files, bump `CACHE_VERSION` in `service-worker.js` by one, then:
```bash
git add .
git commit -m "Update app"
git push
```
GitHub Pages updates automatically within a minute or two.

---

## Part 2 — Google Drive backup (optional, free)

This lets you back up your workout history, weigh-ins and photos to a private, hidden folder in your own Google Drive (nothing visible/cluttering your normal Drive files), and restore it on a new phone.

### One-time setup (~5 minutes)

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and sign in with your Google account.
2. Create a new project (top dropdown → **New Project**) — call it `StayFit Tate`.
3. In the search bar, search for **"Google Drive API"** and click **Enable**.
4. Go to **APIs & Services → OAuth consent screen**.
   - User type: **External**.
   - App name: `StayFit Tate`, your email for support/developer contact.
   - Scopes: you don't need to add any here (the app requests `drive.appdata` at runtime).
   - Under **Test users**, add your own Google account email. (This keeps the app in "Testing" mode, which is free forever and doesn't need Google's review — it just means only the emails you list can sign in, which is exactly what you want for a personal app.)
5. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Name: `StayFit Tate Web`.
   - Under **Authorized JavaScript origins**, add your GitHub Pages URL, e.g.:
     `https://<your-username>.github.io`
   - Click **Create**. Copy the **Client ID** (looks like `xxxxxxxxxxxx.apps.googleusercontent.com`).
6. In the app, go to **Settings → Google Drive Backup**, paste that Client ID, tap **Save Client ID**.
7. Tap **Backup Now** — a Google sign-in popup appears (first time only, then it remembers you for a while). Approve it.
8. Done — tap **Backup Now** any time you want to sync, and **Restore** on a new phone to pull your data back down.

Your data is stored as a single hidden JSON file (including photos as embedded images) in Drive's "app data" folder — it doesn't count against your visible Drive storage view and isn't shown in your regular Drive file list, but it does use your normal Drive storage quota (the free 15GB you already have).

---
