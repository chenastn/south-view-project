import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addEvent,
  checkAI,
  deleteEvent,
  isDemo,
  isStaffUnlocked,
  listAll,
  listEvents,
  lockStaff,
  resetDemo,
  setStatus,
  unlockStaff,
} from '../data/store'
import { MAX_DETAILS_LENGTH, MAX_EVENT_NAME_LENGTH, cleanEventName } from '../data/events'
import { useEvents } from '../events'
import { AiCheckPanel, Photo, WixNote, formatDate } from '../components'

const TABS = [
  { status: 'pending', label: 'Pending review' },
  { status: 'approved', label: 'Approved' },
  { status: 'rejected', label: 'Rejected' },
]

export default function Staff() {
  const [unlocked, setUnlocked] = useState(isStaffUnlocked)
  const lock = useCallback(() => {
    lockStaff()
    setUnlocked(false)
  }, [])
  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />
  return <ReviewQueue onLocked={lock} />
}

function PinGate({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState(null)
  const [checking, setChecking] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setChecking(true)
    try {
      if (await unlockStaff(pin)) return onUnlock()
      setMessage(isDemo ? "That PIN didn't match." : "That password didn't match.")
    } catch (err) {
      setMessage(err.code ? err.message : "Couldn't reach the server. Check your connection and try again.")
    }
    setPin('')
    setChecking(false)
  }

  return (
    <section className="section narrow center">
      <h1>Staff Review</h1>
      <p className="lead">Only South-View staff can approve photos for the public gallery.</p>
      <form className="pin-form" onSubmit={handleSubmit}>
        <input
          type="password"
          inputMode={isDemo ? 'numeric' : undefined}
          autoComplete="off"
          placeholder={isDemo ? 'Staff PIN' : 'Staff password'}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value)
            setMessage(null)
          }}
          autoFocus
        />
        <button className="button" type="submit" disabled={checking}>
          {checking ? 'Checking…' : 'Enter'}
        </button>
      </form>
      {message && <p className="error">{message}</p>}
      {isDemo && <p className="hint">Demo PIN: 1886, the year South-View was founded. Not real security.</p>}
    </section>
  )
}

