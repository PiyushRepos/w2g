import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { io, Socket } from "socket.io-client"

let socket: Socket | null = null

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()

  const videoRef = useRef<HTMLVideoElement>(null)
  const [isHost, setIsHost] = useState(false)
  const [userCount, setUserCount] = useState(1)
  const [videoUrl, setVideoUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const [roomNotFound, setRoomNotFound] = useState(false)

  // Flag to prevent re-emitting events when syncing from server
  const isSyncingRef = useRef(false)

  useEffect(() => {
    if (!roomId) {
      navigate("/")
      return
    }

    // Initialize socket connection if not already connected
    if (!socket) {
      socket = io("http://localhost:3000")
    }

    const video = videoRef.current
    if (!video) return

    // ALWAYS fetch room state from server (works for both creators and joiners)
    // This ensures shared links and page refreshes work correctly
    // Creator already joined via create-room event, but we still fetch state for consistency
    socket.emit("join-room", { roomId }, (response: any) => {
      if (!response.success) {
        setRoomNotFound(true)
        return
      }

      const { roomState } = response
      setIsHost(roomState.isHost)
      setVideoUrl(roomState.videoUrl)
      setUserCount(roomState.userCount)

      // CRITICAL: Sync video immediately with server state
      video.src = roomState.videoUrl
      video.currentTime = roomState.currentTime

      if (roomState.isPlaying) {
        video.play()
      }
    })

    // ==================== HOST EVENT HANDLERS ====================
    // These only fire if user is host - emit to server for sync

    const handlePlay = () => {
      if (!isHost || isSyncingRef.current) return

      socket?.emit("play", {
        roomId,
        currentTime: video?.currentTime || 0,
      })
    }

    const handlePause = () => {
      if (!isHost || isSyncingRef.current) return

      socket?.emit("pause", {
        roomId,
        currentTime: video?.currentTime || 0,
      })
    }

    const handleSeeked = () => {
      if (!isHost || isSyncingRef.current) return

      socket?.emit("seek", {
        roomId,
        currentTime: video?.currentTime || 0,
      })
    }

    // ==================== SOCKET EVENT LISTENERS ====================
    // These fire for ALL users (host + viewers) to sync state

    socket.on("play-event", ({ currentTime }: { currentTime: number }) => {
      if (!video) return

      // Set flag to prevent re-emitting this event
      isSyncingRef.current = true

      video.currentTime = currentTime
      video.play()

      // Reset flag after a short delay
      setTimeout(() => {
        isSyncingRef.current = false
      }, 100)
    })

    socket.on("pause-event", ({ currentTime }: { currentTime: number }) => {
      if (!video) return

      isSyncingRef.current = true

      video.currentTime = currentTime
      video.pause()

      setTimeout(() => {
        isSyncingRef.current = false
      }, 100)
    })

    socket.on("seek-event", ({ currentTime }: { currentTime: number }) => {
      if (!video) return

      isSyncingRef.current = true

      video.currentTime = currentTime

      setTimeout(() => {
        isSyncingRef.current = false
      }, 100)
    })

    socket.on("user-count-update", ({ userCount }: { userCount: number }) => {
      setUserCount(userCount)
    })

    socket.on("host-changed", ({ newHostId }: { newHostId: string }) => {
      // Update host status if this user became the new host
      if (socket?.id === newHostId) {
        setIsHost(true)
      }
    })

    // Attach video event listeners (only if host)
    if (video) {
      video.addEventListener("play", handlePlay)
      video.addEventListener("pause", handlePause)
      video.addEventListener("seeked", handleSeeked)
    }

    // Cleanup
    return () => {
      if (video) {
        video.removeEventListener("play", handlePlay)
        video.removeEventListener("pause", handlePause)
        video.removeEventListener("seeked", handleSeeked)
      }

      socket?.off("play-event")
      socket?.off("pause-event")
      socket?.off("seek-event")
      socket?.off("user-count-update")
      socket?.off("host-changed")
    }
  }, [roomId, isHost, navigate])

  const copyRoomLink = () => {
    const link = window.location.href
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (roomNotFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Room Not Found</h2>
          <p className="text-gray-400 mb-6">
            This room doesn't exist or has been closed.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">
              Watch<span className="text-indigo-500">2</span>Gether
            </h1>
            <p className="text-gray-400 text-sm">
              Room: <span className="font-mono text-indigo-400">{roomId}</span>
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-gray-300 text-sm">
                {userCount} watching
              </span>
            </div>

            <button
              onClick={copyRoomLink}
              className="px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 text-white rounded-lg transition-all flex items-center gap-2"
            >
              {copied ? "✓ Copied!" : "📋 Copy Link"}
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl">
          <video
            ref={videoRef}
            className="w-full aspect-video bg-black"
            controls={isHost} // Only host gets controls
            controlsList="nodownload"
          />

          {/* Status Bar */}
          <div className="p-4 bg-gray-900/50 border-t border-gray-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isHost ? (
                  <span className="px-3 py-1 bg-indigo-600 text-white text-sm font-semibold rounded-full">
                    👑 Host
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-gray-700 text-gray-300 text-sm font-semibold rounded-full">
                    👀 Viewer
                  </span>
                )}

                <span className="text-gray-400 text-sm">
                  {isHost ? "You control playback" : "Synced with host"}
                </span>
              </div>

              <button
                onClick={() => navigate("/")}
                className="px-4 py-2 text-gray-400 hover:text-white transition-all text-sm"
              >
                ← Leave Room
              </button>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-gray-800/30 backdrop-blur-xl border border-gray-700/30 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-2">How it works</h3>
          <ul className="text-gray-400 text-sm space-y-1">
            <li>• Share the room link with friends to watch together</li>
            <li>
              •{" "}
              {isHost
                ? "You're the host - control playback normally"
                : "Host controls playback - you're synced automatically"}
            </li>
            <li>• Everyone watches the same video at the same time</li>
            <li>• If host leaves, control passes to the next viewer</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
