import { io } from "socket.io-client"

// Single shared socket instance across the entire app
export const socket = io("http://localhost:3000", {
  autoConnect: true,
})
