# Watch2Gether - Room-Based Video Sync App

A real-time video synchronization app where users can watch videos together in sync.

## 🚀 Features

- ✅ **Room-based sync** - Create rooms and share links
- ✅ **Host controls** - First user becomes the host
- ✅ **Real-time sync** - Play, pause, and seek synchronized across all viewers
- ✅ **No uploads** - Videos load from URL, no hosting required
- ✅ **Auto host transfer** - If host leaves, control passes to next viewer
- ✅ **Shareable links** - Copy and share room URLs

## 📁 Project Structure

```
w2g/
├── client/          # Vite + React + TypeScript frontend
├── server/          # Express + Socket.IO backend
└── README.md
```

## 🛠️ Tech Stack

**Frontend:**

- React 19
- TypeScript
- Vite
- Socket.IO Client
- React Router
- Tailwind CSS

**Backend:**

- Node.js
- Express
- Socket.IO
- In-memory room storage

## ⚙️ Environment Setup

### Server (.env)

Copy `.env.example` to `.env` and configure:

```env
PORT=3000
CLIENT_URL=http://localhost:5173
```

### Client (.env)

Copy `.env.example` to `.env` and configure:

```env
VITE_SERVER_URL=http://localhost:3000
```

## 📦 Installation

### 1. Install Server Dependencies

```bash
cd server
pnpm install
```

### 2. Install Client Dependencies

```bash
cd client
pnpm install
```

## 🏃 Running Locally

### Terminal 1: Start Backend

```bash
cd server
pnpm dev
```

Server runs on `http://localhost:3000`

### Terminal 2: Start Frontend

```bash
cd client
pnpm dev
```

Client runs on `http://localhost:5173`

## 🧪 Testing

1. Open `http://localhost:5173` in **Tab 1**
2. Paste a video URL (e.g., `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`)
3. Click **"Create Room"**
4. Copy the room link from the UI
5. Open the copied link in **Tab 2** (or different browser)
6. **Result:** Both tabs show synced video. Tab 1 has controls (host), Tab 2 auto-syncs (viewer)

## 🔌 Socket Events

### Client → Server

- `create-room` - Create new room with video URL
- `join-room` - Join existing room
- `play` - (Host only) Broadcast play event
- `pause` - (Host only) Broadcast pause event
- `seek` - (Host only) Broadcast seek event

### Server → Client

- `play-event` - Sync play command to all users
- `pause-event` - Sync pause command to all users
- `seek-event` - Sync seek command to all users
- `user-count-update` - Update connected user count
- `host-changed` - Notify when host changes

## 🎯 How Sync Works

### Room Creation

1. User enters video URL → click "Create Room"
2. Server generates unique `roomId` and stores room state
3. User navigates to `/room/:roomId` as **host**

### Late Joiner Sync

1. New user opens `/room/:roomId`
2. Client emits `join-room` with `roomId`
3. Server sends current room state: `{ videoUrl, currentTime, isPlaying, isHost }`
4. Client immediately syncs video to current state

### Playback Control

1. **Host** plays/pauses → video event → emit to server
2. Server validates (only host can emit) → broadcast to ALL users
3. **All users** (including host) receive event → sync video
4. Prevents feedback loops using `isSyncingRef` flag

## 🛡️ Anti-Desync Features

1. **Feedback Loop Prevention** - `isSyncingRef` blocks re-emission during sync
2. **Host Validation** - Server rejects control events from non-hosts
3. **Smart Seeking** - Only seeks if drift > 0.5 seconds
4. **Shared Socket** - Single socket instance prevents ID mismatch

## 🔧 Development Tips

### Change Server Port

```env
# server/.env
PORT=4000
```

Don't forget to update client:

```env
# client/.env
VITE_SERVER_URL=http://localhost:4000
```

### Deploy to Production

1. Set `CLIENT_URL` to your frontend domain
2. Set `VITE_SERVER_URL` to your backend domain
3. Use a process manager (PM2) for the server
4. Build client: `pnpm run build` and serve with nginx/vercel

## 📝 Future Improvements

- [ ] Persistent rooms (Redis/database)
- [ ] Reconnection handling
- [ ] Buffering sync (pause if anyone is buffering)
- [ ] Text chat
- [ ] Video validation
- [ ] Multiple video sources support

## 📄 License

MIT

## 👥 Contributing

Pull requests welcome! For major changes, please open an issue first.

---

Built with ❤️ using React, Socket.IO, and Express
