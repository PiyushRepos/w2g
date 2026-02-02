import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { socket } from "../lib/socket"

export default function LandingPage() {
  const [videoUrl, setVideoUrl] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const handleCreateRoom = () => {
    if (!videoUrl.trim()) {
      setError("Please enter a video URL")
      return
    }

    // Basic URL validation
    try {
      new URL(videoUrl)
    } catch {
      setError("Please enter a valid URL")
      return
    }

    setError("")
    setIsCreating(true)

    // Emit create-room event to server
    socket.emit("create-room", { videoUrl }, (response: any) => {
      setIsCreating(false)

      if (response.success) {
        // Navigate to room page - RoomPage will fetch state from server
        navigate(`/room/${response.roomId}`)
      } else {
        setError("Failed to create room. Please try again.")
      }
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">
            Watch<span className="text-indigo-500">2</span>Gether
          </h1>
          <p className="text-gray-400 text-sm">
            Watch videos in sync with friends
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 shadow-2xl">
          <div className="space-y-6">
            <div>
              <label
                htmlFor="videoUrl"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Video URL
              </label>
              <input
                id="videoUrl"
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleCreateRoom()}
                placeholder="https://example.com/video.mp4"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                disabled={isCreating}
              />
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
            >
              {isCreating ? "Creating Room..." : "Create Room"}
            </button>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-6 text-center text-gray-500 text-sm space-y-1">
          <p>✓ No uploads • Video loads locally for all users</p>
          <p>✓ First user in room becomes the host</p>
          <p>✓ Real-time sync • Minimal latency</p>
        </div>
      </div>
    </div>
  )
}
