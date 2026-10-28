import { simulatedCheck } from '../moderation/simulated'

// Photos already published on southviewpreservation.com, standing in for
// "seed the gallery with photos South-View has already made public".
const SEED = [
  { photo: 'run-finish', event: 'run-through-history', status: 'approved', day: '2026-04-19', caption: 'Crossing the finish line of A Run Through History 5K' },
  { photo: 'tour-group', event: 'history-tour', status: 'approved', day: '2026-09-12', caption: 'Our tour group gathered to hear the history of the main road' },
  { photo: 'tour-walk', event: 'history-tour', status: 'approved', day: '2026-08-15', caption: 'Walking the tour route beneath the old oaks' },
  { photo: 'tour-guides', event: 'history-tour', status: 'approved', day: '2026-06-20', caption: "This afternoon's volunteer guides, ready to welcome visitors" },
  { photo: 'tour-living-history', event: 'history-tour', status: 'approved', day: '2026-06-20', caption: 'A living history reenactor sharing stories along the tour' },
  { photo: 'volunteer-planting', event: 'volunteer', status: 'approved', day: '2026-03-14', caption: 'Volunteers planting a new tree on the grounds' },
  { photo: 'volunteer-signin', event: 'volunteer', status: 'approved', day: '2026-03-14', caption: 'Signing in for Volunteer Day at the welcome table' },
  { photo: 'dogwood', event: 'history-tour', status: 'pending', day: '2026-10-03', caption: 'The dogwood in full bloom along the main road' },
  { photo: 'historic-area', event: 'history-tour', status: 'pending', day: '2026-10-04', caption: 'Beautiful old section! Text me at 404-555-0137 if you want the full-size photo' },
]

export function seedRecords() {
  return SEED.map((s, i) => {
    const fileName = `${s.photo}.jpg`
    return {
      id: `seed-${i + 1}`,
      event: s.event,
      caption: s.caption,
      consent: true,
      status: s.status,
      submittedAt: new Date(`${s.day}T15:00:00`).toISOString(),
      imageSrc: `${import.meta.env.BASE_URL}seed/${fileName}`,
      image: null,
      fileName,
      sample: true,
      aiCheck: simulatedCheck({ caption: s.caption, fileName }),
    }
  })
}
