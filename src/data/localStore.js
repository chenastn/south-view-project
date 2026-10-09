import { createStore, entries, set, get, clear, setMany } from 'idb-keyval'
import { seedRecords } from './seed'
import { DEFAULT_EVENTS, cleanEventName, slugify } from './events'

// Demo backend: everything lives in this browser's IndexedDB, seeded with sample photos.
// Each record mirrors one row of the Google Sheet:
// image, event, caption, consent, status, aiCheck, submittedAt.
const db = createStore('south-view-gallery', 'submissions')
const SEEDED_KEY = '__seeded'
const EVENTS_KEY = '__events'
const DEMO_PIN = '1886'
const UNLOCK_KEY = 'south-view-staff-unlocked'

async function ensureSeeded() {
  if (await get(SEEDED_KEY, db)) return
  await setMany([...seedRecords().map((r) => [r.id, r]), [SEEDED_KEY, true]], db)
}

export async function listAll() {
  await ensureSeeded()
  const all = await entries(db)
  return all
    .filter(([key]) => !String(key).startsWith('__'))
    .map(([, record]) => record)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

export async function listApproved() {
  return (await listAll()).filter((r) => r.status === 'approved')
}

export async function addSubmission(record) {
  await ensureSeeded()
  await set(record.id, record, db)
}

export async function setStatus(id, status) {
  const record = await get(id, db)
  if (record) await set(id, { ...record, status }, db)
}

export async function listEvents() {
  return (await get(EVENTS_KEY, db)) ?? DEFAULT_EVENTS.map((e) => ({ ...e, active: true }))
}

// Same rules as the Apps Script: re-adding a deleted event brings it back.
export async function addEvent(name) {
  const clean = cleanEventName(name)
  if (!clean) throw new Error('Enter a name for the event.')
  const id = slugify(clean)
  const events = await listEvents()
  // Match by name first: the original events have short IDs not made from their names.
  const existing =
    events.find((e) => e.name.toLowerCase() === clean.toLowerCase()) ?? events.find((e) => e.id === id)
  if (existing?.active) throw new Error(`There is already an event called "${existing.name}".`)
  const next = existing
    ? events.map((e) => (e.id === existing.id ? { ...e, name: clean, active: true } : e))
    : [...events, { id, name: clean, active: true }]
  await set(EVENTS_KEY, next, db)
  return next
}

export async function deleteEvent(id) {
  const next = (await listEvents()).map((e) => (e.id === id ? { ...e, active: false } : e))
  await set(EVENTS_KEY, next, db)
  return next
}

export async function resetDemo() {
  await clear(db)
  await ensureSeeded()
}

export async function unlockStaff(pin) {
  if (pin !== DEMO_PIN) return false
  sessionStorage.setItem(UNLOCK_KEY, 'yes')
  return true
}

export const isStaffUnlocked = () => sessionStorage.getItem(UNLOCK_KEY) === 'yes'
export const lockStaff = () => sessionStorage.removeItem(UNLOCK_KEY)
