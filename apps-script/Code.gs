// South-View Community Gallery backend.
//
// This script is deployed as a web app, usually from inside the Google Sheet
// (Extensions → Apps Script). Each submission becomes a row in the "Submissions" tab
// and its photo goes into a Drive folder. Staff can approve photos on the website's Staff page or by
// changing the Status column in the Sheet. Setup steps are in the project README.

const SHEET_NAME = 'Submissions'
const EVENTS_SHEET_NAME = 'Events'
const FOLDER_NAME = 'South-View Gallery Photos'
const HEADERS = ['ID', 'Submitted', 'Event', 'Caption', 'Labels', 'Status', 'Consent', 'AI flagged', 'AI notes', 'Photo', 'File name', 'File ID', 'AI check data']
const REQUIRED_COLUMNS = ['ID', 'Status', 'File ID']
const EVENT_HEADERS = ['ID', 'Name', 'Active']
// The Events tab starts with these, so photos shared before it existed keep their names.
const DEFAULT_EVENTS = [
  ['praise-house', 'Praise House Project'],
  ['run-through-history', 'A Run Through History 5K'],
  ['volunteer', 'Volunteer Day'],
  ['history-tour', 'Guided History Tour'],
]
const MAX_EVENT_NAME_LENGTH = 60
const STATUSES = ['pending', 'approved', 'rejected']
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_LABELS = 20
const MAX_LABEL_LENGTH = 40
const MAX_FAILED_LOGINS = 10
const LOCKOUT_SECONDS = 15 * 60

const props = PropertiesService.getScriptProperties()

// Run once from the Apps Script editor: pick "setup" in the toolbar and click Run.
// Safe to run again; it only creates what's missing.
function setup() {
  const ss = setupSpreadsheet()
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS)
    sheet.setFrozenRows(1)
    const headerRow = sheet.getRange(1, 1, 1, HEADERS.length)
    headerRow.setFontWeight('bold')
    headerRow.protect().setDescription('Column names the website depends on').setWarningOnly(true)
  }
  // Sheets made by an older version of this script get any new columns at the end.
  const { header } = readSheet()
  const missing = HEADERS.filter((name) => header.indexOf(name) < 0)
  if (missing.length) sheet.getRange(1, header.length + 1, 1, missing.length).setValues([missing])
  const statusCol = header.indexOf('Status') + 1
  if (sheet.getLastRow() > 1) sheet.getRange(2, statusCol, sheet.getLastRow() - 1).setDataValidation(statusRule())
  eventsSheet()

  // Photos go to the folder in the FOLDER_ID script property. Without one, make a
  // folder next to the Sheet so they're shared and moved together.
  if (!props.getProperty('FOLDER_ID')) {
    const parents = DriveApp.getFileById(ss.getId()).getParents()
    const parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder()
    props.setProperty('FOLDER_ID', parent.createFolder(FOLDER_NAME).getId())
  }

  // Save and trash a tiny file so a wrong folder shows up now, not at an event.
  const folder = photoFolder()
  folder.createFile('setup check.txt', 'This file can be deleted.').setTrashed(true)
  console.log('Submissions will be saved to this Sheet: ' + ss.getUrl())
  console.log('Photos will be saved to "' + folder.getName() + '": ' + folder.getUrl())
  if (!props.getProperty('STAFF_PASSWORD')) {
    console.log('Next: add a STAFF_PASSWORD script property (Project Settings → Script properties).')
  }
}

// Use the SHEET_ID script property if set, then the Sheet this script is attached to.
// A script made at script.google.com has neither, so make a new Sheet, inside the
// photos folder when FOLDER_ID is set.
function setupSpreadsheet() {
  if (props.getProperty('SHEET_ID')) return openSpreadsheet()
  let ss = SpreadsheetApp.getActiveSpreadsheet()
  if (!ss) {
    ss = SpreadsheetApp.create('South-View Gallery')
    ss.getSheets()[0].setName(SHEET_NAME)
    if (props.getProperty('FOLDER_ID')) DriveApp.getFileById(ss.getId()).moveTo(photoFolder())
  }
  props.setProperty('SHEET_ID', ss.getId())
  return ss
}

// Public: the approved photos for the gallery. Opening the web app URL in a browser
// runs this too, which is a quick way to check the deployment works.
function doGet(e) {
  return respond(() => {
    const action = e.parameter.action || 'gallery'
    if (action === 'events') return { events: readEvents() }
    if (action !== 'gallery') fail('Unknown action.')
    const photos = readRows()
      .filter((r) => r.status === 'approved' && r.fileId)
      .map((r) => ({ id: r.id, event: r.event, caption: r.caption, labels: r.labels, submittedAt: r.submittedAt, fileId: r.fileId }))
    return { photos }
  })
}

