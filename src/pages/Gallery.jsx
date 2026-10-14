import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listApproved } from '../data/store'
import { useEvents } from '../events'
import { Photo, WixNote, formatDate } from '../components'

const photoDate = (p) => (p.sample ? 'Photo from southviewpreservation.com' : formatDate(p.submittedAt))
const BURIALS = 'burials'

export default function Gallery() {
  const { events, entry, eventName } = useEvents()
  const [params, setParams] = useSearchParams()
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState('loading')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(null)

  // The filter lives in the URL (#/?event=…), so a burial's photos have a link to share.
  const filter = params.get('event') ?? 'all'
  const setFilter = (id) => setParams(id === 'all' ? {} : { event: id }, { replace: true })

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

  const isBurial = (p) => entry(p.event)?.type === 'burial'
  const countFor = (id) => photos.filter((p) => p.event === id).length
  const burialCount = photos.filter(isBurial).length
  // Current events, plus deleted ones that still have photos in the gallery. Burials are
  // too many for buttons, so they're found by search or the "Burials" button.
  const filters = events.filter((e) => e.type === 'event' && (e.active || countFor(e.id) > 0))
  const selected = filter !== 'all' && filter !== BURIALS ? entry(filter) : null

  // Every word has to appear somewhere in the caption, name or burial details.
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (p) => {
    const e = entry(p.event)
    const text = `${p.caption} ${e?.name ?? ''} ${e?.details ?? ''}`.toLowerCase()
    return words.every((w) => text.includes(w))
  }
  const shown = photos
    .filter((p) => (filter === 'all' ? true : filter === BURIALS ? isBurial(p) : p.event === filter))
    .filter(matches)

  const shareLink = selected?.active ? `/submit?event=${selected.id}` : '/submit'

  return (
    <>
      <section className="hero" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}seed/irises.jpg)` }}>
        <div className="hero-inner">
          <h1>Community Gallery</h1>
          <p>Photos shared by the people who come to South-View, from events and of loved ones buried here.</p>
          <Link to={shareLink} className="button button-light">Share Your Photo</Link>
        </div>
      </section>

      <section className="section">
        <input
          type="search"
          className="gallery-search"
          placeholder="Search by name, event or caption"
          aria-label="Search photos"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="chips" role="tablist" aria-label="Filter photos">
          <button className={filter === 'all' ? 'chip active' : 'chip'} onClick={() => setFilter('all')}>
            All photos <span>{photos.length}</span>
          </button>
          {filters.map((e) => (
            <button key={e.id} className={filter === e.id ? 'chip active' : 'chip'} onClick={() => setFilter(e.id)}>
              {e.name} <span>{countFor(e.id)}</span>
            </button>
          ))}
          {burialCount > 0 && (
            <button className={filter === BURIALS ? 'chip active' : 'chip'} onClick={() => setFilter(BURIALS)}>
              Burials <span>{burialCount}</span>
            </button>
          )}
          {selected?.type === 'burial' && (
            <button className="chip active" onClick={() => setFilter('all')} aria-label={`Clear ${selected.name}`}>
              {selected.name} <span>{countFor(selected.id)}</span> ×
            </button>
          )}
        </div>

        {selected?.type === 'burial' && (
          <div className="burial-head">
            <h2>{selected.name}</h2>
            {selected.details && <p>{selected.details}</p>}
            {selected.active && (
              <Link to={shareLink} className="button button-outline">Add a photo of {selected.name}</Link>
            )}
          </div>
        )}

        {loading === 'loading' ? (
          <p className="empty">Loading photos…</p>
        ) : loading === 'error' ? (
          <p className="empty error">The gallery couldn't load. Check your connection and refresh the page.</p>
        ) : shown.length === 0 ? (
          <p className="empty">
            {words.length ? `No photos match "${query.trim()}".` : filter === 'all' ? 'No approved photos yet.' : 'No approved photos here yet.'}
          </p>
        ) : (
          <div className="grid">
            {shown.map((p) => (
              <figure key={p.id} className="card" onClick={() => setOpen(p)}>
                <div className="card-photo">
                  <Photo record={p} loading="lazy" />
                  {p.sample && <span className="sample-tag">Sample</span>}
                </div>
                <figcaption>
                  <button
                    className="card-event"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFilter(p.event)
                    }}
                  >
                    {eventName(p.event)}
                  </button>
                  {p.caption && <span className="card-caption">{p.caption}</span>}
                  <span className="card-date">{photoDate(p)}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        <WixNote>
          this grid is a Pro Gallery connected to the CMS Collection, filtered to rows where
          the approval field is true and grouped by the event or burial field. The search box
          filters the same Collection.
        </WixNote>
      </section>

      {open && (
        <div className="lightbox" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <figure onClick={(e) => e.stopPropagation()}>
            <Photo record={open} />
            <figcaption>
              <strong>{eventName(open.event)}</strong>
              {isBurial(open) && entry(open.event).details && <span className="card-date">{entry(open.event).details}</span>}
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
