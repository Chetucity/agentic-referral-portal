'use client'

import { useMemo } from 'react'
import { checkAllWriting, autoFixAllWriting, CHECK_FIELDS } from '@/lib/resume/checker.js'

export default function WritingCheck({ form, setForm, showToast, bare }) {
  const results = useMemo(() => checkAllWriting(form), [form])

  const counts = useMemo(() => {
    const c = { high: 0, med: 0, low: 0 }
    results.forEach(r => r.issues.forEach(i => c[i.sev]++))
    return c
  }, [results])

  const total = counts.high + counts.med + counts.low
  const hasContent = CHECK_FIELDS.some(f => (form[f.key] || '').trim())

  function fixAll() {
    const before = CHECK_FIELDS.map(f => form[f.key]).join('|')
    const next = autoFixAllWriting(form)
    const after = CHECK_FIELDS.map(f => next[f.key]).join('|')
    setForm(next)
    showToast(before === after
      ? 'Nothing left to auto-fix — remaining notes need your judgement'
      : 'Applied corrections — check the highlighted lines')
  }

  const severityOrder = { high: 0, med: 1, low: 2 }
  const sorted = [...results].sort((a, b) => {
    const wa = Math.min(...a.issues.map(i => severityOrder[i.sev]))
    const wb = Math.min(...b.issues.map(i => severityOrder[i.sev]))
    return wa - wb
  })

  const Wrap = bare ? 'div' : 'div'
  return (
    <Wrap className={bare ? '' : 'panel'}>
      <div className="wr-divider" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
        <div className="wr-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!bare && <span className="panel-title" style={{ margin: 0 }}>Writing check</span>}
            <div className="wr-chips">
              {counts.high > 0 && <span className="wr-chip h">{counts.high} critical</span>}
              {counts.med  > 0 && <span className="wr-chip m">{counts.med} to improve</span>}
              {counts.low  > 0 && <span className="wr-chip l">{counts.low} minor</span>}
            </div>
          </div>
          {total > 0 && (
            <button className="btn btn-sm" onClick={fixAll}>✦ Fix all</button>
          )}
        </div>

        {!hasContent && (
          <p className="wr-empty">
            Fill in your summary, experience, education, or projects and every line gets checked for spelling, grammar, and phrasing.
          </p>
        )}
        {hasContent && results.length === 0 && (
          <div className="wr-clean">✓ Every line reads clean — no issues found.</div>
        )}
        {sorted.map((r, ri) => {
          const worst = ['high', 'med', 'low'].find(s => r.issues.some(i => i.sev === s))
          const changed = r.fixed !== r.original
          return (
            <div className={`wr-item sev-${worst}`} key={ri}>
              <div className="wr-loc">{r.fieldLabel}{r.lineIndex > 0 ? ` · line ${r.lineIndex + 1}` : ''}</div>
              {changed && <div className="wr-before">{r.original}</div>}
              {changed && <div className="wr-after">{r.fixed}</div>}
              {!changed && <div style={{ fontSize: 12, marginBottom: 4, color: '#374151' }}>{r.original}</div>}
              <div>
                {r.issues.map((iss, ii) => (
                  <div className="wr-msg" key={ii}>{iss.msg}</div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Wrap>
  )
}
