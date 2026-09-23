'use client'

import { useMemo } from 'react'
import { getStructuredData } from '@/lib/resume/resumeData.js'
import { scoreResume } from '@/lib/resume/scorer.js'

/**
 * Builder header.
 *
 * The standalone app put a sign-in chip here. Inside the portal the person is
 * already signed in, so that space is given over to the thing they actually
 * need while editing: which resume this is, whether it has been saved, and how
 * it scores.
 */
export default function Header({
  saved, saving, form, template,
  title, onTitleChange,
  resumes, activeId, onSwitch, onNewResume, onDelete,
}) {
  const score = useMemo(() => {
    const d = getStructuredData(form)
    if (!d.name && !d.email && !d.exp) return null
    return scoreResume(d, form.jd || '', { template }).score
  }, [form, template])

  return (
    <header className="app-header">
      <div className="logo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <path d="M14 2v6h6"/><path d="M9 13h6M9 17h4"/>
        </svg>
        <input
          className="resume-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label="Resume name"
          placeholder="Untitled resume"
          spellCheck={false}
        />
      </div>

      <div className="header-badges">
        <span className={`badge badge-save ${saving || saved ? '' : 'hidden'}`}>
          {saving ? 'Saving…' : 'Saved'}
        </span>

        {score !== null && (
          <span className="badge badge-score" title="Rule-based ATS score — see Writing Check for details">
            ATS {score}/100
          </span>
        )}

        {resumes.length > 0 && (
          <select
            className="resume-switch"
            value={activeId ?? ''}
            onChange={(e) => onSwitch(e.target.value)}
            aria-label="Switch resume"
            title="Switch between your saved resumes"
          >
            {!activeId && <option value="">Unsaved draft</option>}
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))}
          </select>
        )}

        <button className="btn btn-sm btn-new" onClick={onNewResume} title="Start a fresh resume">
          + New<span className="hide-sm"> Resume</span>
        </button>

        {activeId && (
          <button
            className="btn btn-sm btn-danger-ghost"
            onClick={onDelete}
            title="Delete this resume"
          >
            Delete
          </button>
        )}
      </div>
    </header>
  )
}
