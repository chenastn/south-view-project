import { Fragment, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listGallery } from '../data/store'
import { isShownToday } from '../data/events'
import { useEvents } from '../events'
import { Photo, WixNote, formatDate } from '../components'

const photoDate = (p) => (p.sample ? 'Photo from southviewpreservation.com' : formatDate(p.submittedAt))
const BURIALS = 'burials'

// Splits photos, already newest first, into one group per day they were shared.
function byDay(photos) {
  const groups = []
  for (const p of photos) {
    const day = formatDate(p.submittedAt)
    const last = groups[groups.length - 1]
    if (last?.day === day) last.photos.push(p)
    else groups.push({ day, photos: [p] })
  }
  return groups
}

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
    listGallery()
      .then((list) => {
        setPhotos(list)
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
  // Burial photos that passed the AI check today (they have shownUntil) show in the Burials
  // view and on that person's page until midnight. All photos and events are approved only.
  const approved = photos.filter((p) => !p.shownUntil)
  const withToday = photos.filter((p) => !p.shownUntil || isShownToday(p))
  const countFor = (id) => withToday.filter((p) => p.event === id).length
  const burialPhotos = withToday.filter(isBurial)
  // Current events, plus deleted ones that still have photos in the gallery.
  const filters = events.filter((e) => e.type === 'event' && (e.active || countFor(e.id) > 0))
  const selected = filter !== 'all' && filter !== BURIALS ? entry(filter) : null
  const inBurials = filter === BURIALS || selected?.type === 'burial'
  // Burials are too many for buttons, so the Burials view narrows to one person with a list
  // of everyone who has photos.
  const people = events
    .filter((e) => e.type === 'burial' && (e.id === filter || countFor(e.id) > 0))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Every word has to appear somewhere in the caption, name or burial details.
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (p) => {
    const e = entry(p.event)
    const text = `${p.caption} ${e?.name ?? ''} ${e?.details ?? ''}`.toLowerCase()
    return words.every((w) => text.includes(w))
  }
  const inView = filter === 'all' ? approved : filter === BURIALS ? burialPhotos : withToday.filter((p) => p.event === filter)
  const shown = inView.filter(matches)
  // Burial photos are grouped by the day they were shared, newest first.
  const groups = inBurials ? byDay(shown) : [{ day: null, photos: shown }]
  const today = formatDate(new Date())
  const todayNote = shown.some((p) => p.shownUntil) && (
    <p className="burial-day-note">
      Photos marked <strong>Shared today</strong> passed an automatic check and are shown until midnight.
      After that, they're hidden until a South-View staff member approves them.
    </p>
  )

  const shareLink = selected?.active ? `/submit?event=${selected.id}` : '/submit'
  const emptyText = words.length
    ? `No photos match "${query.trim()}".`
    : filter === 'all'
      ? 'No approved photos yet.'
      : filter === BURIALS
        ? 'No burial photos yet.'
        : selected?.type === 'burial'
          ? `No photos of ${selected.name} yet.`
          : 'No approved photos here yet.'

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
            All photos <span>{approved.length}</span>
          </button>
          {filters.map((e) => (
            <button key={e.id} className={filter === e.id ? 'chip active' : 'chip'} onClick={() => setFilter(e.id)}>
              {e.name} <span>{countFor(e.id)}</span>
            </button>
          ))}
          {(inBurials || people.length > 0) && (
            <button className={inBurials ? 'chip active' : 'chip'} onClick={() => setFilter(BURIALS)}>
              Burials <span>{burialPhotos.length}</span>
            </button>
          )}
        </div>

        {inBurials && (
          <label className="person-filter">
            <span>Person</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value={BURIALS}>All burials</option>
              {people.map((e) => {
                const n = countFor(e.id)
                return (
                  <option key={e.id} value={e.id}>
                    {`${e.details ? `${e.name} (${e.details})` : e.name} · ${n} ${n === 1 ? 'photo' : 'photos'}`}
                  </option>
                )
              })}
            </select>
          </label>
        )}
        {filter === BURIALS && todayNote}

        {selected?.type === 'burial' && (
          <div className="burial-head">
            <h2>{selected.name}</h2>
            {selected.details && <p>{selected.details}</p>}
            {todayNote}
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
          <p className="empty">{emptyText}</p>
        ) : (
          groups.map((g) => (
            <Fragment key={g.day ?? 'all'}>
              {g.day && <h3 className="day-heading">{g.day === today ? 'Today' : g.day}</h3>}
              <div className="grid">
                {g.photos.map((p) => (
                  <figure key={p.id} className="card" onClick={() => setOpen(p)}>
                    <div className="card-photo">
                      <Photo record={p} loading="lazy" />
                      {p.sample && <span className="photo-tag">Sample</span>}
                      {p.shownUntil && <span className="photo-tag today-tag">Shared today</span>}
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
                      {!g.day && <span className="card-date">{photoDate(p)}</span>}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </Fragment>
          ))
        )}

        <WixNote>
          this grid is a Pro Gallery connected to the CMS Collection, filtered to rows where
          the approval field is true and grouped by the event or burial field. The Burials view
          and each burial's page also let through photos whose "shown until" date, set by the
          AI check, hasn't passed yet. The search box filters the same Collection.
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
              <span className="card-date">{open.shownUntil ? 'Shared today · not yet reviewed by staff' : photoDate(open)}</span>
            </figcaption>
            <button className="lightbox-close" onClick={() => setOpen(null)} aria-label="Close">×</button>
          </figure>
        </div>
      )}
    </>
  )
}
