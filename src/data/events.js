export const EVENTS = [
  { slug: 'praise-house', name: 'Praise House Project' },
  { slug: 'run-through-history', name: 'A Run Through History 5K' },
  { slug: 'volunteer', name: 'Volunteer Day' },
  { slug: 'history-tour', name: 'Guided History Tour' },
]

export const eventName = (slug) => EVENTS.find((e) => e.slug === slug)?.name ?? 'Unknown event'
