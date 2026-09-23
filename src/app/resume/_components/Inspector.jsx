'use client'

import { useState, useMemo } from 'react'
import WritingCheck from './WritingCheck.jsx'
import CoverLetter from './CoverLetter.jsx'
import AtsPanel from './AtsPanel.jsx'
import { checkAllWriting } from '@/lib/resume/checker.js'
import { getStructuredData } from '@/lib/resume/resumeData.js'
import { scoreResume } from '@/lib/resume/scorer.js'

/* Secondary panels live here rather than stacked under the preview.
   Only the active tab renders — a closed tab costs nothing, which matters
   because the writing checker and the scorer both walk the whole resume. */
export default function Inspector({
  form, setForm, template, accent, showToast,
  registered, gatedCoverDownload, downloading, coverRemaining, onRequestUnlock,
}) {
  const [tab, setTab] = useState('writing')

  /* Counts shown on the tabs so problems are visible without opening them. */
  const issueCount = useMemo(() => {
    try { return checkAllWriting(form).reduce((n, r) => n + r.issues.length, 0) }
    catch { return 0 }
  }, [form])

  const score = useMemo(() => {
    try {
      const d = getStructuredData(form)
      if (!d.name && !d.email && !d.exp) return null
      return scoreResume(d, form.jd || '', { template }).score
    } catch { return null }
  }, [form, template])

  const TABS = [
    { key: 'writing', label: 'Writing',      badge: issueCount || null, tone: issueCount ? 'warn' : null },
    { key: 'ats',     label: 'ATS score',    badge: score, tone: score == null ? null : score >= 75 ? 'good' : score >= 50 ? 'warn' : 'bad' },
    { key: 'cover',   label: 'Cover letter', badge: registered ? null : '🔒', tone: null },
  ]

  return (
    <div className="panel insp">
      <div className="insp-tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`insp-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.badge != null && (
              <span className={`insp-badge ${t.tone || ''}`}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      <div className="insp-body">
        {tab === 'writing' && (
          <WritingCheck form={form} setForm={setForm} showToast={showToast} bare />
        )}
        {tab === 'ats' && (
          <AtsPanel form={form} template={template} showToast={showToast} />
        )}
        {tab === 'cover' && (
          <CoverLetter
            form={form} template={template} accent={accent}
            gatedCoverDownload={gatedCoverDownload}
            downloading={downloading}
            coverRemaining={coverRemaining}
            registered={registered}
            onRequestUnlock={onRequestUnlock}
            showToast={showToast}
            bare
          />
        )}
      </div>
    </div>
  )
}
