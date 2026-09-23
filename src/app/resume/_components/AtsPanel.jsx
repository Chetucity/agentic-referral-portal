'use client'

import { useMemo } from 'react'
import { getStructuredData } from '@/lib/resume/resumeData.js'
import { scoreResume } from '@/lib/resume/scorer.js'

const sevColor = { high: 'var(--red)', med: 'var(--amber)', low: 'var(--text-faint)' }
const sevIcon  = { high: '⚠', med: '⚠', low: 'ℹ' }

function tone(score) {
  if (score >= 75) return 'var(--green)'
  if (score >= 50) return 'var(--amber)'
  return 'var(--red)'
}

/* Live ATS reading of whatever is currently in the editor. The Improve tab
   has its own before/after panel for an uploaded file — this one tracks the
   resume as you edit it, on either tab. */
export default function AtsPanel({ form, template }) {
  const result = useMemo(() => {
    const d = getStructuredData(form)
    if (!d.name && !d.email && !d.exp) return null
    return scoreResume(d, form.jd || '', { template })
  }, [form, template])

  if (!result) {
    return (
      <p className="wr-empty">
        Add your name, contact details and experience — the score appears as soon as
        there is something to measure.
      </p>
    )
  }

  const { score, potential, issues } = result
  const gain = Math.max(0, potential - score)

  return (
    <>
      <div className="ats-top">
        <div className="ats-dial" style={{ '--v': `${score}%`, '--c': tone(score) }}>
          <span className="ats-num">{score}</span>
          <span className="ats-den">/100</span>
        </div>
        <div className="ats-meta">
          <div className="ats-head">
            {score >= 75 ? 'Strong' : score >= 50 ? 'Needs work' : 'Weak'}
          </div>
          <p className="hint" style={{ margin: 0 }}>
            {gain > 0
              ? `Up to ${potential} if you clear the items below.`
              : 'Nothing major left to fix.'}
          </p>
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="wr-clean">✓ No issues flagged.</div>
      ) : (
        issues.map((issue, i) => (
          <div className="issue-card" key={i}>
            <span className="issue-icon" style={{ color: sevColor[issue.sev] }}>{sevIcon[issue.sev]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="issue-title">{issue.t}</div>
              <div className="issue-desc">{issue.d}</div>
            </div>
            {issue.pts > 0 && <span className="ats-pts">+{issue.pts}</span>}
          </div>
        ))
      )}
    </>
  )
}
