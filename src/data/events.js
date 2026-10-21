// The events the site starts with. Staff add and delete events and burials on the Staff
// page; with the Google Sheet connected they live in its Events tab, with Type "event"
// or "burial". A burial's Details hold things like its years or section.
export const DEFAULT_EVENTS = [
  { id: 'praise-house', name: 'Praise House Project', type: 'event', details: '' },
  { id: 'run-through-history', name: 'A Run Through History 5K', type: 'event', details: '' },
  { id: 'volunteer', name: 'Volunteer Day', type: 'event', details: '' },
  { id: 'history-tour', name: 'Guided History Tour', type: 'event', details: '' },
]

export const MAX_EVENT_NAME_LENGTH = 60
export const MAX_DETAILS_LENGTH = 80

const clean = (text, max) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
export const cleanEventName = (name) => clean(name, MAX_EVENT_NAME_LENGTH)
export const cleanDetails = (details) => clean(details, MAX_DETAILS_LENGTH)

// A burial photo that passed the AI check shows on that person's gallery page until
// midnight of the day it was shared (its shownUntil), before staff have reviewed it.
export const isShownToday = (photo) => Boolean(photo.shownUntil) && new Date(photo.shownUntil) > new Date()

// Burial IDs include the details, so two people with the same name get separate pages.
// Matches entryId() in apps-script/Code.gs.
export const entryId = (name, type, details) =>
  type === 'burial' ? slugify(`burial ${name} ${details}`) : slugify(name)

// "Praise House Project" → "praise-house-project". Matches slugify() in apps-script/Code.gs.
export function slugify(name) {
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/, '')
  if (!slug) return 'event-' + shortHash(String(name))
  return /^[a-z]/.test(slug) ? slug : 'event-' + slug
}

function shortHash(text) {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0
  return (hash >>> 0).toString(36)
}
