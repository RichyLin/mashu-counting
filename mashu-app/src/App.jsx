import { useEffect, useState } from 'react'
import { Routes, Route, useParams, useNavigate } from 'react-router-dom'
import EntryPage from './pages/EntryPage'
import IdentityPage from './pages/IdentityPage'
import TablePage from './pages/TablePage'
import { RoomProvider } from './context/RoomContext'
import { getStoredPlayerId } from './lib/deviceId'
import * as db from './lib/db'

function RoomRoute() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // 'loading' | 'table' | 'identity'
  const [room, setRoom] = useState(null)
  const [playerId, setPlayerId] = useState(null)

  useEffect(() => {
    async function check() {
      const { data: roomData, error: roomErr } = await db.getRoom(code)
      if (roomErr || !roomData) { navigate('/'); return }

      setRoom(roomData)

      const storedId = getStoredPlayerId(code)
      if (storedId) {
        const { data: player } = await db.getPlayerById(storedId)
        if (player && player.room_id === roomData.id) {
          setPlayerId(storedId)
          setStatus('table')
          return
        }
      }

      setStatus('identity')
    }
    check()
  }, [code, navigate])

  if (status === 'loading') {
    return (
      <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (status === 'identity') {
    return <IdentityPage room={room} onJoined={pid => { setPlayerId(pid); setStatus('table') }} />
  }

  return (
    <RoomProvider roomId={room?.id} myPlayerId={playerId} onDissolved={() => navigate('/')}>
      <TablePage />
    </RoomProvider>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<EntryPage />} />
      <Route path="/room/:code" element={<RoomRoute />} />
    </Routes>
  )
}
