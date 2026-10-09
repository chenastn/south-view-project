// Live backend: the Google Apps Script web app in apps-script/Code.gs, which keeps
// rows in a Google Sheet and photos in a Drive folder. No API key: the script runs
// as the Google account that deployed it.
const API_URL = import.meta.env.VITE_APPS_SCRIPT_URL
const PASSWORD_KEY = 'south-view-staff-password'

// Google doesn't document a way to show Drive files in <img> tags. These are the two
// URL formats that work today (the older uc?export=view links already broke). If
// photos stop loading, this is the one place to fix it.
const driveImage = (fileId) => `https://lh3.googleusercontent.com/d/${fileId}=w1600`
const driveThumbnail = (fileId) => `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`

const toRecord = (row) => ({
  ...row,
  imageSrc: driveImage(row.fileId),
  imageFallback: driveThumbnail(row.fileId),
  image: null,
  sample: false,
})

async function parse(res) {
  if (!res.ok) throw new Error(`The server responded with ${res.status}`)
  const data = await res.json()
  if (!data.ok) throw Object.assign(new Error(data.error), { code: data.code })
  return data
}

// Plain-text bodies keep these "simple" requests, so the browser skips the CORS
// preflight that Apps Script can't answer.
const post = (body) => fetch(API_URL, { method: 'POST', body: JSON.stringify(body) }).then(parse)

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

export async function listApproved() {
  const { photos } = await fetch(`${API_URL}?action=gallery`).then(parse)
  return photos.map(toRecord).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

export async function listAll() {
  const { submissions } = await post({ action: 'staffList', password: sessionStorage.getItem(PASSWORD_KEY) })
  return submissions.map(toRecord).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

export async function addSubmission(record) {
  await post({
    action: 'submit',
    event: record.event,
    caption: record.caption,
    consent: record.consent,
    fileName: record.fileName,
    aiCheck: record.aiCheck,
    mimeType: record.image.type || 'image/jpeg',
    image: await toBase64(record.image),
  })
}

export async function setStatus(id, status) {
  await post({ action: 'setStatus', id, status, password: sessionStorage.getItem(PASSWORD_KEY) })
}

export async function listEvents() {
  const { events } = await fetch(`${API_URL}?action=events`).then(parse)
  return events
}

export async function addEvent(name) {
  const { events } = await post({ action: 'addEvent', name, password: sessionStorage.getItem(PASSWORD_KEY) })
  return events
}

export async function deleteEvent(id) {
  const { events } = await post({ action: 'deleteEvent', id, password: sessionStorage.getItem(PASSWORD_KEY) })
  return events
}

export async function unlockStaff(password) {
  try {
    await post({ action: 'staffList', password })
  } catch (err) {
    if (err.code === 'bad_password') return false
    throw err
  }
  sessionStorage.setItem(PASSWORD_KEY, password)
  return true
}

export const isStaffUnlocked = () => Boolean(sessionStorage.getItem(PASSWORD_KEY))
export const lockStaff = () => sessionStorage.removeItem(PASSWORD_KEY)