function ReviewQueue({ onLocked }) {
  const [items, setItems] = useState([])
  const [tab, setTab] = useState('pending')
  const [error, setError] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const { eventName, entry, activeEvents, activeBurials, setEvents } = useEvents()
  const handleError = useCallback(
    (err) => (err.code === 'bad_password' ? onLocked() : setError(err.message || 'Something went wrong.')),
    [onLocked],
  )

  const refresh = useCallback(() => listAll().then(setItems).catch(handleError), [handleError])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await listAll()
        if (cancelled) return
        setItems(list)
        if (isDemo) return
        // Background Gemini checks for every pending photo (demo volume is small).
        for (const item of list.filter((i) => i.status === 'pending' && i.fileId)) {
          if (cancelled) return
          try {
            const aiCheck = await checkAI(item.id)
            if (cancelled) return
            if (!aiCheck) continue
            setItems((all) => all.map((i) => (i.id === item.id ? { ...i, aiCheck } : i)))
          } catch (err) {
            if (err.code === 'bad_password') {
              handleError(err)
              return
            }
            if (!cancelled) setError(err.message || 'AI check failed.')
          }
        }
      } catch (err) {
        handleError(err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [handleError])

  async function move(id, status) {
    setError(null)
    try {
      await setStatus(id, status)
      setItems((all) => all.map((i) => (i.id === id ? { ...i, status } : i)))
    } catch (err) {
      handleError(err)
    }
  }

  async function handleReset() {
    if (!confirmReset) return setConfirmReset(true)
    await resetDemo()
    setConfirmReset(false)
    setTab('pending')
    refresh()
    setEvents(await listEvents())
  }

  const shown = items.filter((i) => i.status === tab)

  return (
    <section className="section">
      <div className="staff-head">
        <h1>Staff Review</h1>
        {isDemo && (
          <button className={confirmReset ? 'button button-danger' : 'button button-outline'} onClick={handleReset}>
            {confirmReset ? 'Click again to reset' : 'Reset demo data'}
          </button>
        )}
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.status} className={tab === t.status ? 'tab active' : 'tab'} onClick={() => setTab(t.status)}>
            {t.label} <span>{items.filter((i) => i.status === t.status).length}</span>
          </button>
        ))}
        <button className={tab === 'event' ? 'tab active' : 'tab'} onClick={() => setTab('event')}>
          Events <span>{activeEvents.length}</span>
        </button>
        <button className={tab === 'burial' ? 'tab active' : 'tab'} onClick={() => setTab('burial')}>
          Burials <span>{activeBurials.length}</span>
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {(tab === 'event' || tab === 'burial') && (
        <EventManager key={tab} type={tab} items={items} onError={handleError} />
      )}
      {TABS.some((t) => t.status === tab) && shown.length === 0 && <p className="empty">Nothing here right now.</p>}

      <div className="review-list">
        {shown.map((item) => (
          <article key={item.id} className="review-card">
            <Photo record={item} className="review-photo" />
            <div className="review-body">
              <div className="review-meta">
                <strong>{entry(item.event)?.type === 'burial' ? `Burial · ${eventName(item.event)}` : eventName(item.event)}</strong>
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

const MANAGER_TEXT = {
  event: {
    intro: 'These are the events visitors can choose on the photo form and the QR signs.',
    placeholder: 'New event name',
    add: 'Add event',
    none: 'No events yet.',
    hint: "Deleting an event takes it off the photo form and QR signs. Photos already shared from it keep the event's name, and adding an event with the same name brings it back.",
  },
  burial: {
    intro: 'Each burial gets its own QR code to place at the grave, and its own page in the gallery.',
    placeholder: 'Name of the person buried here',
    add: 'Add burial',
    none: 'No burials yet.',
    hint: 'To add many burials at once, paste them into the Events tab of the Google Sheet with Type set to "burial". Deleting a burial takes it off the photo form and QR codes; its photos stay in the gallery.',
  },
}

// The events or burials visitors can pick on the photo form and QR codes.
function EventManager({ type, items, onError }) {
  const { activeEvents, activeBurials, status, setEvents } = useEvents()
  const list = type === 'burial' ? activeBurials : activeEvents
  const text = MANAGER_TEXT[type]
  const [name, setName] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  async function run(change) {
    setBusy(true)
    setMessage(null)
    try {
      setEvents(await change())
      return true
    } catch (err) {
      if (err.code === 'bad_password') onError(err)
      else setMessage(err.message || 'Something went wrong.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (await run(() => addEvent(name, type, details))) {
      setName('')
      setDetails('')
    }
  }

  async function handleDelete(id) {
    if (confirmId !== id) return setConfirmId(id)
    setConfirmId(null)
    await run(() => deleteEvent(id))
  }

  const photoCount = (id) => {
    const n = items.filter((i) => i.event === id).length
    return `${n} ${n === 1 ? 'photo' : 'photos'}`
  }

  return (
    <div className="events-manager">
      <p className="lead">{text.intro}</p>
      {status === 'loading' && <p className="empty">Loading…</p>}
      {status === 'error' && <p className="error">The list couldn't load. Refresh the page to try again.</p>}
      {status === 'done' && (
        <ul className="event-list">
          {list.map((e) => (
            <li key={e.id}>
              <div>
                <strong>{e.name}</strong>
                {e.details && <span>{e.details}</span>}
                <span>{photoCount(e.id)}</span>
              </div>
              <div className="event-actions">
                <Link className="button button-outline" to={`/qr?event=${e.id}`}>QR code</Link>
                <button
                  className={confirmId === e.id ? 'button button-danger' : 'button button-outline'}
                  disabled={busy}
                  onClick={() => handleDelete(e.id)}
                >
                  {confirmId === e.id ? 'Click again to delete' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
          {list.length === 0 && <li className="empty">{text.none}</li>}
        </ul>
      )}
      <form className="event-form" onSubmit={handleAdd}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={text.placeholder}
          aria-label={text.placeholder}
          maxLength={MAX_EVENT_NAME_LENGTH}
        />
        {type === 'burial' && (
          <input
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Years, section or plot (optional)"
            aria-label="Years, section or plot"
            maxLength={MAX_DETAILS_LENGTH}
          />
        )}
        <button className="button" type="submit" disabled={busy || !cleanEventName(name)}>
          {busy ? 'Saving…' : text.add}
        </button>
      </form>
      {message && <p className="error">{message}</p>}
      <p className="hint">{text.hint}</p>
      {type === 'burial' && list.length > 0 && (
        <Link className="button button-outline" to="/qr?labels=burials">Print all burial QR codes</Link>
      )}
    </div>
  )
}
