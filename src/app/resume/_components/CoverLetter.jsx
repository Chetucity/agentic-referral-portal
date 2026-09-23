'use client'

import { useState, useMemo, useEffect } from 'react'
import { buildCoverLetter, coverLetterText } from '@/lib/resume/coverLetter.js'
import { downloadCoverLetterPDF, downloadCoverLetterWord } from '@/lib/resume/exports.js'

const TONES = [
  { key: 'professional', label: 'Professional' },
  { key: 'warm',         label: 'Warm' },
  { key: 'direct',       label: 'Direct' },
]

export default function CoverLetter({ form, template, accent, gatedCoverDownload, downloading, coverRemaining, registered, onRequestUnlock, showToast, bare }) {
  const [company, setCompany] = useState('')
  const [role,    setRole]    = useState('')
  const [manager, setManager] = useState('')
  const [jd,      setJd]      = useState('')
  const [tone,    setTone]    = useState('professional')
  const [edited,  setEdited]  = useState(null)   // null = using generated text

  const generated = useMemo(
    () => buildCoverLetter(form, { company, role, manager, jd, tone }),
    [form, company, role, manager, jd, tone]
  )

  /* Regenerating from new inputs discards manual edits — otherwise the
     preview would silently ignore what the user just typed above. */
  useEffect(() => { setEdited(null) }, [company, role, manager, jd, tone])

  const letter = edited
    ? { ...generated, paragraphs: edited.split(/\n{2,}/).map(s => s.trim()).filter(Boolean) }
    : generated

  const hasName = !!(form.name || '').trim()

  /* Copying is an export too — gate it exactly like PDF/Word. */
  function copyText() {
    if (!registered) { onRequestUnlock(); return }
    navigator.clipboard.writeText(coverLetterText(letter))
      .then(() => showToast('Cover letter copied to clipboard'))
      .catch(() => showToast('Could not copy — select the text manually'))
  }

  const Wrap = 'div'
  return (
    <Wrap className={bare ? '' : 'panel'}>
      <div className="cl-head">
        <div>
          {!bare && <span className="panel-title" style={{ margin: 0 }}>Cover letter</span>}
          <span className={`cl-badge ${registered ? '' : 'locked'}`} style={bare ? { marginLeft: 0 } : undefined}>
            {registered ? 'Unlocked' : '🔒 Locked'}
          </span>
        </div>
        {registered && typeof coverRemaining === 'number' && (
          <span className="cl-remaining">{coverRemaining} left today</span>
        )}
      </div>

      {!registered && (
        <div className="cl-lock-note">
          Cover letters need an email. Add yours once and you get <strong>5 cover letters a day</strong> — free, no password.
          <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={onRequestUnlock}>
            🔓 Unlock with email
          </button>
        </div>
      )}

      {!hasName && (
        <p className="hint" style={{ marginBottom: 10 }}>
          Add your name and experience in the form above — the letter writes itself from your resume.
        </p>
      )}

      <div className="row-2">
        <div>
          <label htmlFor="cl-company">Company</label>
          <input id="cl-company" value={company} placeholder="Acme Corp"
            onChange={e => setCompany(e.target.value)} />
        </div>
        <div>
          <label htmlFor="cl-role">Role applying for</label>
          <input id="cl-role" value={role} placeholder="Frontend Developer"
            onChange={e => setRole(e.target.value)} />
        </div>
      </div>

      <label htmlFor="cl-manager">Hiring manager (optional)</label>
      <input id="cl-manager" value={manager} placeholder="Priya Menon"
        onChange={e => setManager(e.target.value)} />

      <label htmlFor="cl-jd">Job description (optional — tailors the letter)</label>
      <textarea id="cl-jd" value={jd} placeholder="Paste the job posting here…"
        style={{ minHeight: 70 }} onChange={e => setJd(e.target.value)} />

      <label style={{ marginTop: 12 }}>Tone</label>
      <div className="pills">
        {TONES.map(t => (
          <button key={t.key} className={`pill ${tone === t.key ? 'active' : ''}`}
            onClick={() => setTone(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* Preview — editable (blurred until unlocked) */}
      <div className={`cl-preview ${registered ? '' : 'cl-locked'}`}>
        <div className="cl-letterhead">
          <div className="cl-name">{form.name || 'Your Name'}</div>
          <div className="cl-contact">
            {[form.title, form.location].filter(Boolean).join(' · ')}
          </div>
          <div className="cl-contact">
            {[form.email, form.phone, form.link].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="cl-date">{letter.meta.date}</div>
        {company && (
          <div className="cl-addressee">
            <strong>{company}</strong>
            {role && <div className="cl-re">Re: {role}</div>}
          </div>
        )}
        <div className="cl-greeting">{letter.greeting}</div>
        <textarea
          className="cl-body"
          value={edited !== null ? edited : generated.paragraphs.join('\n\n')}
          onChange={e => setEdited(e.target.value)}
          readOnly={!registered}
          spellCheck
        />
        <div className="cl-sign">
          <div>{letter.closing}</div>
          <div className="cl-sign-name">{letter.signature}</div>
        </div>
      </div>

      <p className="hint">
        {registered
          ? 'Edit the body directly above — your changes are included in the download.'
          : 'Preview only. Unlock with your email to edit and download.'}
      </p>

      <div className="dl-row">
        <button className="btn btn-primary" disabled={downloading}
          onClick={() => gatedCoverDownload(() => {
            downloadCoverLetterPDF(letter, template, accent)
            showToast('Cover letter PDF downloaded')
          })}>
          {downloading ? '⏳ Downloading…' : registered ? '⬇ PDF' : '🔒 PDF'}
        </button>
        <button className="btn" disabled={downloading}
          onClick={() => gatedCoverDownload(() => {
            downloadCoverLetterWord(letter, template, accent)
            showToast('Cover letter Word file downloaded')
          })}>
          {downloading ? '⏳ Downloading…' : registered ? '⬇ Word' : '🔒 Word'}
        </button>
        <button className="btn" onClick={copyText}>
          {registered ? '⧉ Copy text' : '🔒 Copy text'}
        </button>
      </div>
    </Wrap>
  )
}

