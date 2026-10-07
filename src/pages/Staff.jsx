import { useCallback, useEffect, useState } from 'react'
import { listSubmissions, resetDemo, setStatus } from '../data/store'
import { eventName } from '../data/events'
import { AiCheckPanel, Photo, WixNote, formatDate } from '../components'

const DEMO_PIN = '1886'
const UNLOCK_KEY = 'south-view-staff-unlocked'

const TABS = [
  { status: 'pending', label: 'Pending review' },
  { status: 'approved', label: 'Approved' },
  { status: 'rejected', label: 'Rejected' },
]

export default function Staff() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(UNLOCK_KEY) === 'yes')
  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />
  return <ReviewQueue />
}

function PinGate({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [wrong, setWrong] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (pin === DEMO_PIN) {
      sessionStorage.setItem(UNLOCK_KEY, 'yes')
      onUnlock()
    } else {
      setWrong(true)
      setPin('')
    }
  }

  return (
    <section className="section narrow center">
      <h1>Staff Review</h1>
      <p className="lead">Only South-View staff can approve photos for the public gallery.</p>
      <form className="pin-form" onSubmit={handleSubmit}>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Staff PIN"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value)
            setWrong(false)
          }}
          autoFocus
        />
        <button className="button" type="submit">Enter</button>
      </form>
      {wrong && <p className="error">That PIN didn't match.</p>}
      <p className="hint">Demo PIN: 1886, the year South-View was founded. Not real security.</p>
    </section>
  )
}

function ReviewQueue() {
  const [items, setItems] = useState([])
  const [tab, setTab] = useState('pending')
  const [confirmReset, setConfirmReset] = useState(false)

  const refresh = useCallback(() => listSubmissions().then(setItems), [])
  useEffect(() => {
    refresh()
  }, [refresh])

  async function move(id, status) {
    await setStatus(id, status)
    refresh()
  }

  async function handleReset() {
    if (!confirmReset) return setConfirmReset(true)
    await resetDemo()
    setConfirmReset(false)
    setTab('pending')
    refresh()
  }

  const shown = items.filter((i) => i.status === tab)

  return (
    <section className="section">
      <div className="staff-head">
        <h1>Staff Review</h1>
        <button className={confirmReset ? 'button button-danger' : 'button button-outline'} onClick={handleReset}>
          {confirmReset ? 'Click again to reset' : 'Reset demo data'}
        </button>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.status} className={tab === t.status ? 'tab active' : 'tab'} onClick={() => setTab(t.status)}>
            {t.label} <span>{items.filter((i) => i.status === t.status).length}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 && <p className="empty">Nothing here right now.</p>}

      <div className="review-list">
        {shown.map((item) => (
          <article key={item.id} className="review-card">
            <Photo record={item} className="review-photo" />
            <div className="review-body">
              <div className="review-meta">
                <strong>{eventName(item.event)}</strong>
                <span>{item.sample ? 'Sample from southviewpreservation.com' : `Submitted ${formatDate(item.submittedAt)}`}</span>
              </div>
              <p className="review-caption">{item.caption || <em>No caption</em>}</p>
              <p className="review-consent">{item.consent ? '✓ Contributor gave consent to publish' : 'No consent given'}</p>
              <AiCheckPanel check={item.aiCheck} />
              <div className="actions">
                {item.status !== 'approved' && (
                  <button className="button" onClick={() => move(item.id, 'approved')}>Approve</button>
                )}
                {item.status !== 'rejected' && (
                  <button className="button button-outline" onClick={() => move(item.id, 'rejected')}>
                    {item.status === 'approved' ? 'Remove from gallery' : 'Reject'}
                  </button>
                )}
                {item.status === 'rejected' && (
                  <button className="button button-outline" onClick={() => move(item.id, 'pending')}>Move back to pending</button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <WixNote>
        a Wix Automation runs when a new item lands in the Collection, emails staff, and
        approving a photo just switches its approval field to true.
      </WixNote>
    </section>
  )
}
