import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { cleanBulletText, cleanProjectTitle, isSplitTemplate, planSplitLayout, joinParts } from './resumeData.js'

function fileName(name, ext) {
  return (name || 'resume').trim().replace(/\s+/g, '_') + '_resume.' + ext
}
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#000000')
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0]
}
function triggerDownload(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

/* ——— Text-based PDF ———
   Same auto-fit approach as the split renderer: measure on a throwaway
   document, solve for the type scale that fills A4, then draw for real. */
export function downloadPDF(data, template, accent, options = {}) {
  if (isSplitTemplate(template)) return downloadSplitPDF(data, template, accent, options)
  const d = data || {}
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
  const MIN_S = 0.76, MAX_S = 1.18
  const TOP = 56, LIMIT = 790
  const measure = (S, gap) =>
    renderSingle(new jsPDF({ unit: 'pt', format: 'a4' }), d, template, accent, options, S, gap)

  /* Phase 1 — type scale (skipped when the user has set a size). */
  let S = 1, r = null
  if (options.fontScale) {
    S = clamp(options.fontScale, 0.6, 1.6)
  } else {
    for (let pass = 0; pass < 5; pass++) {
      r = measure(S, 0)
      const avail = (LIMIT - TOP) * r.pages
      const next = clamp(S * Math.sqrt((avail * 0.985) / Math.max(r.height, 1)), MIN_S, MAX_S)
      if (Math.abs(next - S) < 0.012) { S = next; break }
      S = next
    }
  }

  /* Phase 2 — share the remaining height across the section breaks. */
  let gap = 0
  r = measure(S, 0)
  if (r.pages === 1 && r.sections > 1) {
    gap = clamp((LIMIT - r.bottom) / (r.sections - 1), 0, 26 * S)
  }

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const final = renderSingle(doc, d, template, accent, options, S, gap)
  if (final.pages > r.pages) {
    const safe = new jsPDF({ unit: 'pt', format: 'a4' })
    renderSingle(safe, d, template, accent, options, S, 0)
    return safe.save(fileName(d.name, 'pdf'))
  }
  doc.save(fileName(d.name, 'pdf'))
}

function renderSingle(doc, d, template, accent, options, S, gapBonus = 0) {
  const W = 595.28, M = 50, maxW = W - M * 2
  let y = 56
  const serif   = template === 'classic'
  const FONT    = serif ? 'times' : 'helvetica'
  const center  = template === 'classic'
  const acRgb   = template === 'modern' ? hexToRgb(accent)
                : template === 'minimal' ? [100, 100, 100]
                : [20, 20, 20]

  function ensure(h) { if (y + h > 790) { doc.addPage(); y = 56 } }
  function text(str, size, style, color, opts = {}) {
    const fs = size * S
    doc.setFont(FONT, style || 'normal')
    doc.setFontSize(fs)
    doc.setTextColor(...(color || [20, 20, 20]))
    const lines = doc.splitTextToSize(str, opts.maxW || maxW)
    lines.forEach(line => {
      ensure(fs * 1.35)
      opts.center ? doc.text(line, W / 2, y, { align: 'center' }) : doc.text(line, opts.x || M, y)
      y += fs * 1.35
    })
  }
  function heading(str) {
    y += 8 * S; ensure(30 * S)
    doc.setFont(FONT, 'bold'); doc.setFontSize(11 * S); doc.setTextColor(...acRgb)
    doc.text(str.toUpperCase(), M, y); y += 4 * S
    doc.setDrawColor(...acRgb); doc.setLineWidth((template === 'minimal' ? 0.5 : 1) * S)
    doc.line(M, y, W - M, y); y += 14 * S
  }
  function rowLR(left, right, size, styleL) {
    const fs = size * S
    doc.setFont(FONT, styleL || 'bold'); doc.setFontSize(fs); doc.setTextColor(20, 20, 20)
    const rightWidth = right ? doc.getTextWidth(right) + 15 * S : 0
    const leftMaxW = maxW - rightWidth
    const lines = doc.splitTextToSize(left || '', leftMaxW)

    ensure(lines.length * fs * 1.35)
    lines.forEach((l, idx) => {
      doc.text(l, M, y)
      if (idx === 0 && right) {
        doc.setFont(FONT, 'normal'); doc.setTextColor(100, 100, 100); doc.setFontSize((size - 1) * S)
        doc.text(right, W - M, y, { align: 'right' })
        doc.setFont(FONT, styleL || 'bold'); doc.setFontSize(fs); doc.setTextColor(20, 20, 20)
      }
      y += fs * 1.35
    })
    y += 2 * S
  }

  function renderBullet(bulletText) {
    const cleaned = cleanBulletText(bulletText)
    if (!cleaned) return
    const fs = 10 * S, indent = 16 * S
    const lines = doc.splitTextToSize(cleaned, maxW - indent)
    lines.forEach((line, idx) => {
      ensure(13.5 * S)
      if (idx === 0) {
        doc.setFont(FONT, 'normal'); doc.setFontSize(fs); doc.setTextColor(55, 55, 55)
        doc.text('•', M + 4 * S, y)
      }
      // Force regular font weight for explanation text — NEVER bold!
      doc.setFont(FONT, 'normal'); doc.setFontSize(fs); doc.setTextColor(55, 55, 55)
      doc.text(line, M + indent, y)
      y += 13.5 * S
    })
    y += 2 * S
  }

  /* Name & contact */
  doc.setFont(FONT, 'bold'); doc.setFontSize(22 * S)
  doc.setTextColor(...(template === 'modern' ? acRgb : [20, 20, 20]))
  center ? doc.text(d.name || 'Your Name', W / 2, y, { align: 'center' }) : doc.text(d.name || 'Your Name', M, y)
  y += 16 * S
  const contact = joinParts([d.title, d.email, d.phone, d.location, d.link], '  ·  ')
  if (contact) text(contact, 9.5, 'normal', [90, 90, 90], { center })
  y += 4 * S

  const renderers = {
    summary: () => {
      if (d.summary) { heading('Summary'); text(d.summary, 10, 'normal', [55, 55, 55]) }
    },
    exp: () => {
      if ((d.expList || []).length) {
        heading('Experience')
        d.expList.forEach(e => {
          rowLR(e.role || '', e.when || '', 11)
          if (e.org) text(e.org, 10, 'italic', [70, 70, 70])
          if (e.desc) e.desc.split(';').map(s => s.trim()).filter(Boolean).forEach(renderBullet)
          y += 4 * S
        })
      }
    },
    proj: () => {
      if ((d.projList || []).length) {
        heading('Projects')
        d.projList.forEach(e => {
          rowLR(e.role || '', e.when || e.org || '', 10.5, 'bold')
          if (e.org && e.when) text(e.org, 10, 'italic', [70, 70, 70])
          if (e.desc) e.desc.split(';').map(s => s.trim()).filter(Boolean).forEach(renderBullet)
          y += 4 * S
        })
      }
    },
    edu: () => {
      if ((d.eduList || []).length) {
        heading('Education')
        d.eduList.forEach(e => {
          rowLR(e.role || '', e.when || '', 11)
          if (e.org) text(e.org, 10, 'italic', [70, 70, 70])
          if (e.desc) text(e.desc, 10, 'normal', [55, 55, 55])
          y += 4 * S
        })
      }
    },
    certs: () => {
      if ((d.certList || []).length) {
        heading('Certifications')
        const certLine = joinParts(d.certList.map(e => joinParts([e.role, e.org, e.when], ' — ')), '  ·  ')
        text(certLine, 9.5, 'normal', [55, 55, 55])
      }
    },
    skills: () => {
      if ((d.skillList || []).length) {
        heading('Skills')
        text(d.skillList.join('  ·  '), 10, 'normal', [55, 55, 55])
      }
    }
  }

  const order = options.sectionOrder || ['summary', 'exp', 'proj', 'edu', 'certs', 'skills']
  let drawn = 0
  order.forEach(k => {
    if (!renderers[k]) return
    const before = y
    renderers[k]()
    if (y !== before) { drawn++; y += gapBonus }   // only count sections that produced output
  })
  if (drawn > 0) y -= gapBonus                      // no trailing gap after the last

  const pages = doc.internal.getNumberOfPages()
  return {
    bottom: y,
    pages,
    sections: drawn,
    /* Running height across pages, so the solver can compare like with like. */
    height: (pages - 1) * (790 - 56) + (y - 56),
  }
}

/* ——— Two-column PDF (split template) ———
   Every glyph is real jsPDF text, so the file stays selectable, searchable
   and machine-readable. Columns are tracked with independent cursors and
   flushed page-by-page, since jsPDF has no concept of flowing columns.

   renderSplit draws at a given type scale and reports how far down the page
   the content reached. downloadSplitPDF calls it once on a throwaway document
   to measure, solves for the scale that fills the page, then draws for real —
   so a short resume grows to fill A4 instead of trailing off half way down. */
function renderSplit(doc, d, accent, options, S, gaps = { main: 0, side: 0 }) {
  const W = 595.28, H = 841.89
  const M = 40
  /* 58/42 with a 26pt gutter — the same split the preview CSS uses, so the
     download reproduces what is on screen rather than an approximation. */
  const GAP = 26 * S
  const contentW = W - M * 2
  const mainW = (contentW - GAP) * 0.58
  const sideW = (contentW - GAP) * 0.42
  const sideX = M + mainW + GAP
  const TOP = 40 + 16 * S
  const BOTTOM = H - 40
  const ac = hexToRgb(accent)

  /* Independent vertical cursors — the columns advance separately.
     jsPDF has a single "current page" pointer, so each column must also
     track WHICH page it is on. Without this the sidebar starts wherever
     the main column happened to finish, leaving whole columns blank. */
  let yMain = 0, ySide = 0
  let pMain = 1, pSide = 1
  let maxPage = 1

  /* Move the document to `page`, creating it if it does not exist yet. */
  function gotoPage(page) {
    while (maxPage < page) { doc.addPage(); maxPage++ }
    doc.setPage(page)
  }

  function heading(str, x, y, w) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5 * S); doc.setTextColor(17, 17, 17)
    doc.text(str.toUpperCase(), x, y)
    y += 4 * S
    doc.setDrawColor(17, 17, 17); doc.setLineWidth(1.4 * S)
    doc.line(x, y, x + w, y)
    return y + 12 * S
  }

  /* Writes wrapped text at (x,y) in a fixed-width column, returns new y. */
  function block(str, x, y, w, { size = 9, style = 'normal', color = [55, 55, 55], gap = 1.35 } = {}) {
    if (!str) return y
    const fs = size * S
    doc.setFont('helvetica', style); doc.setFontSize(fs); doc.setTextColor(...color)
    doc.splitTextToSize(String(str), w).forEach(line => {
      doc.text(line, x, y)
      y += fs * gap
    })
    return y
  }

  function bullet(str, x, y, w) {
    const cleaned = cleanBulletText(str)
    if (!cleaned) return y
    const fs = 9 * S, indent = 9 * S
    doc.setFont('helvetica', 'normal'); doc.setFontSize(fs); doc.setTextColor(55, 55, 55)
    const lines = doc.splitTextToSize(cleaned, w - indent - 1)
    lines.forEach((line, i) => {
      if (i === 0) doc.text('•', x, y)
      doc.text(line, x + indent, y)
      y += 12 * S
    })
    return y + 1.5 * S
  }

  /* ——— Letterhead (full width) ——— */
  let y = TOP + 16 * S
  doc.setFont('helvetica', 'bold'); doc.setFontSize(24 * S); doc.setTextColor(17, 17, 17)
  doc.text((d.name || 'Your Name').toUpperCase(), M, y)
  y += 16 * S
  if (d.title) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5 * S); doc.setTextColor(...ac)
    doc.text(d.title, M, y); y += 14 * S
  }
  const contact = joinParts([d.phone, d.email, d.link, d.location], '   ·   ')
  if (contact) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5 * S); doc.setTextColor(51, 51, 51)
    doc.splitTextToSize(contact, contentW).forEach(line => {
      doc.text(line, M, y); y += 11 * S
    })
    y += 5 * S
  }
  const colTop = y
  yMain = colTop; ySide = colTop

  /* Same planner the preview uses, so the download matches what's on screen. */
  const plan = planSplitLayout(d, options.sectionOrder || [], options.columnPins)

  /* Each renderer takes a column context, so any section can be drawn in
     either column at either width. `gap` is the slack this column
     distributes after every entry and section. */
  const ctx = which => which === 'main'
    ? { side: false, x: M, w: mainW, gap: gaps.main || 0,
        get y() { return yMain }, set y(v) { yMain = v },
        get page() { return pMain }, set page(v) { pMain = v } }
    : { side: true, x: sideX, w: sideW, gap: gaps.side || 0,
        get y() { return ySide }, set y(v) { ySide = v },
        get page() { return pSide }, set page(v) { pSide = v } }

  /* Advances THIS column onto its next page, leaving the other column's
     position untouched. */
  const pageBreak = (c, need) => {
    if (c.y > BOTTOM - need) {
      c.page += 1
      c.y = TOP
      gotoPage(c.page)
    }
  }

  const drawEntries = (c, title, list, { showDesc = false, bulletDesc = false, plain = false } = {}) => {
    pageBreak(c, 60 * S)
    c.y = heading(title, c.x, c.y, c.w)
    list.forEach(e => {
      pageBreak(c, 46 * S)
      c.y = block(e.role || e.title, c.x, c.y, c.w,
        { size: 10, style: plain ? 'normal' : 'bold', color: plain ? [45, 45, 45] : [17, 17, 17] })
      if (e.org) c.y = block(e.org, c.x, c.y, c.w,
        { size: 9, style: plain ? 'normal' : 'bold', color: plain ? [95, 95, 95] : ac })
      const meta = joinParts([e.when, showDesc ? e.desc : ''], '  ·  ')
      if (meta) c.y = block(meta, c.x, c.y, c.w, { size: 8.5, color: [105, 105, 105] })
      if (bulletDesc && e.desc) {
        c.y += 2 * S
        e.desc.split(';').map(s => s.trim()).filter(Boolean)
          .forEach(b => { pageBreak(c, 26 * S); c.y = bullet(b, c.x, c.y, c.w) })
      }
      c.y += 7 * S + c.gap        // entry-level slack
    })
    c.y += 3 * S
  }

  const drawDonut = (c) => {
    pageBreak(c, 170 * S)
    c.y = heading('My Time', c.x, c.y, c.w)
    const narrow = c.w < 220
    const R = (narrow ? 36 : 46) * S
    const cx = c.x + R + 4 * S, cy = c.y + R
    const LETTERS = 'ABCDEFGH'
    let start = -90
    d.timeList.slice(0, 8).forEach((t, i) => {
      const sweep = (t.pct / 100) * 360
      /* jsPDF has no arc primitive — approximate the ring with short thick chords. */
      doc.setDrawColor(
        Math.round(ac[0] + (255 - ac[0]) * i * 0.08),
        Math.round(ac[1] + (255 - ac[1]) * i * 0.08),
        Math.round(ac[2] + (255 - ac[2]) * i * 0.08),
      )
      doc.setLineWidth((narrow ? 12 : 15) * S)
      const steps = Math.max(2, Math.ceil(sweep / 4))
      for (let s = 0; s < steps; s++) {
        const a1 = ((start + (sweep * s) / steps) * Math.PI) / 180
        const a2 = ((start + (sweep * (s + 1)) / steps) * Math.PI) / 180
        doc.line(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R,
                 cx + Math.cos(a2) * R, cy + Math.sin(a2) * R)
      }
      const mid = ((start + sweep / 2) * Math.PI) / 180
      const px = cx + Math.cos(mid) * (R + 10 * S), py = cy + Math.sin(mid) * (R + 10 * S)
      doc.setFillColor(17, 17, 17); doc.circle(px, py, 6.5 * S, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7 * S); doc.setTextColor(255, 255, 255)
      doc.text(LETTERS[i], px, py + 2.4 * S, { align: 'center' })
      start += sweep
    })

    /* Legend sits beside the donut when there's room, underneath when narrow. */
    const legendX = narrow ? c.x : cx + R + 20 * S
    let ly = narrow ? cy + R + 18 * S : c.y + 8 * S
    d.timeList.slice(0, 8).forEach((t, i) => {
      doc.setFillColor(17, 17, 17); doc.circle(legendX + 5 * S, ly - 3 * S, 5.5 * S, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7 * S); doc.setTextColor(255, 255, 255)
      doc.text(LETTERS[i], legendX + 5 * S, ly - 0.8 * S, { align: 'center' })
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5 * S); doc.setTextColor(55, 55, 55)
      const label = doc.splitTextToSize(`${t.label} (${Math.round(t.pct)}%)`, c.w - 20 * S)[0]
      doc.text(label, legendX + 15 * S, ly)
      ly += 13 * S
    })
    c.y = Math.max(cy + R + 12 * S, ly) + 6 * S
  }

  const drawSkills = (c) => {
    pageBreak(c, 60 * S)
    c.y = heading('Skills', c.x, c.y, c.w)
    let chipX = c.x, chipY = c.y
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5 * S)
    d.skillList.forEach(s => {
      const w = doc.getTextWidth(s) + 12 * S
      if (chipX + w > c.x + c.w) { chipX = c.x; chipY += 19 * S }
      doc.setTextColor(34, 34, 34)
      doc.text(s, chipX + 6 * S, chipY)
      doc.setDrawColor(216, 219, 224); doc.setLineWidth(1.6 * S)
      doc.line(chipX, chipY + 3.5 * S, chipX + w - 4 * S, chipY + 3.5 * S)
      chipX += w + 4 * S
    })
    c.y = chipY + 14 * S
  }

  const drawLangs = (c) => {
    pageBreak(c, 60 * S)
    c.y = heading('Languages', c.x, c.y, c.w)
    d.langList.forEach(l => {
      pageBreak(c, 30 * S)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5 * S); doc.setTextColor(17, 17, 17)
      doc.text(String(l.name || ''), c.x, c.y)
      const bw = 4 * S, bh = 12 * S, bgap = 2.5 * S
      let bx = c.x + c.w - (5 * bw + 4 * bgap)
      for (let i = 0; i < 5; i++) {
        if (i < l.bars) doc.setFillColor(...ac); else doc.setFillColor(223, 227, 232)
        doc.roundedRect(bx, c.y - bh + 3 * S, bw, bh, 1, 1, 'F')
        bx += bw + bgap
      }
      c.y += 11 * S
      if (l.level) c.y = block(l.level, c.x, c.y, c.w, { size: 8, color: [110, 110, 110] })
      c.y += 6 * S
    })
  }

  const drawAch = (c) => {
    pageBreak(c, 60 * S)
    c.y = heading('Key Achievements', c.x, c.y, c.w)
    d.achList.forEach(a => {
      pageBreak(c, 36 * S)
      c.y = block(a.title, c.x, c.y, c.w, { size: 9.5, style: 'bold', color: [17, 17, 17] })
      if (a.desc) c.y = block(a.desc, c.x, c.y, c.w, { size: 8.5, color: [70, 70, 70] })
      c.y += 6 * S
    })
  }

  const renderers = {
    summary: c => { pageBreak(c, 50 * S); c.y = heading('Summary', c.x, c.y, c.w); c.y = block(d.summary, c.x, c.y, c.w, { size: 9 }) + 10 * S },
    exp:     c => drawEntries(c, 'Experience', d.expList, { bulletDesc: true }),
    proj:    c => drawEntries(c, 'Projects', d.projList, { bulletDesc: true }),
    edu:     c => drawEntries(c, 'Education', d.eduList, { showDesc: true }),
    certs:   c => drawEntries(c, 'Certifications', d.certList, { plain: !options.boldCerts }),
    courses: c => drawEntries(c, 'Training / Courses', d.courseList),
    skills:  drawSkills,
    langs:   drawLangs,
    ach:     drawAch,
    time:    drawDonut,
  }

  /* gapBonus is the leftover page height shared between the sections of a
     column, so a short resume settles evenly down the page instead of
     bunching at the top. Applied between sections, never after the last.

     Each column is drawn as a run, re-selecting its own page first, so the
     two columns stay side by side across every page. */
  gotoPage(pMain)
  plan.main.forEach((k, i) => {
    if (!renderers[k]) return
    gotoPage(pMain)
    renderers[k](ctx('main'))
    if (i < plan.main.length - 1) yMain += gaps.main
  })

  gotoPage(pSide)
  plan.side.forEach((k, i) => {
    if (!renderers[k]) return
    gotoPage(pSide)
    renderers[k](ctx('side'))
    if (i < plan.side.length - 1) ySide += gaps.side
  })

  /* Slots = every place slack can be inserted without looking like a mistake:
     between sections, and between entries inside them. */
  const entryCount = { exp: (d.expList || []).length, proj: (d.projList || []).length,
    edu: (d.eduList || []).length, certs: (d.certList || []).length,
    courses: (d.courseList || []).length, ach: (d.achList || []).length }
  const slots = keys => keys.reduce((n, k) => n + 1 + (entryCount[k] || 0), 0)

  /* Flatten each column's position to a single running height so the fit
     solver can reason about multi-page content: page 2 at y=200 is taller
     than page 1 at y=700. */
  const colH = (page, y) => (page - 1) * (BOTTOM - TOP) + (y - TOP)

  return {
    bottom: Math.max(yMain, ySide),
    bottomMain: yMain,
    bottomSide: ySide,
    heightMain: colH(pMain, yMain),
    heightSide: colH(pSide, ySide),
    height: Math.max(colH(pMain, yMain), colH(pSide, ySide)),
    slotsMain: slots(plan.main),
    slotsSide: slots(plan.side),
    pages: maxPage,
    top: TOP,
    limit: BOTTOM,
    pageH: BOTTOM - TOP,
  }
}

