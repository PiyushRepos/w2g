import { io } from "socket.io-client"

// Single shared socket instance across the entire app
// Server URL comes from environment variable
export const socket = io(
  import.meta.env.VITE_SERVER_URL || "http://localhost:3000",
  {
    autoConnect: true,
  },
)
