'use client'

import { useState, useRef } from 'react'
import { readFile, parseResumeText } from '@/lib/resume/parser.js'
import { getStructuredData, autoSummary } from '@/lib/resume/resumeData.js'
import { scoreResume } from '@/lib/resume/scorer.js'
import { autoFixAllWriting, enhanceResume } from '@/lib/resume/checker.js'
import JDMatch from './JDMatch.jsx'

function paintColor(score) {
  if (score >= 75) return '#16a34a'
  if (score >= 50) return '#d97706'
  return '#dc2626'
}

export default function ImproveTab({ form, setForm, uploadedText, setUploadedText, setOriginalFileUrl, setOriginalParsed, lastParsed, setLastParsed, lastResult, setLastResult, applyParsed, showToast }) {
  const [status,    setStatus]    = useState('')
  const [statusErr, setStatusErr] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [jd,        setJd]        = useState('')
  const [over,      setOver]      = useState(false)
  const fileInput = useRef(null)

  async function handleFile(file) {
    setStatus(''); setStatusErr(false); setLastParsed(null); setLastResult(null); setUploadedText('')
    // Only PDF can be embedded in an iframe; other formats trigger a download
    setOriginalFileUrl(file.name.toLowerCase().endsWith('.pdf') ? URL.createObjectURL(file) : null)
    setLoading(true)
    try {
      const text = await readFile(file, msg => setStatus(msg))
      const words = text.split(/\s+/).filter(Boolean).length
      setUploadedText(text)
      if (words < 20) {
        setStatus(`Only ${words} words extracted. If this is a scanned PDF, export it as a text PDF from Word instead.`)
        setStatusErr(true)
      } else {
        setStatus(`✓ ${file.name} — ${words} words extracted`)
      }
    } catch (err) {
      setStatus(String(err && err.message ? err.message : err))
      setStatusErr(true)
    }
    setLoading(false)
  }

  function onDrop(e) {
    e.preventDefault(); setOver(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) handleFile(f)
  }

  function analyze() {
    if (!uploadedText) return
    const parsed = parseResumeText(uploadedText)

    /* Score the resume exactly as uploaded — this is the "Before" number. */
    const originalResult = scoreResume(getStructuredData({ ...form, ...parsed, jd }), jd)

    /* Build the improved version: spelling and grammar, stronger action verbs,
       filler and first-person removed, bullets realigned. */
    const improved = enhanceResume(parsed)
    if (!improved.summary || improved.summary.split(/\s+/).filter(Boolean).length < 15) {
      improved.summary = autoSummary({ ...form, ...improved })
    }
    const improvedResult = scoreResume(getStructuredData({ ...form, ...improved, jd }), jd)

    setOriginalParsed(parsed)
    setLastParsed(improved)
    /* "After fixes" is the measured score of the improved resume, not a guess.
       Remaining issues are the ones automation could not fix on its own. */
    setLastResult({
      score: originalResult.score,
      potential: Math.max(originalResult.score, improvedResult.score),
      issues: improvedResult.issues,
    })
    showToast(`Improved — ${originalResult.score} → ${Math.max(originalResult.score, improvedResult.score)}/100`)
  }

  function fixKeywords(kws) {
    if (!lastParsed || !kws) return
    const cur = (lastParsed.skills || '').split(',').map(s => s.trim()).filter(Boolean)
    kws.forEach(k => { if (!cur.some(c => c.toLowerCase() === k)) cur.push(k) })
    const next = { ...lastParsed, skills: cur.join(', ') }
    setLastParsed(next)
    reAnalyze(next)
    showToast('Keywords added')
  }

  function fixSummary() {
    if (!lastParsed) return
    const next = { ...lastParsed, summary: autoSummary({ ...form, ...lastParsed }) }
    setLastParsed(next)
    reAnalyze(next)
    showToast('Summary generated')
  }

  function fixWriting() {
    if (!lastParsed) return
    const next = autoFixAllWriting(lastParsed)
    setLastParsed(next)
    reAnalyze(next)
    showToast('Writing corrected')
  }

  function reAnalyze(parsed) {
    const p = parsed || lastParsed
    if (!p) return
    const d = getStructuredData({ ...form, ...p, jd })
    setLastResult(scoreResume(d, jd))
  }

  const sevColor = { high: '#dc2626', med: '#d97706', low: '#9ca3af' }
  const sevIcon  = { high: '⚠', med: '⚠', low: 'ℹ' }

  return (
    <>
      <div className="panel">
        <div className="panel-title">Upload your resume</div>
        <div
          className={`drop-zone ${over ? 'over' : ''}`}
          onDragOver={e => { e.preventDefault(); setOver(true) }}
          onDragEnter={e => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          onClick={() => fileInput.current?.click()}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" style={{ display: 'inline-block' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>
          </svg>
          <p>{loading ? status || 'Reading…' : 'Drop your resume here or click to browse'}</p>
          <p className="sub">PDF, Word (.docx), or plain text</p>
        </div>
        <input ref={fileInput} type="file" accept=".pdf,.docx,.txt,.md" style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) { handleFile(e.target.files[0]); e.target.value = '' } }} />
        {status && !loading && (
          <p className="hint" style={{ marginTop: 8, color: statusErr ? 'var(--red)' : 'var(--green)' }}>{status}</p>
        )}

        <p className="hint" style={{ marginTop: 12 }}>
          Have a specific job in mind? Use the <strong>Match a job description</strong> panel below
          to compare your resume against the posting.
        </p>

        <div className="btn-row">
          <button className="btn btn-primary" onClick={analyze} disabled={!uploadedText || loading}>
            {loading ? 'Reading…' : 'Analyze resume'}
          </button>
        </div>
      </div>

      {lastResult && (
        <div className="panel">
          <div className="panel-title">ATS analysis</div>
          <div className="score-wrap">
            <div>
              <div className="score-circle" style={{ borderColor: paintColor(lastResult.score) }}>{lastResult.score}</div>
              <div className="score-label">Current score</div>
            </div>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            <div>
              <div className="score-circle" style={{ borderColor: paintColor(lastResult.potential) }}>{lastResult.potential}</div>
              <div className="score-label">After fixes</div>
            </div>
          </div>

          {lastResult.issues.map((issue, idx) => (
            <div className="issue-card" key={idx}>
              <span className="issue-icon" style={{ color: sevColor[issue.sev] }}>{sevIcon[issue.sev]}</span>
              <div style={{ flex: 1 }}>
                <div className="issue-title">{issue.t}</div>
                <div className="issue-desc">{issue.d}</div>
                <div className="btn-row" style={{ marginTop: 6 }}>
                  {issue.fix === 'keywords' && (
                    <button className="btn btn-sm" onClick={() => fixKeywords(issue.kw)}>+ Add to skills</button>
                  )}
                  {issue.fix === 'summary' && (
                    <button className="btn btn-sm" onClick={fixSummary}>✦ Generate summary</button>
                  )}
                  {issue.fix === 'writing' && (
                    <button className="btn btn-sm" onClick={fixWriting}>✦ Fix spelling &amp; grammar</button>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div className="btn-row" style={{ marginTop: 4 }}>
            <button className="btn btn-primary" onClick={() => applyParsed(lastParsed)}>
              ✦ Apply fixes &amp; open in editor
            </button>
          </div>
        </div>
      )}

      {/* Targets whatever is currently in the editor — works with an uploaded
          resume or one built from scratch. */}
      <JDMatch
        form={form}
        setForm={setForm}
        jd={jd}
        setJd={setJd}
        showToast={showToast}
        onApplied={() => { if (lastParsed) reAnalyze(lastParsed) }}
      />
    </>
  )
}