/* Solve for the type scale that fills the page, then draw once for real.
   Scaling changes how text wraps, so the measurement is iterated rather
   than solved in a single step. */
function downloadSplitPDF(data, template, accent, options = {}) {
  const d = data || {}
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
  /* Type is capped well short of what would fill the page on its own —
     beyond ~1.2 a resume starts to read as large-print. The rest of the
     gap is closed with spacing, which is invisible where type is not. */
  const MIN_S = 0.74, MAX_S = 1.18
  const measure = (S, gaps) =>
    renderSplit(new jsPDF({ unit: 'pt', format: 'a4' }), d, accent, options, S, gaps)

  let S, r
  if (options.fontScale) {
    /* Manual size — honour it exactly, no solving. */
    S = clamp(options.fontScale, 0.6, 1.6)
    r = measure(S, { main: 0, side: 0 })
  } else {
    /* Phase 1 — solve the type scale. Scaling rewraps text, so iterate. */
    S = 1
    for (let pass = 0; pass < 5; pass++) {
      r = measure(S, { main: 0, side: 0 })
      const avail = r.pageH * r.pages          // height actually available
      const next = clamp(S * Math.sqrt((avail * 0.985) / Math.max(r.height, 1)), MIN_S, MAX_S)
      if (Math.abs(next - S) < 0.012) { S = next; break }
      S = next
    }
  }

  /* Phase 2 — share whatever is left down each column separately, so both
     reach the bottom together. Only meaningful on the final page. */
  let gaps = { main: 0, side: 0 }
  r = measure(S, gaps)
  const share = (k) => {
    const bottom = k === 'main' ? r.bottomMain : r.bottomSide
    const n = (k === 'main' ? r.slotsMain : r.slotsSide) - 1
    if (n < 1) return 0
    const room = Math.max(0, r.limit - bottom)
    /* Spread thinly across many slots; the cap keeps any single gap from
       reading as a missing section. */
    return clamp(room / n, 0, 15 * S)
  }
  gaps = { main: share('main'), side: share('side') }

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const final = renderSplit(doc, d, accent, options, S, gaps)
  /* Spacing pushed it onto another page — fall back to no extra spacing. */
  if (final.pages > r.pages) {
    const safe = new jsPDF({ unit: 'pt', format: 'a4' })
    renderSplit(safe, d, accent, options, S, { main: 0, side: 0 })
    return safe.save(fileName(d.name, 'pdf'))
  }
  doc.save(fileName(d.name, 'pdf'))
}

