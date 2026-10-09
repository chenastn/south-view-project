import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { useEvents } from '../events'
import { WixNote } from '../components'

const submitUrl = (slug) =>
  `${window.location.origin}${import.meta.env.BASE_URL}#/submit?event=${slug}`

export default function QrSign() {
  const [params, setParams] = useSearchParams()
  const { activeEvents, eventName, status } = useEvents()
  const slug = activeEvents.some((e) => e.id === params.get('event')) ? params.get('event') : activeEvents[0]?.id
  const [qr, setQr] = useState(null)

  useEffect(() => {
    if (!slug) return
    QRCode.toDataURL(submitUrl(slug), { width: 480, margin: 1, color: { dark: '#1A1D1A' } }).then(setQr)
  }, [slug])

  if (!slug) {
    return (
      <section className="section narrow center">
        <h1>QR Sign</h1>
        <p className={status === 'error' ? 'lead error' : 'lead'}>
          {status === 'loading'
            ? 'Loading events…'
            : status === 'error'
              ? "The event list couldn't load. Check your connection and refresh the page."
              : 'There are no events yet. Add one on the Staff page under Events.'}
        </p>
      </section>
    )
  }

  return (
    <section className="section">
      <div className="qr-controls no-print">
        <h1>QR Sign</h1>
        <p className="lead">Print this and put it on the welcome table at an event.</p>
        <label>
          <span>Event</span>
          <select value={slug} onChange={(e) => setParams({ event: e.target.value })}>
            {activeEvents.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </label>
        <div className="actions">
          <button className="button" onClick={() => window.print()}>Print sign</button>
          <Link className="button button-outline" to={`/submit?event=${slug}`}>Open the form</Link>
        </div>
      </div>

      <div className="sign">
        <p className="sign-kicker">Historic South-View</p>
        <h2>Were you here today?</h2>
        <p className="sign-event">Share your photos from {eventName(slug)}</p>
        {qr && <img className="sign-qr" src={qr} alt={`QR code linking to the photo form for ${eventName(slug)}`} />}
        <ol>
          <li>Point your phone camera at the code</li>
          <li>Pick a photo and add a caption if you like</li>
          <li>South-View staff review every photo before it goes online</li>
        </ol>
      </div>

      <div className="no-print">
        <WixNote>the code points to the same Wix Form, with the event already filled in.</WixNote>
      </div>
    </section>
  )
}
