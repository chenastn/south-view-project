// Stand-in for an AI image check. It can't see the photo, so each rule looks at
// the caption and file name instead. Rules follow the CLUE idea of splitting
// "is this appropriate?" into specific checks.
const RULES = [
  {
    label: 'No nudity or sexual content',
    test: (text) => /\b(nude|naked|nsfw|explicit)\b/.test(text),
    reason: 'Caption suggests explicit content',
  },
  {
    label: 'No graphic violence or injury',
    test: (text) => /\b(blood|gore|fight|weapon|gun)\b/.test(text),
    reason: 'Caption mentions violence or injury',
  },
  {
    label: 'No hateful text or symbols',
    test: (text) => /\b(hate|slur)\b/.test(text),
    reason: 'Caption may contain hateful language',
  },
  {
    label: 'Respectful of graves and burial sites',
    test: (text) => /\b(standing|sitting|climbing|stepping) on (a |the )?(grave|headstone|tombstone|monument)/.test(text),
    reason: 'Caption describes someone on a grave marker',
  },
  {
    label: 'No personal contact info in caption',
    test: (text) => /\S+@\S+\.\S+|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text),
    reason: 'Caption contains an email address or phone number',
  },
]

export function simulatedCheck({ caption = '', fileName = '' }) {
  const text = `${caption} ${fileName}`.toLowerCase()
  const rules = RULES.map(({ label, test, reason }) => {
    const failed = test(text)
    return { label, result: failed ? 'flag' : 'pass', reason: failed ? reason : null }
  })
  return { engine: 'simulated', flagged: rules.some((r) => r.result === 'flag'), rules }
}
