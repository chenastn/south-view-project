import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useEvents } from '../events'
import { addSubmission } from '../data/store'
import { isShownToday } from '../data/events'
import { checkSubmission } from '../moderation'
import { resizeImage } from '../utils/resizeImage'
import { WixNote } from '../components'

const MAX_PHOTOS = 5

export default function Submit() {
  const [params] = useSearchParams()
  const { activeEvents, activeBurials, status: eventsStatus } = useEvents()

  const [event, setEvent] = useState(params.get('event') ?? '')
  // A QR code already says where the photos are from, so the dropdown stays hidden.
  const [picking, setPicking] = useState(!params.get('event'))
  const [files, setFiles] = useState([])
  const [caption, setCaption] = useState('')
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState('idle')
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(null)
  const [sentCount, setSentCount] = useState(0)
  // Burial photos that passed the AI check and are in the gallery already.
  const [shownCount, setShownCount] = useState(0)

  // The event from the QR code (or the visitor's pick) counts once it's on the loaded list.
  const chosen = [...activeEvents, ...activeBurials].find((e) => e.id === event)
  const ready = chosen && files.length > 0 && consent && (state === 'idle' || state === 'error')
  const plural = files.length > 1

  function addFiles(list) {
    const picked = [...list].map((file) => ({ key: crypto.randomUUID(), file }))
    setFiles((current) => [...current, ...picked].slice(0, MAX_PHOTOS))
    if (state === 'error') setState('idle')
  }

  // Photos go one at a time, so a weak signal at an event loses at most one, and the
  // ones already sent drop off the list. "Try again" sends whatever is left.
  async function handleSubmit(e) {
    e.preventDefault()
    if (!ready) return
    const batch = files
    setState('sending')
    setError(null)
    let sent = 0
    let shown = 0
    for (const item of batch) {
      setProgress({ current: sent + 1, total: batch.length })
      try {
        const [image, aiCheck] = await Promise.all([
          resizeImage(item.file).catch(() => null).then((img) => img ?? item.file),
          checkSubmission({ caption, fileName: item.file.name }),
        ])
        const saved = await addSubmission({
          id: crypto.randomUUID(),
          event: chosen.id,
          caption: caption.trim(),
          consent,
          status: 'pending',
          submittedAt: new Date().toISOString(),
          image,
          imageSrc: null,
          fileName: item.file.name,
          sample: false,
          aiCheck,
        })
        if (saved && isShownToday(saved)) shown++
      } catch (err) {
        // Messages from the script (like a deleted event) are worth showing; network errors aren't.
        setSentCount((n) => n + sent)
        setShownCount((n) => n + shown)
        setError({ sent, total: batch.length, message: err.code ? err.message : null })
        setState('error')
        return
      }
      sent++
      setFiles((current) => current.filter((f) => f !== item))
    }
    setSentCount((n) => n + sent)
    setShownCount((n) => n + shown)
    setState('done')
  }

  function reset() {
    setFiles([])
    setCaption('')
    setConsent(false)
    setSentCount(0)
    setShownCount(0)
    setState('idle')
  }

  if (state === 'done') {
    const what = sentCount === 1 ? 'Your photo' : `Your ${sentCount} photos`
    return (
      <section className="section narrow center">
        <h1>Thank you for sharing</h1>
        {shownCount > 0 ? (
          <p className="lead">
            {shownCount === sentCount ? what : `${shownCount} of your ${sentCount} photos`}{' '}
            {shownCount === 1 ? 'is' : 'are'} on <strong>{chosen.name}</strong>'s page now and will stay up until
            midnight. A South-View staff member reviews every photo before it's added to the gallery for good.
          </p>
        ) : (
          <p className="lead">
            {what} {chosen.type === 'burial' ? 'of' : 'from'} <strong>{chosen.name}</strong>{' '}
            {sentCount === 1 ? 'was' : 'were'} sent to South-View. {sentCount === 1 ? 'It' : 'They'} will appear in
            the gallery after a staff member reviews {sentCount === 1 ? 'it' : 'them'}.
          </p>
        )}
        <div className="actions">
          <button className="button" onClick={reset}>Share more photos</button>
          <Link to={`/?event=${chosen.id}`} className="button button-outline">
            See photos {chosen.type === 'burial' ? 'of' : 'from'} {chosen.name}
          </Link>
        </div>
      </section>
    )
  }

  const sending = state === 'sending'

  return (
    <section className="section narrow">
      <h1>Share a Photo</h1>
      <p className="lead">
        {chosen?.type === 'burial'
          ? `Add a photo or memory of ${chosen.name} to South-View's community gallery. Photos that pass an automatic check appear on ${chosen.name}'s page right away, until midnight. A South-View staff member reviews every photo before it's added for good.`
          : 'Were you at a South-View event? Add your photos to the community gallery. A South-View staff member reviews every photo before it goes online.'}
      </p>

      <form className="form" onSubmit={handleSubmit}>
        {chosen && !picking ? (
          <div className="sharing-to">
            <span>{chosen.type === 'burial' ? 'Photos of' : 'Photos from'}</span>
            <strong>{chosen.name}</strong>
            {chosen.details && <small>{chosen.details}</small>}
            <button type="button" className="link-button" onClick={() => setPicking(true)} disabled={sending}>
              Change
            </button>
          </div>
        ) : (
          <label>
            <span>Which event or burial?</span>
            <select value={chosen?.id ?? ''} onChange={(e) => setEvent(e.target.value)} required disabled={eventsStatus !== 'done' || sending}>
              <option value="" disabled>{eventsStatus === 'loading' ? 'Loading…' : 'Choose one'}</option>
              <optgroup label="Events">
                {activeEvents.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </optgroup>
              {activeBurials.length > 0 && (
                <optgroup label="Burials">
                  {activeBurials.map((e) => (
                    <option key={e.id} value={e.id}>{e.details ? `${e.name} (${e.details})` : e.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {eventsStatus === 'error' && (
              <small className="error">The list couldn't load. Check your connection and refresh the page.</small>
            )}
            {eventsStatus === 'done' && activeEvents.length + activeBurials.length === 0 && (
              <small>Nothing is taking photos right now.</small>
            )}
          </label>
        )}

        <div className="photo-picker">
          <span>Your photos <em>(up to {MAX_PHOTOS})</em></span>
          {files.length > 0 && (
            <ul className="thumbs">
              {files.map((item) => (
                <Thumb key={item.key} file={item.file} onRemove={sending ? null : () => setFiles((all) => all.filter((f) => f !== item))} />
              ))}
            </ul>
          )}
          {files.length < MAX_PHOTOS && !sending && (
            <label className="button button-outline file-button">
              {files.length ? 'Add more photos' : 'Choose photos'}
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
          )}
        </div>

        <label>
          <span>Caption <em>(optional)</em></span>
          <textarea
            rows={3}
            maxLength={280}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={chosen?.type === 'burial' ? 'A memory, or who is in the photo' : "What's happening in this photo?"}
            disabled={sending}
          />
          <small>
            {plural && !sending ? `This caption goes with all ${files.length} photos. ` : ''}
            Your caption is also read aloud to visitors who use screen readers.
          </small>
        </label>

        <label className="checkbox">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={sending} />
          <span>
            I took {plural ? 'these photos' : 'this photo'} or have permission to share{' '}
            {plural ? 'them' : 'it'}, and I agree that South-View may show {plural ? 'them' : 'it'} on their website.
          </span>
        </label>

        {state === 'error' && (
          <p className="error">
            {error.sent > 0 && `${error.sent} of ${error.total} sent. `}
            {error.message ?? "The rest didn't send. Check your connection and try again."}
          </p>
        )}
        <button className="button" type="submit" disabled={!ready}>
          {sending
            ? progress.total > 1
              ? `Sending ${progress.current} of ${progress.total}…`
              : 'Sending…'
            : state === 'error'
              ? 'Try again'
              : plural
                ? `Send ${files.length} photos for review`
                : 'Send for review'}
        </button>
      </form>

      <WixNote>
        this is a Wix Form that writes each photo into the CMS Collection with the
        approval field set to false, so nothing is public until staff approve it. The one
        exception is a burial photo that passes the AI check: it shows in the Burials view
        and on that person's page until midnight.
      </WixNote>
    </section>
  )
}

function Thumb({ file, onRemove }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  return (
    <li className="thumb">
      {url && <img src={url} alt={`Preview of ${file.name}`} />}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`}>×</button>
      )}
    </li>
  )
}
