import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { useEvents } from '../events'
import { WixNote } from '../components'

const submitUrl = (slug) =>
  `${window.location.origin}${import.meta.env.BASE_URL}#/submit?event=${slug}`

const qrImage = (slug, width) => QRCode.toDataURL(submitUrl(slug), { width, margin: 1, color: { dark: '#1A1D1A' } })

export default function QrSign() {
  const [params, setParams] = useSearchParams()
  const { activeEvents, activeBurials, status } = useEvents()
  const all = [...activeEvents, ...activeBurials]
  const chosen = all.find((e) => e.id === params.get('event')) ?? all[0]
  const [qr, setQr] = useState(null)
  const [png, setPng] = useState(null)

  useEffect(() => {
    if (!chosen) return
    qrImage(chosen.id, 480).then(setQr)
    qrImage(chosen.id, 1200).then(setPng)
  }, [chosen?.id])

  if (params.get('labels') === 'burials') return <BurialLabels burials={activeBurials} onBack={() => setParams({})} />

  if (!chosen) {
    return (
      <section className="section narrow center">
        <h1>QR Codes</h1>
        <p className={status === 'error' ? 'lead error' : 'lead'}>
          {status === 'loading'
            ? 'Loading…'
            : status === 'error'
              ? "The list couldn't load. Check your connection and refresh the page."
              : 'There are no events or burials yet. Add them on the Staff page.'}
        </p>
      </section>
    )
  }

  const burial = chosen.type === 'burial'

  return (
    <section className="section">
      <div className="qr-controls no-print">
        <h1>QR Codes</h1>
        <p className="lead">
          Print a sign for the welcome table at an event, or a code to place at a grave. Scanning it opens the photo
          form with this already chosen.
        </p>
        <label>
          <span>Sign for</span>
          <select value={chosen.id} onChange={(e) => setParams({ event: e.target.value })}>
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
        </label>
        <div className="actions">
          <button className="button" onClick={() => window.print()}>Print sign</button>
          {png && (
            <a className="button button-outline" href={png} download={`south-view-qr-${chosen.id}.png`}>Download QR image</a>
          )}
          <Link className="button button-outline" to={`/submit?event=${chosen.id}`}>Open the form</Link>
          {activeBurials.length > 0 && (
            <button className="button button-outline" onClick={() => setParams({ labels: 'burials' })}>
              Print all burial codes
            </button>
          )}
        </div>
      </div>

      <div className="sign">
        <p className="sign-kicker">Historic South-View</p>
        {burial ? (
          <>
            <h2>In memory of {chosen.name}</h2>
            {chosen.details && <p className="sign-details">{chosen.details}</p>}
            <p className="sign-event">Share a photo or memory</p>
          </>
        ) : (
          <>
            <h2>Were you here today?</h2>
            <p className="sign-event">Share your photos from {chosen.name}</p>
          </>
        )}
        {qr && <img className="sign-qr" src={qr} alt={`QR code linking to the photo form for ${chosen.name}`} />}
        <ol>
          <li>Point your phone camera at the code</li>
          <li>Pick one or more photos and add a caption if you like</li>
          <li>South-View staff review every photo before it goes online</li>
        </ol>
      </div>

      <div className="no-print">
        <WixNote>the code points to the same Wix Form, with the event or burial already filled in.</WixNote>
      </div>
    </section>
  )
}

// A sheet of small labeled codes, one per burial, to cut out and place at each grave.
function BurialLabels({ burials, onBack }) {
  const [codes, setCodes] = useState({})

  useEffect(() => {
    Promise.all(burials.map((b) => qrImage(b.id, 360).then((url) => [b.id, url]))).then((pairs) =>
      setCodes(Object.fromEntries(pairs)),
    )
  }, [burials])

  return (
    <section className="section">
      <div className="qr-controls no-print">
        <h1>Burial QR Codes</h1>
        <p className="lead">
          One code per burial, {burials.length} in all. Print, cut out, and place each one at its grave.
        </p>
        <div className="actions">
          <button className="button" onClick={() => window.print()}>Print codes</button>
          <button className="button button-outline" onClick={onBack}>Back to one sign</button>
        </div>
      </div>
      <div className="labels">
        {burials.map((b) => (
          <div key={b.id} className="label">
            {codes[b.id] && <img src={codes[b.id]} alt={`QR code for ${b.name}`} />}
            <strong>{b.name}</strong>
            {b.details && <span>{b.details}</span>}
            <small>Scan to share a photo</small>
          </div>
        ))}
        {burials.length === 0 && <p className="empty">No burials yet. Add them on the Staff page.</p>}
      </div>
    </section>
  )
}
