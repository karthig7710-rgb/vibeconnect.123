# VibeConnect

Social chat + music app. React (Vite) · Node/Express · MongoDB · Socket.IO · Tailwind CSS.

## Features
- Sign up / log in / log out (bcrypt + JWT in an httpOnly cookie), profile pictures and bio
- Search users, friend requests (send, accept, decline, cancel), unfriend
- Real-time private chat, photos (5 MB, magic-byte verified), emoji picker, read receipts
- **Edit your own text messages** (pencil icon next to your message; shows an "edited" label and updates live for your friend)
- Online/offline status, last seen, typing indicators
- Unread badges, in-app toasts, browser notifications, unread count in tab title
- Voice/video calls (WebRTC), face filters, voice changer, chat/call/profile templates, Free and Premium plans
- Music: upload your own songs, shared playlists (private / friends / everyone), play/pause/seek/volume/next/prev, favourites
- Share songs with friends as playable cards
- Dark, responsive UI (desktop rail + mobile bottom tabs)

### v2 additions
- **Listen Together**: private rooms (invite-only), shared queue, play/pause/seek/next/prev synced for everyone
  (server-authoritative playback + clock-offset sync + drift correction), host-only or everyone-controls mode
- **Games**: Tic Tac Toe, Connect Four, Rock Paper Scissors (best of 3); invite online friends, server-validated moves,
  live head-to-head series score, forfeit handling, rematches
- **10 free themes** that re-skin the whole app (click your avatar -> Theme): Violet Night, Deep Ocean, Sunset Drive,
  Midnight Forest, Neon Arcade, Rose Quartz, Aurora, Mocha, Graphite, Candy Pop. Your choice is saved to your account.
- Live games and rooms are held in server memory (finished game results are stored in MongoDB)
- No points, rewards, badges or leaderboard (removed)

## Prerequisites
- Node.js 18+ (20 recommended)
- MongoDB running locally (`mongodb://127.0.0.1:27017`) or a free MongoDB Atlas URI

## Setup
```bash
cd vibeconnect
npm run install:all
cp server/.env.example server/.env
# edit server/.env: set JWT_SECRET (and MONGO_URI if using Atlas)
```
Generate a secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Run (development)
```bash
npm run dev
```
Open http://localhost:5173 (API on :5000). Open a second browser/incognito window, create another
account, add each other as friends and start chatting.

## Run (production)
```bash
npm start      # builds the client, then Express serves it on http://localhost:5000
```
Set `NODE_ENV=production` (done by `npm start` in server) and serve over HTTPS so the auth cookie is `Secure`.
For a split deployment, set `CLIENT_URL` to the client origin; same-origin hosting is simplest.

## Deploy
See [DEPLOY.md](DEPLOY.md) for GitHub + Render + MongoDB Atlas, and for installing it on an Android phone.

## Security notes
- Passwords hashed with bcrypt (cost 12); JWT lives in an httpOnly, SameSite=Lax cookie
- Helmet + CSP, CORS locked to `CLIENT_URL`, rate limits (stricter on login/signup)
- Input validated with zod; Mongo queries are parameterised and regex input is escaped
- Uploads: 5 MB limit, file type checked from the actual bytes, random filenames
- Socket.IO authenticates with the same cookie; typing events only reach friends
- Only friends can message each other

## Music: your own songs and playlists
Users upload their own songs into playlists. Each playlist has a visibility:
**Only me**, **My friends** (default) or **Everyone** (all VibeConnect users). Anyone who can see a playlist can play it.

- Songs are stored in MongoDB (GridFS) and streamed with seek support from `/api/library/stream/:id`.
- Limits (optional env vars in `server/.env`): `MAX_AUDIO_MB` (default 15 per song), `USER_AUDIO_QUOTA_MB` (default 100 per user).
  Atlas free tier has 512 MB in total, so keep the quota modest.