// The browser sends JSON as plain text so it can skip the CORS preflight.
function doPost(e) {
  return respond(() => {
    const body = JSON.parse(e.postData.contents)
    if (body.action === 'submit') return submit(body)

    checkStaffPassword(body.password)
    if (body.action === 'staffList') return { submissions: readRows().filter((r) => r.fileId) }
    if (body.action === 'setStatus') return setStatus(String(body.id), body.status)
    if (body.action === 'updateMetadata') return updateMetadata(String(body.id), body.labels)
    if (body.action === 'addEvent') return addEvent(body.name)
    if (body.action === 'deleteEvent') return deleteEvent(String(body.id))
    fail('Unknown action.')
  })
}

function submit(body) {
  const event = String(body.event || '')
  const caption = String(body.caption || '').trim()
  const mimeType = String(body.mimeType || '')
  const image = String(body.image || '')
  if (!event) fail('Choose an event.')
  const chosen = readEvents().filter((e) => e.id === event)[0]
  if (!chosen || !chosen.active) fail("That event isn't taking photos anymore. Choose another event.")
  if (body.consent !== true) fail('Consent is required.')
  if (caption.length > 280) fail('The caption is too long.')
  if (!/^image\/[\w.+-]+$/.test(mimeType)) fail('Only photos can be uploaded.')
  if (!image || image.length > (MAX_IMAGE_BYTES * 4) / 3) fail('The photo is too large.')

  const id = Utilities.getUuid()
  const fileName = String(body.fileName || 'photo').slice(0, 120)
  const blob = Utilities.newBlob(Utilities.base64Decode(image), mimeType, id + ' ' + fileName)
  const file = photoFolder().createFile(blob)
  // Link sharing lets the gallery show the photo. A file ID only reaches the public
  // gallery once its row is approved, so pending and rejected photos stay unlisted.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)

  const aiCheck = body.aiCheck && Array.isArray(body.aiCheck.rules) ? body.aiCheck : null
  const flagged = aiCheck ? aiCheck.rules.filter((r) => r.result === 'flag') : []
  appendRow({
    'ID': id,
    'Submitted': new Date(),
    'Event': event,
    'Caption': plainText(caption),
    'Status': 'pending',
    'Consent': true,
    'AI flagged': aiCheck ? (aiCheck.flagged ? 'Yes' : 'No') : '',
    'AI notes': plainText(flagged.map((r) => r.label + ': ' + r.reason).join('\n') || (aiCheck ? 'No issues found' : '')),
    'Photo': '=HYPERLINK("' + file.getUrl() + '", "Open photo")',
    'File name': plainText(fileName),
    'File ID': file.getId(),
    'AI check data': aiCheck ? JSON.stringify(aiCheck).slice(0, 5000) : '',
  })
  return { id }
}

function setStatus(id, status) {
  if (STATUSES.indexOf(status) < 0) fail('Unknown status.')
  withLock(() => {
    const { sheet, header, values } = readSheet()
    sheet.getRange(rowNumber(header, values, id), header.indexOf('Status') + 1).setValue(status)
  })
  return {}
}

// Labels are stored as comma-separated text so staff can also edit them in the Sheet.
function updateMetadata(id, labels) {
  if (!Array.isArray(labels)) fail('Labels must be a list.')
  const clean = cleanLabels(labels)
  withLock(() => {
    const { sheet, header, values } = readSheet()
    let col = header.indexOf('Labels')
    if (col < 0) {
      col = header.length
      sheet.getRange(1, col + 1).setValue('Labels')
    }
    sheet.getRange(rowNumber(header, values, id), col + 1).setValue(plainText(clean.join(', ')))
  })
  return { labels: clean }
}

// Trims labels, drops commas and duplicates (ignoring capitalisation), and caps their number.
function cleanLabels(labels) {
  const seen = {}
  const clean = []
  labels.forEach((label) => {
    const text = String(label).replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH)
    if (!text || seen[text.toLowerCase()]) return
    seen[text.toLowerCase()] = true
    clean.push(text)
  })
  return clean.slice(0, MAX_LABELS)
}

