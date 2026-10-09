// The events the site starts with. Staff add and delete events on the Staff page; with
// the Google Sheet connected they live in its Events tab.
export const DEFAULT_EVENTS = [
  { id: 'praise-house', name: 'Praise House Project' },
  { id: 'run-through-history', name: 'A Run Through History 5K' },
  { id: 'volunteer', name: 'Volunteer Day' },
  { id: 'history-tour', name: 'Guided History Tour' },
]

export const MAX_EVENT_NAME_LENGTH = 60

export const cleanEventName = (name) => String(name).replace(/\s+/g, ' ').trim().slice(0, MAX_EVENT_NAME_LENGTH)

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
