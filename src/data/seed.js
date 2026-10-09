import { simulatedCheck } from '../moderation/simulated'

// Photos already published on southviewpreservation.com, standing in for
// "seed the gallery with photos South-View has already made public".
const SEED = [
  { photo: 'run-finish', event: 'run-through-history', status: 'approved', day: '2026-04-19', caption: 'At the finish line', labels: ['Running', 'People'] },
  { photo: 'tour-group', event: 'history-tour', status: 'approved', day: '2026-09-12', caption: 'Listening to the guide on the main road', labels: ['Tours', 'People'] },
  { photo: 'tour-walk', event: 'history-tour', status: 'approved', day: '2026-08-15', caption: 'Walking the tour route under the oaks', labels: ['Tours', 'Trees'] },
  { photo: 'tour-guides', event: 'history-tour', status: 'approved', day: '2026-06-20', caption: 'Our guides for the afternoon tour', labels: ['Tours', 'People'] },
  { photo: 'tour-living-history', event: 'history-tour', status: 'approved', day: '2026-06-20', caption: 'A living history stop on the tour', labels: ['Tours', 'Living history'] },
  { photo: 'volunteer-planting', event: 'volunteer', status: 'approved', day: '2026-03-14', caption: 'Planting a new tree on the grounds', labels: ['Volunteers', 'Trees'] },
  { photo: 'volunteer-signin', event: 'volunteer', status: 'approved', day: '2026-03-14', caption: 'Volunteer sign-in table', labels: ['Volunteers', 'People'] },
  { photo: 'dogwood', event: 'history-tour', status: 'pending', day: '2026-10-03', caption: 'The dogwood in bloom by the main road', labels: ['Trees', 'Flowers'] },
  { photo: 'historic-area', event: 'history-tour', status: 'pending', day: '2026-10-04', caption: 'Beautiful old section! Text me at 404-555-0137 if you want the full-size photo', labels: ['Headstones'] },
]

export function seedRecords() {
  return SEED.map((s, i) => {
    const fileName = `${s.photo}.jpg`
    return {
      id: `seed-${i + 1}`,
      event: s.event,
      caption: s.caption,
      labels: s.labels,
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
