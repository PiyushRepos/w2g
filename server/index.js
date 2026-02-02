import express from "express"
import cors from "cors"
import { createServer } from "http"
import { Server } from "socket.io"
import { nanoid } from "nanoid"
import dotenv from "dotenv"

// Load environment variables
dotenv.config()

const app = express()
const httpServer = createServer(app)

// Socket.IO server with CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
})

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// In-memory room storage
// Structure: { roomId: { videoUrl, currentTime, isPlaying, host, users: Map<socketId, userData> } }
const rooms = new Map()

app.get("/", (req, res) => {
  res.send("Watch2Gether Server Running")
})

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`)

  // CREATE ROOM
  socket.on("create-room", ({ videoUrl }, callback) => {
    const roomId = nanoid(10) // Generate unique room ID

    // Initialize room state
    rooms.set(roomId, {
      videoUrl,
      currentTime: 0,
      isPlaying: false,
      host: socket.id, // First user is the host
      users: new Map([[socket.id, { socketId: socket.id }]]),
    })

    // Join the socket room
    socket.join(roomId)

    console.log(`Room created: ${roomId} by ${socket.id}`)

    // Send room info back to creator
    callback({
      success: true,
      roomId,
      isHost: true,
    })
  })

  // JOIN ROOM
  socket.on("join-room", ({ roomId }, callback) => {
    const room = rooms.get(roomId)

    if (!room) {
      callback({ success: false, error: "Room not found" })
      return
    }

    // Add user to room
    room.users.set(socket.id, { socketId: socket.id })
    socket.join(roomId)

    const isHost = room.host === socket.id

    console.log(`User ${socket.id} joined room ${roomId}. Host: ${isHost}`)

    // Send current room state to joining user (CRITICAL for sync)
    callback({
      success: true,
      roomState: {
        videoUrl: room.videoUrl,
        currentTime: room.currentTime,
        isPlaying: room.isPlaying,
        isHost,
        userCount: room.users.size,
      },
    })

    // Broadcast updated user count to all users in room
    io.to(roomId).emit("user-count-update", { userCount: room.users.size })
  })

  // PLAY EVENT (Host only)
  socket.on("play", ({ roomId, currentTime }) => {
    const room = rooms.get(roomId)

    if (!room || room.host !== socket.id) {
      console.log(`Unauthorized play attempt by ${socket.id}`)
      return // Only host can control playback
    }

    // Update room state
    room.isPlaying = true
    room.currentTime = currentTime

    console.log(`Room ${roomId}: Play at ${currentTime}s`)

    // Broadcast to ALL users in room (including host for confirmation)
    io.to(roomId).emit("play-event", { currentTime })
  })

  // PAUSE EVENT (Host only)
  socket.on("pause", ({ roomId, currentTime }) => {
    const room = rooms.get(roomId)

    if (!room || room.host !== socket.id) {
      console.log(`Unauthorized pause attempt by ${socket.id}`)
      return
    }

    room.isPlaying = false
    room.currentTime = currentTime

    console.log(`Room ${roomId}: Pause at ${currentTime}s`)

    io.to(roomId).emit("pause-event", { currentTime })
  })

  // SEEK EVENT (Host only)
  socket.on("seek", ({ roomId, currentTime }) => {
    const room = rooms.get(roomId)

    if (!room || room.host !== socket.id) {
      console.log(`Unauthorized seek attempt by ${socket.id}`)
      return
    }

    room.currentTime = currentTime

    console.log(`Room ${roomId}: Seek to ${currentTime}s`)

    io.to(roomId).emit("seek-event", { currentTime })
  })

  // FULLSCREEN EVENT (Host only)
  socket.on("fullscreen", ({ roomId, isFullscreen }) => {
    const room = rooms.get(roomId)

    if (!room || room.host !== socket.id) {
      console.log(`Unauthorized fullscreen attempt by ${socket.id}`)
      return
    }

    console.log(`Room ${roomId}: Fullscreen ${isFullscreen ? "ON" : "OFF"}`)

    // Broadcast to ALL users in room (including host for confirmation)
    io.to(roomId).emit("fullscreen-event", { isFullscreen })
  })

  // DISCONNECT
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`)

    // Remove user from all rooms and clean up
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        room.users.delete(socket.id)

        // If room is empty, delete it
        if (room.users.size === 0) {
          rooms.delete(roomId)
          console.log(`Room ${roomId} deleted (empty)`)
        } else {
          // If host left, assign new host (first remaining user)
          if (room.host === socket.id) {
            const newHost = room.users.keys().next().value
            room.host = newHost
            console.log(`New host for room ${roomId}: ${newHost}`)

            // Notify all users about host change
            io.to(roomId).emit("host-changed", { newHostId: newHost })
          }

          // Update user count
          io.to(roomId).emit("user-count-update", {
            userCount: room.users.size,
          })
        }
      }
    })
  })
})

const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default httpServer
