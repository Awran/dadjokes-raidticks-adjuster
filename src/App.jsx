import { useEffect, useMemo, useState } from 'react'
import FileLoader from './components/FileLoader'
import Login from './components/Login'
import DkpLeaderboard from './components/DkpLeaderboard'
import AuctionWinsHistory from './components/AuctionWinsHistory'
import PlayerHistory from './components/PlayerHistory'
import RaidHistory from './components/RaidHistory'
import RaidEditor from './components/RaidEditor'
import { useAuth } from './context/AuthContext'
import { api } from './utils/api'
import logo from './assets/dadjokes-raidticks.png'

const AUTH_PROVIDER = String(import.meta.env.VITE_AUTH_PROVIDER || 'discord').toLowerCase()
const AUTO_PROMPT_LOGIN = AUTH_PROVIDER === 'discord' || AUTH_PROVIDER === 'hybrid'

function App() {
  const [backupData, setBackupData] = useState(null)
  const [errors, setErrors] = useState([])
  const [fileName, setFileName] = useState('')
  const [activeTab, setActiveTab] = useState('leaderboard')
  const [uploading, setUploading] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [selectedRaidId, setSelectedRaidId] = useState(null)
  const { isAuthenticated, isAdmin, logout, user, accessDenied, loading } = useAuth()

  useEffect(() => {
    if (accessDenied && !isAuthenticated) {
      setShowLogin(true)
    }
  }, [accessDenied, isAuthenticated])

  useEffect(() => {
    if (!loading && !isAuthenticated && AUTO_PROMPT_LOGIN) {
      setShowLogin(true)
    }
  }, [loading, isAuthenticated])

  const hasBackup = !!backupData

  const backupPreview = useMemo(() => {
    if (!backupData) {
      return null
    }

    const uploadPayload = backupData?.apiReplay?.uploadRaid?.payload || {}
    const settlementCalls = Array.isArray(backupData?.apiReplay?.auctionSettlementAdjustments)
      ? backupData.apiReplay.auctionSettlementAdjustments
      : []

    return {
      raidName: uploadPayload.raidName || backupData?.raid?.raidName || '-',
      raidDate: uploadPayload.raidDate || backupData?.raid?.raidDate || '-',
      attendanceCount: Array.isArray(uploadPayload.attendance) ? uploadPayload.attendance.length : 0,
      settlementCount: settlementCalls.length
    }
  }, [backupData])

  const handleLoad = ({ backup, errors: nextErrors, fileName }) => {
    setBackupData(backup)
    setErrors(nextErrors)
    setFileName(fileName)
  }

  const handleUploadToServer = async () => {
    if (!hasBackup || !backupData) return

    setUploading(true)
    try {
      const result = await api.importRaidBackup(backupData)

      alert(
        `Backup imported successfully! Attendance: ${Number(result?.attendanceProcessed || 0)}, ` +
        `Settlement entries: ${Number(result?.settlementProcessed || 0)}`
      )
      setBackupData(null)
      setErrors([])
      setFileName('')
    } catch (error) {
      alert(`Import failed: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleSelectRaidFromPlayerHistory = (raidId) => {
    if (!isAdmin || !raidId) {
      return
    }

    setSelectedRaidId(raidId)
    setActiveTab('history')
  }

  return (
    <div className="app">
      {showLogin && !isAuthenticated && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.8)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000
        }}
          onClick={() => setShowLogin(false)}
          role="button"
          tabIndex={-1}
        >
          <div
            style={{ position: 'relative' }}
            onClick={(event) => event.stopPropagation()}
          >
            <button 
              onClick={() => setShowLogin(false)}
              style={{
                position: 'absolute',
                top: '-10px',
                right: '-10px',
                background: '#ff6b6b',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                cursor: 'pointer',
                fontSize: '18px'
              }}
            >
              ×
            </button>
            <Login onSuccess={() => setShowLogin(false)} />
          </div>
        </div>
      )}
      
      <header className="hero">
        <div>
          <p className="eyebrow">DadJokes RaidTicks</p>
          <h1>DKP Management System</h1>
          <p className="lede">
            Track raid attendance, manage DKP balances, and maintain historical records.
          </p>
        </div>
        <div className="hero__logo" aria-hidden="true">
          <img src={logo} alt="DadJokes RaidTicks logo" />
        </div>
        <div className="hero__meta">
          {isAuthenticated ? (
            <>
              <div>
                <span className="meta__label">User</span>
                <span className="meta__value">
                  {user?.userDetails || 'Guest'}
                </span>
              </div>
              <div>
                <span className="meta__label">Role</span>
                <span className="meta__value">
                  {isAdmin ? 'Admin' : 'Member'}
                </span>
              </div>
              <button type="button" className="button button--ghost" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <button type="button" className="button" onClick={() => setShowLogin(true)}>
              Sign In
            </button>
          )}
        </div>
      </header>

      <nav className="tabs">
        <button
          type="button"
          className={`tab ${activeTab === 'leaderboard' ? 'tab--active' : ''}`}
          onClick={() => {
            setActiveTab('leaderboard')
            setSelectedPlayerId(null)
          }}
        >
          DKP Leaderboard
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'auctionWins' ? 'tab--active' : ''}`}
          onClick={() => {
            setActiveTab('auctionWins')
            setSelectedPlayerId(null)
          }}
        >
          Auction Wins
        </button>
        {isAdmin && (
          <button
            type="button"
            className={`tab ${activeTab === 'upload' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            Upload Raid
          </button>
        )}
        {isAuthenticated && (
          <button
            type="button"
            className={`tab ${activeTab === 'history' ? 'tab--active' : ''}`}
            onClick={() => {
              setActiveTab('history')
              setSelectedRaidId(null)
            }}
          >
            Raid History
          </button>
        )}
      </nav>

      {activeTab === 'leaderboard' && (
        <section>
          {selectedPlayerId ? (
            <PlayerHistory
              playerId={selectedPlayerId}
              onBack={() => setSelectedPlayerId(null)}
              isAdmin={isAdmin}
              onSelectRaid={handleSelectRaidFromPlayerHistory}
            />
          ) : (
            <DkpLeaderboard
              isAdmin={isAdmin}
              onSelectPlayer={setSelectedPlayerId}
            />
          )}
        </section>
      )}

      {activeTab === 'auctionWins' && (
        <section>
          <AuctionWinsHistory />
        </section>
      )}

      {activeTab === 'upload' && isAdmin && (
        <>
          <section className="panel panel--soft">
            <FileLoader onLoad={handleLoad} />
            {errors.length > 0 && (
              <div className="notice notice--error">
                <h3>Backup issues</h3>
                <ul>
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {hasBackup && backupPreview && (
            <section className="summary">
              <div>
                <p className="summary__label">Raid</p>
                <p className="summary__value">{backupPreview.raidName}</p>
              </div>
              <div>
                <p className="summary__label">Raid Date</p>
                <p className="summary__value">{backupPreview.raidDate}</p>
              </div>
              <div>
                <p className="summary__label">Attendance</p>
                <p className="summary__value">{backupPreview.attendanceCount}</p>
              </div>
              <div>
                <p className="summary__label">Settlements</p>
                <p className="summary__value">{backupPreview.settlementCount}</p>
              </div>
            </section>
          )}

          {hasBackup && (
            <section className="panel">
              <div className="panel__header">
                <div>
                  <h2>Import Backup</h2>
                  <p>{fileName || 'No file selected'}</p>
                </div>
                <button
                  type="button"
                  className="button"
                  onClick={handleUploadToServer}
                  disabled={uploading}
                >
                  {uploading ? 'Importing...' : 'Import JSON Backup'}
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {activeTab === 'history' && isAuthenticated && (
        <section>
          {isAdmin && selectedRaidId ? (
            <RaidEditor 
              raidId={selectedRaidId} 
              onBack={() => setSelectedRaidId(null)} 
            />
          ) : (
            <RaidHistory
              onSelectRaid={isAdmin ? setSelectedRaidId : null}
              isReadOnly={!isAdmin}
            />
          )}
        </section>
      )}
    </div>
  )
}

export default App