- Formats: MP3, M4A, OGG, WAV, FLAC (checked by file content, not just the name).
- Uploaders must confirm they own the song or have permission to share it.
- Songs sent in chat or played in Listen Together work for people who can open that playlist.
- Old favourites saved from Jamendo/iTunes still play.

## Calls (voice and video)
- If the camera is missing or busy (for example two windows on one PC share one webcam), the call continues with voice only.
- Open a chat and tap the phone or camera icon. The other person must be your friend and online.
- WebRTC: audio/video go directly between the two phones/browsers. The server (Socket.IO) only passes the connection
  messages (`server/src/calls/manager.js`). Controls: mute, camera on/off, sound on/off, switch camera, effects, end.
- Camera and microphone only work on **https** (or `localhost`). Render gives you https automatically.
  Opening the app by a plain `http://192.168.x.x` address will NOT allow calls.
- Some mobile/office networks block direct connections. For those, add a TURN server in `server/.env`
  (`TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL`; any TURN provider works). Without it calls still work on most Wi-Fi/4G.
- Face filters: Dog, Cat, Big Eyes, Baby, Cartoon, Robot, Alien (all free). Face tracking (MediaPipe, about 4 MB)
  downloads from jsdelivr / Google storage the first time someone picks a filter; if that fails, filters sit in the middle of the screen.
- Voice changer: Chipmunk, Deep, Baby, Monster, Robot, Cartoon (all free). Runs in the browser (AudioWorklet,
  `client/public/voice-worklet.js`). Use headphones to avoid echo.
- Calls last only while the app is open: there are no push notifications, so a closed app will not ring.

## Free and Premium
There is no payment provider yet, so Premium cannot be bought inside the app. The app owner switches it on:
put usernames in `PREMIUM_USERNAMES` in `server/.env` (comma separated, e.g. `PREMIUM_USERNAMES=karthi,friend1`) and restart.
- Free: everything in calls (voice, video, all 8 filters, all 7 voices, all call templates), voice messages, music, games, 10 themes, 3 chat and 2 profile templates.
- Premium: 4 extra chat templates (Aurora, Sakura, Galaxy, Neon Grid) and 4 extra profile templates (Glass, Neon, Gold, Sakura).
- Templates are enforced on the server.

## Voice messages
In a chat, tap the mic (it appears when the message box is empty), speak, then tap send (or the bin to discard). Up to 2 minutes.
Recipients see a player with a seek bar and 1x / 1.5x / 2x speed. Voice notes are stored in MongoDB (GridFS) and can only be
played by the two people in that chat. They use Atlas storage (about 0.25 MB per minute).

## Templates
Profile -> Templates. Chat template = your chat background and bubble colour (only you see it). Call template = your call screen.
Profile template = your profile card; friends see it on the incoming-call screen.

## Listen Together links
In a room, the host taps **Link** to share an invite link (`/?room=...&k=...`). Only the host's friends can join with it;
the link stops working when the room closes. Opening the link logs in as usual, then joins the room.

## Structure
```
vibeconnect/
├─ package.json            root scripts (dev, build, start)
├─ server/
│  ├─ .env.example
│  └─ src/ index.js · config.js · socket.js
│     ├─ models/      User · Message · FriendRequest · GameResult
│     ├─ routes/      auth · users · friends · messages · music · rooms
│     ├─ games/       tictactoe · connect4 · rps · manager (real-time engine)
│     ├─ rooms/       manager (Listen Together)
│     ├─ middleware/  auth
│     └─ utils/       upload · presence · errors · song
└─ client/
   └─ src/ main.jsx · App.jsx · api.js · index.css
      ├─ context/     Auth · Chat (socket, messages, presence) · Music (player, favourites)
      ├─ pages/       AuthPage · Home
      └─ components/  ChatList · ChatWindow · FriendsPanel · MusicPanel · PlayerBar ·
                      SongCard · TrackRow · ShareSongModal · ProfileModal · Avatar · Toasts · Modal
```