function rowNumber(header, values, id) {
  const idCol = header.indexOf('ID')
  const row = values.findIndex((r) => String(r[idCol]) === id)
  if (row < 0) fail('That photo is no longer in the Google Sheet.')
  return row + 2
}

// The Events tab lists what visitors can pick on the photo form. It's created with the
// original four events the first time it's needed.
function eventsSheet() {
  const ss = openSpreadsheet()
  let sheet = ss.getSheetByName(EVENTS_SHEET_NAME)
  if (!sheet) {
    sheet = ss.insertSheet(EVENTS_SHEET_NAME)
    sheet.appendRow(EVENT_HEADERS)
    DEFAULT_EVENTS.forEach((e) => sheet.appendRow([e[0], e[1], true]))
    sheet.setFrozenRows(1)
    sheet.getRange(1, 1, 1, EVENT_HEADERS.length).setFontWeight('bold')
    sheet.getRange(2, EVENT_HEADERS.indexOf('Active') + 1, DEFAULT_EVENTS.length).setDataValidation(checkboxRule())
  }
  return sheet
}

// Every event, including deleted ones, so older photos can still show their event's
// name. Before the Events tab exists this is the original four.
function readEvents() {
  const sheet = openSpreadsheet().getSheetByName(EVENTS_SHEET_NAME)
  if (!sheet) return DEFAULT_EVENTS.map((e) => ({ id: e[0], name: e[1], active: true }))
  const { header, values } = tabValues(sheet)
  return values
    .map((row) => ({
      id: eventId(header, row),
      name: String(cell(header, row, 'Name')).trim(),
      active: isActive(cell(header, row, 'Active')),
    }))
    .filter((e) => e.id && e.name)
}

function addEvent(name) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_EVENT_NAME_LENGTH)
  if (!clean) fail('Enter a name for the event.')
  const id = slugify(clean)
  withLock(() => {
    const sheet = eventsSheet()
    const { header, values } = tabValues(sheet)
    requireColumns(header, EVENT_HEADERS, EVENTS_SHEET_NAME)
    // Match by name first: the original events have short IDs not made from their names.
    const sameName = (r) => String(cell(header, r, 'Name')).trim().toLowerCase() === clean.toLowerCase()
    let row = values.findIndex(sameName)
    if (row < 0) row = values.findIndex((r) => eventId(header, r) === id)
    if (row < 0) {
      const fields = { 'ID': id, 'Name': plainText(clean), 'Active': true }
      sheet.appendRow(header.map((h) => (h in fields ? fields[h] : '')))
      sheet.getRange(sheet.getLastRow(), header.indexOf('Active') + 1).setDataValidation(checkboxRule())
      return
    }
    if (isActive(cell(header, values[row], 'Active'))) {
      fail('There is already an event called "' + cell(header, values[row], 'Name') + '".')
    }
    // Adding a deleted event again brings it back, still linked to its old photos.
    sheet.getRange(row + 2, header.indexOf('Name') + 1).setValue(plainText(clean))
    sheet.getRange(row + 2, header.indexOf('Active') + 1).setValue(true)
  })
  return { events: readEvents() }
}

// Deleting takes an event off the photo form and QR sign. Its row stays (with Active
// unticked) so photos already shared from it keep the event's name.
function deleteEvent(id) {
  withLock(() => {
    const sheet = eventsSheet()
    const { header, values } = tabValues(sheet)
    requireColumns(header, EVENT_HEADERS, EVENTS_SHEET_NAME)
    const row = values.findIndex((r) => eventId(header, r) === id)
    if (row < 0) fail('That event is no longer in the Google Sheet.')
    sheet.getRange(row + 2, header.indexOf('Active') + 1).setValue(false)
  })
  return { events: readEvents() }
}

// Rows typed into the Events tab without an ID get one from their name.
function eventId(header, row) {
  return String(cell(header, row, 'ID')).trim() || slugify(String(cell(header, row, 'Name')).trim())
}

// A blank Active cell counts as active, so a row typed in by hand just works.
function isActive(value) {
  return value !== false && String(value).trim().toLowerCase() !== 'false'
}

// "Praise House Project" → "praise-house-project". Matches slugify() in src/data/events.js.
function slugify(name) {
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/, '')
  if (!slug) return 'event-' + shortHash(String(name))
  return /^[a-z]/.test(slug) ? slug : 'event-' + slug
}

function shortHash(text) {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0
  return (hash >>> 0).toString(36)
}

