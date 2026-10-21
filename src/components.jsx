import { useEffect, useState } from 'react'
import { useEvents } from './events'

export function Photo({ record, ...props }) {
  const { eventName } = useEvents()
  const [url, setUrl] = useState(record.image ? null : record.imageSrc)

  useEffect(() => {
    if (!record.image) {
      setUrl(record.imageSrc)
      return
    }
    const objectUrl = URL.createObjectURL(record.image)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [record.image, record.imageSrc])

  // Drive photos have a second URL format to try if the first one is blocked.
  const onError = () => record.imageFallback && url !== record.imageFallback && setUrl(record.imageFallback)

  if (!url) return <div className="photo-loading" />
  return (
    <img
      src={url}
      alt={record.caption || `Photo from ${eventName(record.event)}`}
      referrerPolicy="no-referrer"
      onError={onError}
      {...props}
    />
  )
}

export function WixNote({ children }) {
  return (
    <aside className="wix-note">
      <strong>How this works in Wix:</strong> {children}
    </aside>
  )
}

const ENGINE_LABELS = { simulated: 'Simulated AI check', gemini: 'Gemini AI check' }

export function AiCheckPanel({ check }) {
  if (!check) return null
  const flagged = check.approved === 0 || check.flagged
  const rules = Array.isArray(check.rules)
    ? check.rules
    : check.approved == null
      ? []
      : [{ label: 'Gemini review', result: check.approved === 1 ? 'pass' : 'flag' }]
  return (
    <div className={`ai-check ${flagged ? 'is-flagged' : 'is-clear'}`}>
      <div className="ai-check-head">
        <span>{flagged ? 'Flagged for a closer look' : 'No issues found'}</span>
        <span className="tag">{ENGINE_LABELS[check.engine] ?? 'AI check'}</span>
      </div>
      {rules.length > 0 && (
        <ul>
          {rules.map((rule) => (
            <li key={rule.label} className={rule.result}>
              <span className="mark">{rule.result === 'flag' ? '!' : '✓'}</span>
              <span>
                {rule.label}
                {rule.reason && <em> — {rule.reason}</em>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
