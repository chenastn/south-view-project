import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useEvents } from '../events'
import { addSubmission } from '../data/store'
import { checkSubmission } from '../moderation'
import { resizeImage } from '../utils/resizeImage'
import { WixNote } from '../components'

export default function Submit() {
  const [params] = useSearchParams()
  const { activeEvents, eventName, status: eventsStatus } = useEvents()

  const [event, setEvent] = useState(params.get('event') ?? '')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [caption, setCaption] = useState('')
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState('idle')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // The event from the QR code (or the visitor's pick) counts once it's on the loaded list.
  const chosenEvent = activeEvents.some((e) => e.id === event) ? event : ''
  const ready = chosenEvent && file && consent && (state === 'idle' || state === 'error')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!ready) return
    setState('checking')
    try {
      const image = (await resizeImage(file).catch(() => null)) ?? file
      const aiCheck = await checkSubmission({ caption, fileName: file.name })
      await addSubmission({
        id: crypto.randomUUID(),
        event: chosenEvent,
        caption: caption.trim(),
        consent,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        image,
        imageSrc: null,
        fileName: file.name,
        sample: false,
        aiCheck,
      })
      setState('done')
    } catch (err) {
      // Messages from the script (like a deleted event) are worth showing; network errors aren't.
      setError(err.code ? err.message : null)
      setState('error')
    }
  }

  function reset() {
    setFile(null)
    setCaption('')
    setConsent(false)
    setState('idle')
  }

  if (state === 'done') {
    return (
      <section className="section narrow center">
        <h1>Thank you for sharing</h1>
        <p className="lead">
          Your photo from <strong>{eventName(event)}</strong> was sent to South-View. It will
          appear in the gallery after a staff member reviews it.
        </p>
        <div className="actions">
          <button className="button" onClick={reset}>Share another photo</button>
          <Link to="/" className="button button-outline">View the gallery</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="section narrow">
      <h1>Share a Photo</h1>
      <p className="lead">
        Were you at a South-View event? Add your photo to the community gallery. A South-View
        staff member reviews every photo before it goes online.
      </p>

      <form className="form" onSubmit={handleSubmit}>
        <label>
          <span>Which event?</span>
          <select value={chosenEvent} onChange={(e) => setEvent(e.target.value)} required disabled={eventsStatus !== 'done'}>
            <option value="" disabled>{eventsStatus === 'loading' ? 'Loading events…' : 'Choose an event'}</option>
            {activeEvents.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          {eventsStatus === 'error' && (
            <small className="error">The event list couldn't load. Check your connection and refresh the page.</small>
          )}
          {eventsStatus === 'done' && activeEvents.length === 0 && <small>No events are taking photos right now.</small>}
        </label>

        <label>
          <span>Your photo</span>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] ?? null)} required />
        </label>
        {preview && <img className="preview" src={preview} alt="Preview of your photo" />}

        <label>
          <span>Caption <em>(optional)</em></span>
          <textarea
            rows={3}
            maxLength={280}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="What's happening in this photo?"
          />
          <small>Your caption is also read aloud to visitors who use screen readers.</small>
        </label>

        <label className="checkbox">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            I took this photo or have permission to share it, and I agree that South-View may
            show it on their website.
          </span>
        </label>

        {state === 'error' && (
          <p className="error">{error ?? "Your photo didn't send. Check your connection and try again."}</p>
        )}
        <button className="button" type="submit" disabled={!ready}>
          {state === 'checking' ? 'Sending…' : state === 'error' ? 'Try again' : 'Send for review'}
        </button>
      </form>

      <WixNote>
        this is a Wix Form that writes each submission into the CMS Collection with the
        approval field set to false, so nothing is public until staff approve it.
      </WixNote>
    </section>
  )
}
