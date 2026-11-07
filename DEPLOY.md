# Deploying VibeConnect (GitHub + Render + MongoDB Atlas)

One Render web service runs the API **and** serves the website, so login cookies and live chat work
without any extra setup. Everything below is for Windows PowerShell, run from the project root
(the folder that contains `client`, `server` and `package.json`).

## 0. Check that it works on your PC first
```
npm run install:all
npm run dev
```
Open http://localhost:5173, create an account and log in. If login fails, fix that first
(the `[server]` lines in the terminal show why; usually `MONGO_URI` in `server/.env`).

## 1. MongoDB Atlas
1. Database Access: you need a database user (username + password, letters and numbers only).
2. Network Access: Add IP Address, **Allow access from anywhere** (`0.0.0.0/0`). Render's IP changes, so this is required.
3. Database, Connect, Drivers: copy the `mongodb+srv://...` string and put `/vibeconnect` before the `?`.

## 2. GitHub (private repository)
Create an empty **Private** repository on github.com (no README, no .gitignore), then:
```
git init
git add .
git status
```
Look at the list. `server/.env` and `node_modules` must NOT appear. Double check with:
```
git check-ignore -v server/.env
```
(it should print a rule from `.gitignore`). Then:
```
git commit -m "VibeConnect"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

## 3. Render
New, Web Service, connect the GitHub repo, then:

| Setting | Value |
|---|---|
| Root Directory | (leave empty) |
| Runtime | Node |
| Build Command | `npm run render-build` |
| Start Command | `npm start --prefix server` |
| Health Check Path | `/api/health` |
| Instance Type | Free |

Environment variables (Environment tab):

| Name | Value |
|---|---|
| `MONGO_URI` | your Atlas connection string |
| `JWT_SECRET` | a long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `NODE_ENV` | `production` |
| `PREMIUM_USERNAMES` | optional: usernames that get Premium, comma separated |
| `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | optional: TURN relay so calls work on strict networks |
| `CLIENT_URL` | your Render URL, e.g. `https://vibeconnect.onrender.com` (add after the first deploy, then redeploy) |

Never put these values in GitHub or in the frontend code.

## 4. Test on your Android phone
1. Open the Render URL in Chrome. The first load after a quiet period takes up to a minute (free plan sleeps).
2. Sign up, log in, send a message from a second account, search and play a song, change theme.
3. Install: Chrome menu (three dots), **Install app** / **Add to Home screen**. It opens full screen like an app.
   (It is a web app that can be installed, not a native Android app.)

## Known limits on the free plan
- **Photos** (profile pictures and chat images) are stored on the server disk, which Render wipes on every
  restart or redeploy. Text, music, games and themes are not affected. For permanent photos, connect an image
  storage service such as Cloudinary (not included yet).
- The server sleeps after about 15 minutes without visitors. Running games and Listen Together rooms are kept
  in memory and are lost when it restarts.
- Run a single instance (do not scale to 2+) because online status and rooms live in memory.

## Songs and storage
Uploaded songs and voice messages live in MongoDB Atlas (GridFS), so they survive Render restarts. Atlas free tier is 512 MB in total:
lower `USER_AUDIO_QUOTA_MB` (default 100) if many people will upload. Profile/chat photos are still stored on Render's
disk and are lost on restart until a service like Cloudinary is added.

## Calls on your phone
Calls need https, which Render provides. Allow the camera and microphone when the browser asks.
If a call stays on "Connecting…" on mobile data, add a TURN server (see README, Calls).

## Speed
The server compresses responses and tells browsers to cache the built files. After updating, run `npm run install:all` once so the
`compression` package is installed.
