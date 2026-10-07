import { useEffect, useState } from 'react'
import { eventName } from './data/events'

export function Photo({ record, ...props }) {
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

  if (!url) return <div className="photo-loading" />
  return <img src={url} alt={record.caption || `Photo from ${eventName(record.event)}`} {...props} />
}

export function WixNote({ children }) {
  return (
    <aside className="wix-note">
      <strong>How this works in Wix:</strong> {children}
    </aside>
  )
}

export function AiCheckPanel({ check }) {
  return (
    <div className={`ai-check ${check.flagged ? 'is-flagged' : 'is-clear'}`}>
      <div className="ai-check-head">
        <span>{check.flagged ? 'Flagged for a closer look' : 'No issues found'}</span>
        <span className="tag">Simulated AI check</span>
      </div>
      <ul>
        {check.rules.map((rule) => (
          <li key={rule.label} className={rule.result}>
            <span className="mark">{rule.result === 'flag' ? '!' : '✓'}</span>
            <span>
              {rule.label}
              {rule.reason && <em> — {rule.reason}</em>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
