import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { listEvents } from './data/store'

const EventsContext = createContext(null)

// Loads the event list once for the whole site. Staff changes replace it via setEvents.
export function EventsProvider({ children }) {
  const [events, setEvents] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let cancelled = false
    // A weak signal at an event can drop one request, so try a few times before giving up.
    const load = (attempt) =>
      listEvents()
        .then((list) => {
          if (cancelled) return
          setEvents(list)
          setStatus('done')
        })
        .catch(() => {
          if (cancelled) return
          if (attempt < 3) setTimeout(() => load(attempt + 1), attempt * 2000)
          else setStatus('error')
        })
    load(1)
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    () => ({
      events,
      activeEvents: events.filter((e) => e.active),
      status,
      setEvents,
      eventName: (id) => events.find((e) => e.id === id)?.name ?? (status === 'loading' ? '' : 'Unknown event'),
    }),
    [events, status],
  )

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>
}

export const useEvents = () => useContext(EventsContext)
