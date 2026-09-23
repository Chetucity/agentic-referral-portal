'use client'

import { useState, useMemo, useRef } from 'react'
import { getStructuredData, buildResumeHTML, isSplitTemplate, planSplitLayout } from '@/lib/resume/resumeData.js'
import { downloadPDF, downloadWord, downloadPNG, estimatePages } from '@/lib/resume/exports.js'

const TEMPLATES = ['classic', 'modern', 'minimal', 'split']
const TEMPLATE_LABELS = { classic: 'Classic', modern: 'Modern', minimal: 'Minimal', split: 'Split ✦' }
const SECTION_LABELS = {
  summary: 'Summary', exp: 'Experience', proj: 'Projects',
  edu: 'Education', certs: 'Certifications', skills: 'Skills',
  /* Sidebar-only sections — they appear in the column zones, so they need
     labels too or the raw keys leak into the UI. */
  ach: 'Key Achievements', courses: 'Training / Courses',
  langs: 'Languages', time: 'My Time',
}

/* Manual sizes the A- / A+ control steps through. 1.0 is the design size. */
const STEPS = [0.78, 0.84, 0.90, 0.96, 1.00, 1.06, 1.12, 1.18]

export default function Preview({
  form, template, accent, setTemplate, setAccent,
  sectionOrder, setSectionOrder, fontScale, setFontScale,
  columnPins = {}, setColumnPins, boldCerts, setBoldCerts,
  pageRef, showToast, gatedDownload, downloading,
}) {
  const data = getStructuredData(form)
  const split = isSplitTemplate(template)
  /* Computed once and shared with the column UI so the chips show exactly
     where each section actually landed, pinned or auto-placed. */
  const plan = useMemo(
    () => (split ? planSplitLayout(data, sectionOrder, columnPins) : null),
    [form, sectionOrder, columnPins, split]   // eslint-disable-line react-hooks/exhaustive-deps
  )
  const html = buildResumeHTML(data, { sectionOrder, template, plan: plan || undefined })

  /* Size, order and column controls are power-user tools — collapsed by
     default so the preview itself leads, expandable when needed. */
  const [tbOpen, setTbOpen] = useState(false)
  const [dragKey, setDragKey] = useState(null)
  const [overKey, setOverKey] = useState(null)
  const dragKeyRef = useRef(null)     // touch/HTML5 dataTransfer is unreliable across browsers

  /* Page count for the size the PDF will actually use. Recomputed only when
     something that affects layout changes — it runs a full render pass. */
  const exportOpts = {
    sectionOrder,
    fontScale: fontScale || undefined,
    columnPins,
    boldCerts,
  }

  const pages = useMemo(() => {
    try { return estimatePages(data, template, accent, exportOpts) } catch { return null }
  }, [form, template, accent, sectionOrder, fontScale, columnPins, boldCerts])   // eslint-disable-line react-hooks/exhaustive-deps

  /* ——— Font size ——— */
  const stepIndex = fontScale
    ? STEPS.reduce((best, v, i) => Math.abs(v - fontScale) < Math.abs(STEPS[best] - fontScale) ? i : best, 0)
    : STEPS.indexOf(1.00)

  function nudge(dir) {
    const next = Math.min(STEPS.length - 1, Math.max(0, stepIndex + dir))
    setFontScale(STEPS[next])
    showToast(`Font size ${Math.round(STEPS[next] * 100)}%`)
  }

  /* ——— Drag to reorder ——— */
  function onDragStart(key, e) {
    dragKeyRef.current = key
    setDragKey(key)
    try {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', key)   // Firefox needs data set to start a drag
    } catch {}
  }

  function onDragOver(key, e) {
    e.preventDefault()
    try { e.dataTransfer.dropEffect = 'move' } catch {}
    if (key !== overKey) setOverKey(key)
  }

  function drop(targetKey, e) {
    e.preventDefault()
    const from = dragKeyRef.current || (() => { try { return e.dataTransfer.getData('text/plain') } catch { return null } })()
    setDragKey(null); setOverKey(null); dragKeyRef.current = null
    if (!from || from === targetKey) return

    const next = [...sectionOrder]
    const fromIdx = next.indexOf(from)
    const toIdx = next.indexOf(targetKey)
    if (fromIdx === -1 || toIdx === -1) return
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, from)
    setSectionOrder(next)
    showToast(`Moved ${SECTION_LABELS[from] || from}`)
  }

  /* ——— Drag a section across the column divider ——— */
  const [overCol, setOverCol] = useState(null)

  function pinTo(key, col) {
    if (!setColumnPins) return
    setColumnPins(p => ({ ...p, [key]: col }))
    showToast(`${SECTION_LABELS[key] || key} → ${col === 'main' ? 'left' : 'right'} column`)
  }

  function dropOnColumn(col, e) {
    e.preventDefault()
    setOverCol(null)
    const key = dragKeyRef.current || (() => { try { return e.dataTransfer.getData('text/plain') } catch { return null } })()
    dragKeyRef.current = null
    setDragKey(null)
    if (!key) return
    const currentlyIn = plan && plan.side.includes(key) ? 'side' : 'main'
    if (currentlyIn === col && columnPins[key] === col) return   // nothing to change
    pinTo(key, col)
  }

  function unpin(key) {
    if (!setColumnPins) return
    setColumnPins(p => { const n = { ...p }; delete n[key]; return n })
    showToast(`${SECTION_LABELS[key] || key} back to auto`)
  }

  const colLabel = { main: 'Left column', side: 'Right column' }

  /* Keyboard equivalent — drag-and-drop alone is not reachable without a mouse. */
  function moveByKey(key, dir) {
    const idx = sectionOrder.indexOf(key)
    const to = idx + dir
    if (idx === -1 || to < 0 || to >= sectionOrder.length) return
    const next = [...sectionOrder]
    ;[next[idx], next[to]] = [next[to], next[idx]]
    setSectionOrder(next)
  }

  return (
    <div className="panel">
      <div className="preview-bar">
        <div className="pills">
          {TEMPLATES.map(t => (
            <button key={t} className={`pill ${template === t ? 'active' : ''}`} onClick={() => setTemplate(t)}>
              {TEMPLATE_LABELS[t]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="hint" style={{ margin: 0 }}>Accent</span>
          <input type="color" className="color-dot" value={accent} onChange={e => setAccent(e.target.value)} />
        </div>
      </div>

      {/* ——— Layout controls, folded away until wanted ——— */}
      <div className="tb">
        <button className="tb-head" onClick={() => setTbOpen(o => !o)} aria-expanded={tbOpen}>
          Layout &amp; sizing
          <span className="tb-sum">
            {fontScale ? `${Math.round(fontScale * 100)}%` : 'Auto'}
            {pages != null && ` · ${pages} page${pages > 1 ? 's' : ''}`}
            {split && Object.keys(columnPins).length > 0 && ` · ${Object.keys(columnPins).length} pinned`}
          </span>
          <span className="acc-chev">›</span>
        </button>

        {tbOpen && (
          <div className="tb-body">
      {/* ——— Size + page count ——— */}
      <div className="size-row">
        <span className="hint" style={{ margin: 0, fontWeight: 600 }}>Size</span>
        <div className="size-ctl">
          <button className="size-btn" onClick={() => nudge(-1)} disabled={stepIndex === 0} title="Smaller text">A−</button>
          <span className="size-val">
            {fontScale ? `${Math.round(fontScale * 100)}%` : 'Auto'}
          </span>
          <button className="size-btn" onClick={() => nudge(1)} disabled={stepIndex === STEPS.length - 1} title="Larger text">A+</button>
        </div>
        {fontScale && (
          <button className="btn btn-sm" onClick={() => { setFontScale(null); showToast('Back to auto-fit') }}>
            ↺ Auto
          </button>
        )}
        {pages != null && (
          <span className={`page-badge ${pages === 1 ? 'one' : ''}`}>
            {pages} page{pages > 1 ? 's' : ''}
          </span>
        )}
        <span className="hint" style={{ margin: 0, flexBasis: '100%' }}>
          {fontScale
            ? 'Manual size — shrink until it reads 1 page, or switch back to auto-fit.'
            : 'Auto-fit scales the text to fill the page. Use A− / A+ to take control.'}
        </span>
      </div>

      {/* ——— Section order: drag to rearrange ——— */}
      {sectionOrder && (
        <div className="ord-row">
          <span className="hint" style={{ margin: 0, fontWeight: 600 }}>Order</span>
          {sectionOrder.map(key => (
            <div
              key={key}
              className={`ord-chip drag ${dragKey === key ? 'dragging' : ''} ${overKey === key && dragKey !== key ? 'dropping' : ''}`}
              draggable
              onDragStart={e => onDragStart(key, e)}
              onDragOver={e => onDragOver(key, e)}
              onDragLeave={() => setOverKey(o => (o === key ? null : o))}
              onDrop={e => drop(key, e)}
              onDragEnd={() => { setDragKey(null); setOverKey(null); dragKeyRef.current = null }}
              tabIndex={0}
              role="button"
              aria-label={`${SECTION_LABELS[key] || key}. Use left and right arrow keys to move.`}
              onKeyDown={e => {
                if (e.key === 'ArrowLeft')  { e.preventDefault(); moveByKey(key, -1) }
                if (e.key === 'ArrowRight') { e.preventDefault(); moveByKey(key, 1) }
              }}
            >
              <span className="ord-grip" aria-hidden="true">⠿</span>
              {SECTION_LABELS[key] || key}
            </div>
          ))}
          <span className="hint" style={{ margin: 0, flexBasis: '100%' }}>
            Drag to rearrange, or focus a chip and use ← →.
          </span>
        </div>
      )}

      {/* ——— Column layout: drag a section across the divider ——— */}
      {split && plan && (
        <div className="col-zones">
          {['main', 'side'].map(col => {
            const keys = col === 'main' ? plan.main : plan.side
            return (
              <div
                key={col}
                className={`col-zone ${overCol === col ? 'over' : ''}`}
                onDragOver={e => { e.preventDefault(); if (overCol !== col) setOverCol(col) }}
                onDragLeave={() => setOverCol(c => (c === col ? null : c))}
                onDrop={e => dropOnColumn(col, e)}
              >
                <div className="col-zone-head">
                  {colLabel[col]}
                  <span className="col-zone-w">{col === 'main' ? '58%' : '42%'}</span>
                </div>
                <div className="col-zone-body">
                  {keys.length === 0 && <span className="col-zone-empty">Drop a section here</span>}
                  {keys.map(key => (
                    <div
                      key={key}
                      className={`col-chip ${columnPins[key] ? 'pinned' : ''} ${dragKey === key ? 'dragging' : ''}`}
                      draggable
                      onDragStart={e => onDragStart(key, e)}
                      onDragEnd={() => { setDragKey(null); setOverCol(null); dragKeyRef.current = null }}
                      title={columnPins[key] ? 'Pinned here — click the pin to return to auto' : 'Auto-placed. Drag to pin it to a column.'}
                    >
                      <span className="ord-grip" aria-hidden="true">⠿</span>
                      {SECTION_LABELS[key] || key}
                      {columnPins[key] && (
                        <button
                          className="col-unpin"
                          onClick={e => { e.stopPropagation(); unpin(key) }}
                          aria-label={`Return ${SECTION_LABELS[key] || key} to automatic placement`}
                        >📌</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          <p className="hint" style={{ flexBasis: '100%', margin: '2px 0 0' }}>
            Drag a section between columns to balance the page. 📌 marks one you placed —
            click it to hand that section back to auto.
            {Object.keys(columnPins).length > 0 && (
              <button
                className="btn btn-sm" style={{ marginLeft: 8 }}
                onClick={() => { setColumnPins({}); showToast('All sections back to auto') }}
              >↺ Reset all</button>
            )}
          </p>
        </div>
      )}

      {split && (
        <label className="opt-row">
          <input type="checkbox" checked={!!boldCerts} onChange={e => setBoldCerts(e.target.checked)} />
          Bold certification names
        </label>
      )}
          </div>
        )}
      </div>

      {split && (
        <div className="tpl-warn">
          <strong>Visual layout — costs 6 ATS points.</strong> Two columns can scramble when a
          machine parses the PDF. Best for direct applications, referrals, and portfolios —
          switch to Classic or Modern for job-portal submissions.
        </div>
      )}

      <div className="preview-bg">
        <div
          id="resume-page"
          ref={pageRef}
          className={`tpl-${template}${boldCerts ? ' certs-bold' : ''}`}
          style={{ '--tpl-accent': accent, '--font-scale': fontScale || 1 }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      <div className="dl-row">
        <button className="btn" disabled={downloading} onClick={() => gatedDownload(() => { downloadPDF(data, template, accent, exportOpts); showToast('PDF downloaded') })}>
          {downloading ? '⏳ Downloading…' : '⬇ PDF'}
        </button>
        <button className="btn" disabled={downloading} onClick={() => gatedDownload(() => { downloadWord(data, template, accent); showToast('Word file downloaded') })}>
          {downloading ? '⏳ Downloading…' : '⬇ Word'}
        </button>
        <button className="btn" disabled={downloading} onClick={() => gatedDownload(() => downloadPNG(pageRef.current, form.name).then(() => showToast('PNG downloaded')))}>
          {downloading ? '⏳ Downloading…' : '⬇ PNG'}
        </button>
      </div>
    </div>
  )
}