/* Page count without producing a file — drives the live estimate in the UI. */
export function estimatePages(data, template, accent, options = {}) {
  const d = data || {}
  try {
    if (isSplitTemplate(template)) {
      const S = options.fontScale || 1
      return renderSplit(new jsPDF({ unit: 'pt', format: 'a4' }), d, accent, options, S).pages
    }
    const S = options.fontScale || 1
    return renderSingle(new jsPDF({ unit: 'pt', format: 'a4' }), d, template, accent, options, S).pages
  } catch { return 1 }
}

/* ——— Word (.doc HTML blob) ——— */
export function downloadWord(data, template, accent) {
  const d = data || {}
  const font = template === 'classic' ? 'Georgia, "Times New Roman", serif' : 'Calibri, Arial, sans-serif'
  const acColor = template === 'modern' ? accent : '#111111'
  const secHead = s => `<h2 style="font-size:10pt;text-transform:uppercase;letter-spacing:1pt;border-bottom:1pt solid ${acColor};padding-bottom:2pt;margin:14pt 0 6pt;color:${acColor}">${s}</h2>`
  const centerStyle = template === 'classic' ? 'text-align:center;' : ''
  const h1Color = template === 'modern' ? `color:${accent};` : ''

  const skillsLine = (d.skillList || []).join('  ·  ')
  const expHTML = (d.expList || []).map(e => `
    <p style="margin:4pt 0 0"><b>${e.role || ''}</b>${e.when ? `<span style="float:right;color:#777;font-size:9pt">${e.when}</span>` : ''}</p>
    ${e.org ? `<p style="font-style:italic;font-size:10pt;color:#444;margin:1pt 0">${e.org}</p>` : ''}
    ${e.desc ? `<ul style="margin:2pt 0 6pt 14pt">${e.desc.split(';').map(s => s.trim()).filter(Boolean).map(s => `<li style="font-size:10pt;font-weight:normal">${s}</li>`).join('')}</ul>` : ''}
  `).join('')
  const eduHTML = (d.eduList || []).map(e => `
    <p style="margin:4pt 0 0"><b>${e.role || ''}</b>${e.when ? `<span style="float:right;color:#777;font-size:9pt">${e.when}</span>` : ''}</p>
    ${e.org ? `<p style="font-style:italic;font-size:10pt;color:#444;margin:1pt 0">${e.org}</p>` : ''}
    ${e.desc ? `<p style="font-size:10pt;color:#444;margin:1pt 0 6pt">${e.desc}</p>` : ''}
  `).join('')
  const projHTML = (d.projList || []).map(e => `
    <p style="margin:4pt 0 0"><b>${e.role || ''}</b>${e.when ? `<span style="float:right;color:#777;font-size:9pt">${e.when}</span>` : ''}</p>
    ${e.org ? `<p style="font-style:italic;font-size:10pt;color:#444;margin:1pt 0">${e.org}</p>` : ''}
    ${e.desc ? `<ul style="margin:2pt 0 6pt 14pt">${e.desc.split(';').map(s => s.trim()).filter(Boolean).map(s => `<li style="font-size:10pt;font-weight:normal">${s}</li>`).join('')}</ul>` : ''}
  `).join('')
  const certLine = joinParts((d.certList || []).map(e => joinParts([e.role, e.org, e.when], ' — ')), '  ·  ')
  const certHTML = certLine ? secHead('Certifications') + `<p style="font-size:10pt;color:#444">${certLine}</p>` : ''

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>Resume</title>
<style>body{font-family:${font};font-size:11pt;color:#111;max-width:7in;margin:auto;}</style>
</head><body>
<h1 style="font-size:20pt;margin:0 0 2pt;${centerStyle}${h1Color}">${d.name || ''}</h1>
<p style="font-size:9pt;color:#555;margin-bottom:12pt;${centerStyle}">${joinParts([d.title, d.email, d.phone, d.location, d.link], '  ·  ')}</p>
${d.summary ? secHead('Summary') + `<p style="font-size:10pt;color:#444">${d.summary}</p>` : ''}
${expHTML ? secHead('Experience') + expHTML : ''}
${projHTML ? secHead('Projects') + projHTML : ''}
${eduHTML ? secHead('Education') + eduHTML : ''}
${certHTML}
${skillsLine ? secHead('Skills') + `<p style="font-size:10pt">${skillsLine}</p>` : ''}
</body></html>`

  const blob = new Blob(['﻿' + html], { type: 'application/msword' })
  triggerDownload(blob, fileName(d.name, 'doc'))
}

/* ——— PNG snapshot ———
   The on-screen sheet is tinted slightly off-white to sit comfortably in the
   dark interface. A downloaded file has no such surround, so the element is
   forced to pure white for the capture and restored immediately after. */
export async function downloadPNG(pageRef, name) {
  if (!pageRef) return
  const prev = pageRef.style.background
  pageRef.style.background = '#ffffff'
  try {
    const canvas = await html2canvas(pageRef, { scale: 2, backgroundColor: '#ffffff' })
    await new Promise(res => canvas.toBlob(blob => {
      triggerDownload(blob, fileName(name, 'png'))
      res()
    }))
  } finally {
    pageRef.style.background = prev
  }
}

/* ——— Cover letter: text-based PDF ——— */
function coverFileName(name, ext) {
  return (name || 'cover').trim().replace(/\s+/g, '_') + '_cover_letter.' + ext
}

export function downloadCoverLetterPDF(letter, template = 'classic', accent = '#2563eb') {
  if (!letter) return
  const m = letter.meta || {}
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = 595.28, M = 64, maxW = W - M * 2
  let y = 64
  const serif = template === 'classic'
  const FONT  = serif ? 'times' : 'helvetica'
  const acRgb = template === 'modern' ? hexToRgb(accent) : [20, 20, 20]

  function ensure(h) { if (y + h > 780) { doc.addPage(); y = 64 } }
  function text(str, size, style, color, opts = {}) {
    if (!str) return
    doc.setFont(FONT, style || 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...(color || [40, 40, 40]))
    doc.splitTextToSize(str, opts.maxW || maxW).forEach(line => {
      ensure(size * 1.5)
      opts.center ? doc.text(line, W / 2, y, { align: 'center' }) : doc.text(line, M, y)
      y += size * 1.5
    })
  }

  /* Letterhead */
  doc.setFont(FONT, 'bold'); doc.setFontSize(19)
  doc.setTextColor(...(template === 'modern' ? acRgb : [20, 20, 20]))
  doc.text(m.name || 'Your Name', M, y); y += 18
  const sub = joinParts([m.title, m.location], '  ·  ')
  if (sub) text(sub, 9.5, 'normal', [90, 90, 90])
  const contact = joinParts([m.email, m.phone, m.link], '  ·  ')
  if (contact) text(contact, 9.5, 'normal', [90, 90, 90])

  y += 6
  doc.setDrawColor(...acRgb); doc.setLineWidth(template === 'minimal' ? 0.5 : 1)
  doc.line(M, y, W - M, y); y += 24

  /* Date and addressee */
  if (m.date) { text(m.date, 10, 'normal', [110, 110, 110]); y += 8 }
  if (m.company) {
    text(m.company, 10.5, 'bold', [30, 30, 30])
    if (m.role) text(`Re: ${m.role}`, 10, 'normal', [90, 90, 90])
    y += 10
  }

  /* Body */
  text(letter.greeting, 11, 'normal', [25, 25, 25]); y += 8
  ;(letter.paragraphs || []).forEach(p => { text(p, 10.5, 'normal', [45, 45, 45]); y += 10 })

  y += 6
  text(letter.closing, 10.5, 'normal', [45, 45, 45]); y += 16
  text(letter.signature, 11.5, 'bold', [20, 20, 20])

  doc.save(coverFileName(m.name, 'pdf'))
}

/* ——— Cover letter: Word (.doc HTML blob) ——— */
export function downloadCoverLetterWord(letter, template = 'classic', accent = '#2563eb') {
  if (!letter) return
  const m = letter.meta || {}
  const font = template === 'classic' ? 'Georgia, "Times New Roman", serif' : 'Calibri, Arial, sans-serif'
  const acColor = template === 'modern' ? accent : '#111111'

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>Cover Letter</title>
<style>body{font-family:${font};font-size:11pt;color:#222;max-width:6.5in;margin:auto;line-height:1.6}</style>
</head><body>
<h1 style="font-size:18pt;margin:0 0 2pt;color:${template === 'modern' ? accent : '#111'}">${m.name || ''}</h1>
<p style="font-size:9pt;color:#666;margin:0">${joinParts([m.title, m.location], '  ·  ')}</p>
<p style="font-size:9pt;color:#666;margin:2pt 0 10pt">${joinParts([m.email, m.phone, m.link], '  ·  ')}</p>
<hr style="border:none;border-top:1pt solid ${acColor};margin-bottom:16pt">
${m.date ? `<p style="font-size:10pt;color:#777;margin-bottom:12pt">${m.date}</p>` : ''}
${m.company ? `<p style="margin:0"><b>${m.company}</b></p>` : ''}
${m.role ? `<p style="font-size:10pt;color:#666;margin:0 0 14pt">Re: ${m.role}</p>` : ''}
<p style="margin-bottom:12pt">${letter.greeting}</p>
${(letter.paragraphs || []).map(p => `<p style="margin-bottom:12pt;text-align:justify">${p}</p>`).join('')}
<p style="margin:18pt 0 4pt">${letter.closing}</p>
<p style="margin:0"><b>${letter.signature}</b></p>
</body></html>`

  const blob = new Blob(['﻿' + html], { type: 'application/msword' })
  triggerDownload(blob, coverFileName(m.name, 'doc'))
}
