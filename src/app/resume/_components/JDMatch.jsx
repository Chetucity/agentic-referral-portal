'use client'

import { useState, useMemo } from 'react'
import {
  parseJD, matchResume, buildRewrites, missingSkills,
  suggestBullets, bulletTargets, applyDecisions,
} from '@/lib/resume/jdMatch.js'

const STATUS_LABEL = { covered: 'Covered', partial: 'Partly', missing: 'Not shown' }
const TYPE_LABEL   = { tool: 'Tool', skill: 'Skill', responsibility: 'Responsibility', qualification: 'Qualification' }

export default function JDMatch({ form, setForm, jd, setJd, showToast, onApplied }) {
  const [analysed, setAnalysed] = useState(null)
  /* Ticked sets — nothing reaches the resume unless it is in one of these. */
  const [pickedRewrites, setPickedRewrites] = useState(() => new Set())
  const [pickedSkills,   setPickedSkills]   = useState(() => new Set())
  const [pickedBullets,  setPickedBullets]  = useState(() => new Set())
  /* Drafts are editable before they are accepted — { id: text } */
  const [bulletText,     setBulletText]     = useState({})
  const [bulletTarget,   setBulletTarget]   = useState({})

  const targets = useMemo(() => bulletTargets(form), [form])

  const canAnalyse = (jd || '').trim().length > 60

  function analyse() {
    const reqs = parseJD(jd)
    if (!reqs.length) {
      showToast('Could not find requirements in that text — paste the full posting')
      return
    }
    const matched  = matchResume(form, reqs)
    const rewrites = buildRewrites(form, jd)
    const skills   = missingSkills(matched)
    const drafts   = suggestBullets(matched)
    setAnalysed({ matched, rewrites, skills, drafts })
    /* Rewrites are pre-ticked: they only restate what you already wrote.
       Skills and drafts start unticked — each is a claim you have to stand behind. */
    setPickedRewrites(new Set(rewrites.map(r => r.id)))
    setPickedSkills(new Set())
    setPickedBullets(new Set())
    setBulletText(Object.fromEntries(drafts.map(b => [b.id, b.text])))
    const firstTarget = bulletTargets(form)[0]
    setBulletTarget(Object.fromEntries(drafts.map(b => [b.id, firstTarget ? `${firstTarget.field}:${firstTarget.lineIndex}` : ''])))
    showToast(`${reqs.length} requirements found`)
  }

  const counts = useMemo(() => {
    if (!analysed) return null
    const c = { covered: 0, partial: 0, missing: 0 }
    analysed.matched.forEach(m => { c[m.status]++ })
    return c
  }, [analysed])

  function toggle(set, setter, id) {
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    setter(next)
  }

  function apply() {
    if (!analysed) return
    const rewrites = analysed.rewrites.filter(r => pickedRewrites.has(r.id))
    const skills   = analysed.skills.filter(s => pickedSkills.has(s.id)).map(s => s.term)
    const bullets  = analysed.drafts
      .filter(b => pickedBullets.has(b.id))
      .map(b => {
        const [field, line] = String(bulletTarget[b.id] || 'exp:0').split(':')
        return { text: bulletText[b.id] || b.text, targetField: field, targetLine: Number(line) || 0 }
      })

    if (!rewrites.length && !skills.length && !bullets.length) {
      showToast('Nothing selected')
      return
    }
    const next = applyDecisions(form, { rewrites, skills, bullets })
    setForm(next)
    onApplied && onApplied(next)
    const parts = []
    if (rewrites.length) parts.push(`${rewrites.length} rewrite${rewrites.length === 1 ? '' : 's'}`)
    if (bullets.length)  parts.push(`${bullets.length} bullet${bullets.length === 1 ? '' : 's'}`)
    if (skills.length)   parts.push(`${skills.length} skill${skills.length === 1 ? '' : 's'}`)
    showToast(`Applied ${parts.join(', ')}`)
    setAnalysed(null)
  }

  const pickedTotal = pickedRewrites.size + pickedSkills.size + pickedBullets.size
  const unfilled = analysed
    ? analysed.drafts.filter(b => pickedBullets.has(b.id) && !/\d/.test(bulletText[b.id] || '')).length
    : 0

  return (
    <div className="panel">
      <div className="panel-title">Match a job description</div>
      <p className="hint" style={{ marginTop: -6, marginBottom: 10 }}>
        Paste a posting from LinkedIn or a careers page. Nothing is added to your resume
        unless you tick it — this will not write experience you do not have.
      </p>

      <textarea
        value={jd}
        onChange={e => setJd(e.target.value)}
        placeholder="Paste the full job description here…"
        style={{ minHeight: 110 }}
      />

      <div className="btn-row">
        <button className="btn btn-primary" onClick={analyse} disabled={!canAnalyse}>
          ⇄ Compare with my resume
        </button>
        {analysed && (
          <button className="btn" onClick={() => setAnalysed(null)}>Clear</button>
        )}
      </div>
      {!canAnalyse && (jd || '').trim().length > 0 && (
        <p className="hint">Paste a bit more of the posting — that looks too short to read.</p>
      )}

      {analysed && (
        <>
          {/* ——— Coverage summary ——— */}
          <div className="jd-summary">
            <span className="jd-stat cov">{counts.covered} covered</span>
            <span className="jd-stat par">{counts.partial} partly</span>
            <span className="jd-stat mis">{counts.missing} not shown</span>
          </div>

          {/* ——— Rewrites ——— */}
          {analysed.rewrites.length > 0 && (
            <div className="jd-block">
              <div className="jd-block-head">
                Reword to match the posting
                <span className="jd-safe">Safe — your claims, their vocabulary</span>
              </div>
              {analysed.rewrites.map(r => (
                <label key={r.id} className={`jd-row ${pickedRewrites.has(r.id) ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={pickedRewrites.has(r.id)}
                    onChange={() => toggle(pickedRewrites, setPickedRewrites, r.id)}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="jd-diff-before">{r.before}</div>
                    <div className="jd-diff-after">{r.after}</div>
                    <div className="jd-why">
                      {r.changes.map((c, i) => (
                        <span key={i} className="jd-tag">{c.from} → {c.to}</span>
                      ))}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* ——— Draft bullets ——— */}
          {analysed.drafts.length > 0 && (
            <div className="jd-block">
              <div className="jd-block-head">
                Draft bullets for this role
                <span className="jd-warn">Drafts — edit each one to describe what you actually did</span>
              </div>
              {analysed.drafts.map(b => {
                const on = pickedBullets.has(b.id)
                const txt = bulletText[b.id] ?? b.text
                return (
                  <div key={b.id} className={`jd-draft ${on ? 'on' : ''}`}>
                    <label className="jd-draft-top">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(pickedBullets, setPickedBullets, b.id)}
                      />
                      <span className="jd-draft-src">Based on: “{b.source.slice(0, 70)}”</span>
                    </label>
                    <textarea
                      className={`jd-draft-text ${/\d/.test(txt) ? '' : 'todo'}`}
                      value={txt}
                      rows={2}
                      onChange={e => setBulletText(t => ({ ...t, [b.id]: e.target.value }))}
                      onFocus={() => { if (!on) toggle(pickedBullets, setPickedBullets, b.id) }}
                    />
                    <div className="jd-draft-foot">
                      <span>Add to</span>
                      <select
                        value={bulletTarget[b.id] || ''}
                        onChange={e => setBulletTarget(t => ({ ...t, [b.id]: e.target.value }))}
                      >
                        {targets.length === 0 && <option value="">No entries yet</option>}
                        {targets.map(t => (
                          <option key={`${t.field}:${t.lineIndex}`} value={`${t.field}:${t.lineIndex}`}>
                            {t.group} — {t.label}
                          </option>
                        ))}
                      </select>
                      {!/\d/.test(txt) && (
                        <span className="jd-todo-flag">add a number to strengthen this</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ——— Skills to consider ——— */}
          {analysed.skills.length > 0 && (
            <div className="jd-block">
              <div className="jd-block-head">
                Skills the posting asks for
                <span className="jd-warn">Only tick what you can defend in an interview</span>
              </div>
              <div className="jd-skill-wrap">
                {analysed.skills.map(s => (
                  <label key={s.id} className={`jd-skill ${pickedSkills.has(s.id) ? 'on' : ''}`} title={s.source}>
                    <input
                      type="checkbox"
                      checked={pickedSkills.has(s.id)}
                      onChange={() => toggle(pickedSkills, setPickedSkills, s.id)}
                    />
                    {s.term}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ——— Gaps, advisory only ——— */}
          {analysed.matched.some(m => m.status === 'missing') && (
            <div className="jd-block">
              <div className="jd-block-head">
                Not covered by your resume
                <span className="jd-note">Nothing to apply — add these yourself if they are true</span>
              </div>
              {analysed.matched.filter(m => m.status === 'missing').map(m => (
                <div key={m.id} className="jd-gap">
                  <span className="jd-type">{TYPE_LABEL[m.type] || m.type}</span>
                  {m.text}
                </div>
              ))}
            </div>
          )}

          {unfilled > 0 && (
            <p className="hint" style={{ color: 'var(--amber)', marginTop: 10 }}>
              {unfilled} selected draft{unfilled === 1 ? ' has' : 's have'} no number in
              {unfilled === 1 ? ' it' : ' them'}. Quantified bullets score higher and read as
              real work — add a figure before you download.
            </p>
          )}

          <div className="btn-row">
            <button className="btn btn-primary" onClick={apply} disabled={pickedTotal === 0}>
              ✓ Apply {pickedTotal > 0 ? `${pickedTotal} selected` : 'selected'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
