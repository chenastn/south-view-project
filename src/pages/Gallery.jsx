import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listApproved } from '../data/store'
import { useEvents } from '../events'
import { Photo, WixNote, formatDate } from '../components'

const photoDate = (p) => (p.sample ? 'Photo from southviewpreservation.com' : formatDate(p.submittedAt))
const labelKey = (label) => label.toLowerCase()

// One filter per label on the approved photos, most-used first. Labels that differ only
// in capitalisation (easy to do when editing the Sheet) count as the same label.
function labelFilters(photos) {
  const byKey = new Map()
  for (const label of photos.flatMap((p) => p.labels ?? [])) {
    const entry = byKey.get(labelKey(label)) ?? { key: labelKey(label), name: label, count: 0 }
    entry.count++
    byKey.set(entry.key, entry)
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export default function Gallery() {
  const { eventName } = useEvents()
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState('loading')
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null)

  useEffect(() => {
    listApproved()
      .then((approved) => {
        setPhotos(approved)
        setLoading('done')
      })
      .catch(() => setLoading('error'))
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const filters = labelFilters(photos)
  const shown = filter === 'all' ? photos : photos.filter((p) => (p.labels ?? []).some((l) => labelKey(l) === filter))

  return (
    <>
      <section className="hero" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}seed/irises.jpg)` }}>
        <div className="hero-inner">
          <h1>Community Gallery</h1>
          <p>Photos shared by the people who come to South-View.</p>
          <Link to="/submit" className="button button-light">Share Your Photo</Link>
        </div>
      </section>

      <section className="section">
        <div className="chips" role="tablist" aria-label="Filter by label">
          <button className={filter === 'all' ? 'chip active' : 'chip'} onClick={() => setFilter('all')}>
            All photos <span>{photos.length}</span>
          </button>
          {filters.map((f) => (
            <button key={f.key} className={filter === f.key ? 'chip active' : 'chip'} onClick={() => setFilter(f.key)}>
              {f.name} <span>{f.count}</span>
            </button>
          ))}
        </div>

        {loading === 'loading' ? (
          <p className="empty">Loading photos…</p>
        ) : loading === 'error' ? (
          <p className="empty error">The gallery couldn't load. Check your connection and refresh the page.</p>
        ) : shown.length === 0 ? (
          <p className="empty">{filter === 'all' ? 'No approved photos yet.' : 'No photos with this label yet.'}</p>
        ) : (
          <div className="grid">
            {shown.map((p) => (
              <figure key={p.id} className="card" onClick={() => setOpen(p)}>
                <div className="card-photo">
                  <Photo record={p} loading="lazy" />
                  {p.sample && <span className="sample-tag">Sample</span>}
                </div>
                <figcaption>
                  <span className="card-event">{eventName(p.event)}</span>
                  {p.caption && <span className="card-caption">{p.caption}</span>}
                  <span className="card-date">{photoDate(p)}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        <WixNote>
          this grid is a Pro Gallery connected to the CMS Collection, filtered to rows where
          the approval field is true and grouped by the labels field.
        </WixNote>
      </section>

      {open && (
        <div className="lightbox" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <figure onClick={(e) => e.stopPropagation()}>
            <Photo record={open} />
            <figcaption>
              <strong>{eventName(open.event)}</strong>
              {open.caption && <span>{open.caption}</span>}
              <span className="card-date">{photoDate(open)}</span>
            </figcaption>
            <button className="lightbox-close" onClick={() => setOpen(null)} aria-label="Close">×</button>
          </figure>
        </div>
      )}
    </>
  )
}
