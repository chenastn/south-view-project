import { createStore, entries, set, get, clear, setMany } from 'idb-keyval'
import { seedRecords } from './seed'

// Each record mirrors one row of the planned Wix CMS Collection:
// image, event, caption, consent, status (approved flag), aiCheck, submittedAt.
const db = createStore('south-view-gallery', 'submissions')
const SEEDED_KEY = '__seeded'

async function ensureSeeded() {
  if (await get(SEEDED_KEY, db)) return
  await setMany([...seedRecords().map((r) => [r.id, r]), [SEEDED_KEY, true]], db)
}

export async function listSubmissions() {
  await ensureSeeded()
  const all = await entries(db)
  return all
    .filter(([key]) => key !== SEEDED_KEY)
    .map(([, record]) => record)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

export async function addSubmission(record) {
  await ensureSeeded()
  await set(record.id, record, db)
}

export async function setStatus(id, status) {
  const record = await get(id, db)
  if (record) await set(id, { ...record, status }, db)
}

export async function resetDemo() {
  await clear(db)
  await ensureSeeded()
}
