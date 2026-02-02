import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { socket } from "../lib/socket"

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()

  const videoRef = useRef<HTMLVideoElement>(null)
  const [isHost, setIsHost] = useState(false)
  const [userCount, setUserCount] = useState(1)
  const [copied, setCopied] = useState(false)
  const [roomNotFound, setRoomNotFound] = useState(false)
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false)
  const [roomClosedReason, setRoomClosedReason] = useState<string | null>(null)

  // Sync state tracking
  const isSyncingRef = useRef(false)

  useEffect(() => {
    if (!roomId) {
      navigate("/")
      return
    }

    const video = videoRef.current
    if (!video) return

    // Join room and get initial state
    socket.emit("join-room", { roomId }, (response: any) => {
      if (!response.success) {
        setRoomNotFound(true)
        return
      }

      const { roomState } = response
      setIsHost(roomState.isHost)
      setUserCount(roomState.userCount)

      // Sync video immediately
      if (video.src !== roomState.videoUrl) {
        video.src = roomState.videoUrl
      }

      // Set time and play state
      setTimeout(() => {
        video.currentTime = roomState.currentTime
        if (roomState.isPlaying) {
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      }, 100)
    })

    // ==================== HOST EVENT HANDLERS ====================
    const handlePlay = () => {
      if (!isHost || isSyncingRef.current) return
      socket.emit("play", { roomId, currentTime: video.currentTime })
    }

    const handlePause = () => {
      if (!isHost || isSyncingRef.current) return
      socket.emit("pause", { roomId, currentTime: video.currentTime })
    }

    const handleSeeked = () => {
      if (!isHost || isSyncingRef.current) return
      socket.emit("seek", { roomId, currentTime: video.currentTime })
    }

    const handleFullscreenChange = () => {
      if (!isHost || isSyncingRef.current) return

      // Check if video is currently in fullscreen
      const isFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      )

      console.log("🖥️ Host fullscreen changed:", isFullscreen)
      socket.emit("fullscreen", { roomId, isFullscreen })
    }

    // ==================== SOCKET EVENT LISTENERS ====================
    const syncVideo = (currentTime: number, shouldPlay?: boolean) => {
      isSyncingRef.current = true

      const timeDiff = Math.abs(video.currentTime - currentTime)

      // Only seek if difference is significant (> 0.5 seconds)
      if (timeDiff > 0.5) {
        video.currentTime = currentTime
      }

      if (shouldPlay !== undefined) {
        if (shouldPlay) {
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      }

      setTimeout(() => {
        isSyncingRef.current = false
      }, 50)
    }

    socket.on("play-event", ({ currentTime }: { currentTime: number }) => {
      if (!video) return
      syncVideo(currentTime, true)
    })

    socket.on("pause-event", ({ currentTime }: { currentTime: number }) => {
      if (!video) return
      syncVideo(currentTime, false)
    })

    socket.on("seek-event", ({ currentTime }: { currentTime: number }) => {
      if (!video) return
      syncVideo(currentTime)
    })

    socket.on("user-count-update", ({ userCount }: { userCount: number }) => {
      setUserCount(userCount)
    })

    socket.on("host-changed", ({ newHostId }: { newHostId: string }) => {
      if (socket?.id === newHostId) {
        setIsHost(true)
      }
    })

    socket.on(
      "fullscreen-event",
      ({ isFullscreen }: { isFullscreen: boolean }) => {
        if (!video) return

        console.log("📺 Received fullscreen-event:", isFullscreen)

        isSyncingRef.current = true

        if (isFullscreen) {
          if (isHost) {
            // Host's own client receives the event, should still attempt fullscreen
            console.log("🔲 Host: Attempting to enter fullscreen...")
            const enterFullscreen = async () => {
              try {
                if (video.requestFullscreen) {
                  await video.requestFullscreen()
                } else if ((video as any).webkitRequestFullscreen) {
                  await (video as any).webkitRequestFullscreen()
                } else if ((video as any).mozRequestFullScreen) {
                  await (video as any).mozRequestFullScreen()
                } else if ((video as any).msRequestFullscreen) {
                  await (video as any).msRequestFullscreen()
                }
                console.log("✅ Host: Fullscreen entered successfully")
              } catch (err) {
                console.warn("⚠️ Host: Fullscreen blocked by browser:", err)
                console.log(
                  "💡 Host: User needs to interact with the page first (click/tap)",
                )
              }
            }
            enterFullscreen()
          } else {
            // Viewer: Show prompt for viewers to click and enter fullscreen
            setShowFullscreenPrompt(true)
            console.log("🔲 Viewer: Showing fullscreen prompt")
          }
        } else {
          // Exit fullscreen works without user gesture
          console.log("↩️ Exiting fullscreen...")
          setShowFullscreenPrompt(false) // Hide prompt if showing

          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {})
          } else if ((document as any).webkitExitFullscreen) {
            ;(document as any).webkitExitFullscreen()
          } else if ((document as any).mozCancelFullScreen) {
            ;(document as any).mozCancelFullScreen()
          } else if ((document as any).msExitFullscreen) {
            ;(document as any).msExitFullscreen()
          }
        }

        setTimeout(() => {
          isSyncingRef.current = false
        }, 100)
      },
    )

    socket.on("room-closed", ({ reason }: { reason: string }) => {
      console.log("🚪 Room closed:", reason)

      // Set reason to show modal
      setRoomClosedReason(reason)

      // Redirect after 3 seconds
      setTimeout(() => {
        navigate("/")
      }, 3000)
    })

    // Attach video event listeners
    if (video) {
      video.addEventListener("play", handlePlay)
      video.addEventListener("pause", handlePause)
      video.addEventListener("seeked", handleSeeked)
    }

    // Attach fullscreen event listener to document
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange)
    document.addEventListener("mozfullscreenchange", handleFullscreenChange)
    document.addEventListener("MSFullscreenChange", handleFullscreenChange)

    // Cleanup
    return () => {
      if (video) {
        video.removeEventListener("play", handlePlay)
        video.removeEventListener("pause", handlePause)
        video.removeEventListener("seeked", handleSeeked)
      }

      socket.off("play-event")
      socket.off("pause-event")
      socket.off("seek-event")
      socket.off("user-count-update")
      socket.off("host-changed")
      socket.off("fullscreen-event")
      socket.off("room-closed")

      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      )
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange,
      )
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange)
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

  // Room Closed Modal
  if (roomClosedReason) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800/90 backdrop-blur-xl border border-red-500/50 rounded-2xl p-8 text-center shadow-2xl">
          <div className="mb-6">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">👋</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Room Closed</h2>
            <p className="text-red-400 text-lg font-medium mb-4">
              {roomClosedReason}
            </p>
            <p className="text-gray-400 text-sm">
              Redirecting to home page in 3 seconds...
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all w-full"
          >
            Go Home Now
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
      <div className="max-w-6xl mx-auto">
        {/* Fullscreen Sync Prompt for Viewers */}
        {showFullscreenPrompt && !isHost && (
          <div className="mb-4 bg-indigo-600/90 backdrop-blur-sm border border-indigo-500/50 rounded-xl p-4 shadow-lg animate-in slide-in-from-top duration-300">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🖥️</span>
                <div>
                  <p className="text-white font-semibold text-sm">
                    Host entered fullscreen
                  </p>
                  <p className="text-indigo-100 text-xs">
                    Click to sync fullscreen mode
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const video = videoRef.current
                    if (!video) return

                    if (video.requestFullscreen) {
                      video.requestFullscreen()
                    } else if ((video as any).webkitRequestFullscreen) {
                      ;(video as any).webkitRequestFullscreen()
                    } else if ((video as any).mozRequestFullScreen) {
                      ;(video as any).mozRequestFullScreen()
                    } else if ((video as any).msRequestFullscreen) {
                      ;(video as any).msRequestFullscreen()
                    }

                    setShowFullscreenPrompt(false)
                  }}
                  className="px-4 py-2 bg-white hover:bg-gray-100 text-indigo-600 font-semibold rounded-lg transition-all text-sm"
                >
                  Enter Fullscreen
                </button>
                <button
                  onClick={() => setShowFullscreenPrompt(false)}
                  className="px-3 py-2 text-white hover:bg-indigo-700/50 rounded-lg transition-all text-sm"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

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
            controls={isHost}
            controlsList="nodownload"
            playsInline
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