function checkStaffPassword(password) {
  const expected = props.getProperty('STAFF_PASSWORD')
  if (!expected) fail('No staff password is set up yet. Add STAFF_PASSWORD in the script properties.')
  const cache = CacheService.getScriptCache()
  const failures = Number(cache.get('failedLogins') || 0)
  if (failures >= MAX_FAILED_LOGINS) {
    fail('Too many wrong passwords. Wait 15 minutes, or approve photos in the Google Sheet.', 'locked')
  }
  if (password !== expected) {
    cache.put('failedLogins', String(failures + 1), LOCKOUT_SECONDS)
    fail('Wrong password.', 'bad_password')
  }
}

// FOLDER_ID can be the folder's ID or its link copied from Drive's address bar.
function photoFolder() {
  const value = String(props.getProperty('FOLDER_ID') || '').trim()
  const match = value.match(/(?:folders\/|[?&]id=)([\w-]+)/)
  try {
    return DriveApp.getFolderById(match ? match[1] : value)
  } catch (err) {
    fail("Can't open the photos folder. Check FOLDER_ID in the script properties, and that this account can edit that folder.")
  }
}

// SHEET_ID can be the Sheet's ID or its link copied from the address bar.
function openSpreadsheet() {
  const value = String(props.getProperty('SHEET_ID') || '').trim()
  if (!value) fail('The backend is not set up yet. Run setup() in the Apps Script editor.')
  const match = value.match(/\/d\/([\w-]+)/)
  try {
    return SpreadsheetApp.openById(match ? match[1] : value)
  } catch (err) {
    fail("Can't open the Google Sheet. Check SHEET_ID in the script properties, and that this account can edit that Sheet.")
  }
}

// Columns are looked up by name, so staff can reorder them or add their own.
function readSheet() {
  const sheet = openSpreadsheet().getSheetByName(SHEET_NAME)
  if (!sheet) fail('The "' + SHEET_NAME + '" tab is missing from the Google Sheet.')
  const { header, values } = tabValues(sheet)
  requireColumns(header, REQUIRED_COLUMNS, SHEET_NAME)
  return { sheet, header, values }
}

function tabValues(sheet) {
  const values = sheet.getDataRange().getValues()
  const header = values.shift().map((h) => String(h).trim())
  return { header, values }
}

function requireColumns(header, names, tab) {
  const missing = names.filter((name) => header.indexOf(name) < 0)
  if (missing.length) fail('The "' + tab + '" tab is missing the "' + missing[0] + '" column.')
}

function cell(header, row, name) {
  const i = header.indexOf(name)
  return i < 0 ? '' : row[i]
}

function readRows() {
  const { header, values } = readSheet()
  const at = (row, name) => cell(header, row, name)
  return values.map((row) => ({
    id: String(at(row, 'ID')),
    submittedAt: toIso(at(row, 'Submitted')),
    event: String(at(row, 'Event')).trim(),
    caption: String(at(row, 'Caption')),
    labels: String(at(row, 'Labels')).split(',').map((l) => l.trim()).filter(Boolean),
    status: String(at(row, 'Status')).trim().toLowerCase() || 'pending',
    consent: at(row, 'Consent') === true,
    fileName: String(at(row, 'File name')),
    fileId: String(at(row, 'File ID')).trim(),
    aiCheck: parseJson(at(row, 'AI check data')),
  }))
}

function appendRow(record) {
  withLock(() => {
    const { sheet, header } = readSheet()
    sheet.appendRow(header.map((name) => (name in record ? record[name] : '')))
    sheet.getRange(sheet.getLastRow(), header.indexOf('Status') + 1).setDataValidation(statusRule())
  })
}

function statusRule() {
  return SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build()
}

function checkboxRule() {
  return SpreadsheetApp.newDataValidation().requireCheckbox().build()
}

function withLock(fn) {
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    return fn()
  } finally {
    lock.releaseLock()
  }
}

// Visitor text that starts with = + - @ would otherwise run as a spreadsheet formula.
function plainText(text) {
  return /^[=+\-@]/.test(text) ? "'" + text : text
}

function toIso(value) {
  const date = value instanceof Date ? value : new Date(value)
  return isNaN(date) ? '' : date.toISOString()
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null
  } catch (err) {
    return null
  }
}

function respond(handler) {
  let out
  try {
    out = Object.assign({ ok: true }, handler())
  } catch (err) {
    console.error(err)
    out = { ok: false, error: err.message, code: err.code || 'error' }
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON)
}

function fail(message, code) {
  const err = new Error(message)
  err.code = code
  throw err
}
