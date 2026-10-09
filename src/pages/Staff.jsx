import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addEvent,
  deleteEvent,
  isDemo,
  isStaffUnlocked,
  listAll,
  listEvents,
  lockStaff,
  resetDemo,
  setLabels,
  setStatus,
  unlockStaff,
} from '../data/store'
import { MAX_EVENT_NAME_LENGTH, cleanEventName } from '../data/events'
import { useEvents } from '../events'
import { AiCheckPanel, Photo, WixNote, formatDate } from '../components'

const MAX_LABELS = 20
const MAX_LABEL_LENGTH = 40

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

  const { eventName, activeEvents, setEvents } = useEvents()
  const handleError = useCallback(
    (err) => (err.code === 'bad_password' ? onLocked() : setError(err.message || 'Something went wrong.')),
    [onLocked],
  )

  const refresh = useCallback(() => listAll().then(setItems).catch(handleError), [handleError])
  useEffect(() => {
    refresh()
  }, [refresh])

  async function move(id, status) {
    setError(null)
    try {
      await setStatus(id, status)
      setItems((all) => all.map((i) => (i.id === id ? { ...i, status } : i)))
    } catch (err) {
      handleError(err)
    }
  }

  // A failed label save reloads the list so the page shows what's really saved.
  const handleLabelError = (err) => {
    handleError(err)
    if (err.code !== 'bad_password') refresh()
  }
  const updateLabels = (id, labels) => setItems((all) => all.map((i) => (i.id === id ? { ...i, labels } : i)))
  const allLabels = [...new Map(items.flatMap((i) => i.labels ?? []).map((l) => [l.toLowerCase(), l])).values()].sort(
    (a, b) => a.localeCompare(b),
  )

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
        <button className={tab === 'events' ? 'tab active' : 'tab'} onClick={() => setTab('events')}>
          Events <span>{activeEvents.length}</span>
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {tab === 'events' && <EventManager items={items} onError={handleError} />}
      <datalist id="label-suggestions">
        {allLabels.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      {tab !== 'events' && shown.length === 0 && <p className="empty">Nothing here right now.</p>}

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
              <LabelEditor
                item={item}
                suggestions={allLabels}
                onChange={(labels) => updateLabels(item.id, labels)}
                onError={handleLabelError}
              />
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

// Labels save as soon as they change. Saves for one photo run in order, so a quick
// add-then-remove can't land out of order.
function LabelEditor({ item, suggestions, onChange, onError }) {
  const labels = item.labels ?? []
  const [draft, setDraft] = useState('')
  const [saveState, setSaveState] = useState(null)
  const queue = useRef(Promise.resolve())
  const latest = useRef(0)

  function save(next) {
    onChange(next)
    const n = ++latest.current
    setSaveState('Saving…')
    queue.current = queue.current
      .then(() => setLabels(item.id, next))
      .then(() => n === latest.current && setSaveState('Saved'))
      .catch((err) => {
        if (n === latest.current) setSaveState("Couldn't save")
        onError(err)
      })
  }

  function add(e) {
    e.preventDefault()
    const text = draft.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH)
    setDraft('')
    if (!text || labels.some((l) => l.toLowerCase() === text.toLowerCase())) return
    // Reuse an existing label's spelling so the gallery filters stay consistent.
    save([...labels, suggestions.find((s) => s.toLowerCase() === text.toLowerCase()) ?? text])
  }

  return (
    <div className="labels">
      <span className="labels-title">Labels</span>
      <ul className="label-list">
        {labels.map((label) => (
          <li key={label} className="label-chip">
            {label}
            <button type="button" onClick={() => save(labels.filter((l) => l !== label))} aria-label={`Remove label ${label}`}>
              ×
            </button>
          </li>
        ))}
        {labels.length === 0 && <li className="labels-empty">No labels yet</li>}
      </ul>
      <form className="label-form" onSubmit={add}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          list="label-suggestions"
          placeholder="Add a label"
          aria-label="Add a label"
          maxLength={MAX_LABEL_LENGTH}
          disabled={labels.length >= MAX_LABELS}
        />
        <button className="button button-outline" type="submit" disabled={!draft.trim()}>
          Add
        </button>
        {saveState && <span className="label-status">{saveState}</span>}
      </form>
    </div>
  )
}

// The events visitors can pick on the photo form and QR sign.
function EventManager({ items, onError }) {
  const { activeEvents, status, setEvents } = useEvents()
  const [name, setName] = useState('')
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
    if (await run(() => addEvent(name))) setName('')
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
      <p className="lead">These are the events visitors can choose on the photo form and the QR sign.</p>
      {status === 'loading' && <p className="empty">Loading events…</p>}
      {status === 'error' && <p className="error">The event list couldn't load. Refresh the page to try again.</p>}
      {status === 'done' && (
        <ul className="event-list">
          {activeEvents.map((e) => (
            <li key={e.id}>
              <div>
                <strong>{e.name}</strong>
                <span>{photoCount(e.id)}</span>
              </div>
              <button
                className={confirmId === e.id ? 'button button-danger' : 'button button-outline'}
                disabled={busy}
                onClick={() => handleDelete(e.id)}
              >
                {confirmId === e.id ? 'Click again to delete' : 'Delete'}
              </button>
            </li>
          ))}
          {activeEvents.length === 0 && <li className="empty">No events yet.</li>}
        </ul>
      )}
      <form className="event-form" onSubmit={handleAdd}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New event name"
          aria-label="New event name"
          maxLength={MAX_EVENT_NAME_LENGTH}
        />
        <button className="button" type="submit" disabled={busy || !cleanEventName(name)}>
          {busy ? 'Saving…' : 'Add event'}
        </button>
      </form>
      {message && <p className="error">{message}</p>}
      <p className="hint">
        Deleting an event takes it off the photo form and QR sign. Photos already shared from it keep the event's name,
        and adding an event with the same name brings it back.
      </p>
    </div>
  )
}
