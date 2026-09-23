/* Pure data functions — no DOM, no React, no side-effects.
   All renderers (preview, PDF, comparison) consume getStructuredData(). */

/* Joins only the parts that carry real content.
   filter(Boolean) keeps whitespace-only strings, which then render as bare
   separators — the "Data Engineer · · · Delhi" problem. Trim first. */
export function joinParts(parts, sep = ' · ') {
  return (parts || [])
    .map(p => (p == null ? '' : String(p).trim()))
    .filter(p => p.length > 0)
    .join(sep)
}

export function parseLines(text, keys) {
  const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean)
  const hasDesc = keys.includes('desc')
  const out = []

  for (const line of lines) {
    const parts = line.split('|').map(p => p.trim())
    const isBulletChar = /^[•▪*\-–—]\s+/.test(line)
    const body = line.replace(/^[•▪*\-–—]\s+/, '')

    /* A bulleted line, or a long pipe-less sentence, is description text —
       not a new job title. Attach it to the entry above so it stays normal
       weight instead of rendering as a bold role heading. */
    if (hasDesc && parts.length === 1 && (isBulletChar || body.length > 60 || /[.!?]$/.test(body))) {
      const prev = out[out.length - 1]
      if (prev) {
        prev.desc = prev.desc ? `${prev.desc}; ${body}` : body
      } else {
        out.push({ role: '', org: '', when: '', desc: body })
      }
      continue
    }

    const o = {}
    if (parts.length >= 4 && (hasDesc || keys.includes('when'))) {
      o.role = parts[0] || ''
      o.org = parts[1] || ''
      o.when = parts[2] || ''
      o.desc = parts.slice(3).join('; ') || ''
    } else {
      keys.forEach((k, i) => { o[k] = parts[i] || '' })
    }
    out.push(o)
  }
  return out
}

/* Language proficiency → filled bars out of 5. */
const LEVELS = {
  native: 5, bilingual: 5, fluent: 5, mother: 5,
  advanced: 4, professional: 4, proficient: 4, c1: 4, c2: 5,
  intermediate: 3, conversational: 3, b1: 3, b2: 3,
  basic: 2, elementary: 2, beginner: 1, a1: 1, a2: 2,
}
export function levelToBars(level) {
  const key = String(level || '').toLowerCase().trim()
  if (!key) return 3
  for (const k in LEVELS) if (key.includes(k)) return LEVELS[k]
  const n = parseInt(key, 10)
  return n >= 1 && n <= 5 ? n : 3
}

export function getStructuredData(form) {
  const f = form || {}
  const langList = parseLines(f.languages, ['name', 'level'])
    .map(l => ({ ...l, bars: levelToBars(l.level) }))

  /* "Client delivery | 40" → slice with a share. People reach for whatever
     separator feels natural, so a colon, dash, equals or just a trailing
     number all work; otherwise every share reads as zero and the donut
     silently falls back to equal slices. Shares are normalised, so the
     numbers never have to add up to 100. */
  const rawTime = String(f.timeAlloc || '').split('\n')
    .map(line => line.trim()).filter(Boolean)
    .map(line => {
      let label = line, share = 0
      const piped = line.split('|')
      if (piped.length > 1) {
        label = piped[0]
        share = parseFloat(String(piped[1]).replace(/[^\d.]/g, ''))
      } else {
        /* Trailing number, however it is attached: "Review: 20", "Review - 20",
           "Review = 20", "Review 20%", "Review20" */
        const m = line.match(/^(.*?)[\s:=\-–—]*(\d+(?:\.\d+)?)\s*%?$/)
        if (m) { label = m[1]; share = parseFloat(m[2]) }
      }
      return {
        label: String(label).replace(/[\s:=\-–—]+$/, '').trim(),
        share: Number.isFinite(share) ? Math.max(0, share) : 0,
      }
    })
    .filter(t => t.label)
  const totalShare = rawTime.reduce((s, t) => s + t.share, 0)
  const timeList = rawTime.map(t => ({
    ...t,
    pct: totalShare > 0 ? (t.share / totalShare) * 100 : 100 / rawTime.length,
  }))

  return {
    ...f,
    skillList: (f.skills || '').split(',').map(s => s.trim()).filter(Boolean),
    expList:   parseLines(f.exp,   ['role', 'org', 'when', 'desc']),
    eduList:   parseLines(f.edu,   ['role', 'org', 'when', 'desc']),
    projList:  parseLines(f.proj,  ['role', 'org', 'when', 'desc']),
    certList:  parseLines(f.certs, ['role', 'org', 'when']),
    achList:   parseLines(f.achievements, ['title', 'desc']),
    courseList: parseLines(f.courses, ['title', 'org', 'when']),
    langList,
    timeList,
  }
}

export function autoSummary(form) {
  const d = getStructuredData(form)
  const title = d.title || 'professional'
  const top = d.skillList.slice(0, 4).join(', ')
  const yrs = d.expList.length
  let s = `${title.charAt(0).toUpperCase() + title.slice(1)}`
  s += top ? ` skilled in ${top}.` : ' with a focus on delivering quality work.'
  if (yrs) s += ` Experience across ${yrs} role${yrs > 1 ? 's' : ''}, with a track record of shipping measurable results.`
  s += ' Seeking to contribute strong technical and problem-solving skills to a growing team.'
  return s
}

export function cleanBulletText(b) {
  return String(b || '').trim()
}

export function cleanProjectTitle(t) {
  return String(t || '').trim()
}

/* Builds the inner HTML for the resume page.
   Called by both the live preview and the comparison view.
   Uses CSS classes on #page-root for template switching. */
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function bullets(desc) {
  const parts = desc.split(';').map(s => s.trim()).filter(Boolean)
  if (parts.length <= 1) return `<span style="font-weight:400">${esc(parts[0] || desc)}</span>`
  return '<ul>' + parts.map(p => `<li style="font-weight:400">${esc(p)}</li>`).join('') + '</ul>'
}

function itemHTML(e) {
  const head = (e.role || e.when)
    ? `<div class="r-top">
      <span class="r-role">${esc(e.role)}</span>
      <span class="r-when">${esc(e.when)}</span>
    </div>`
    : ''
  return `<div class="r-item">
    ${head}
    ${e.org ? `<div class="r-org">${esc(e.org)}</div>` : ''}
    ${e.desc ? `<div class="r-desc">${bullets(e.desc)}</div>` : ''}
  </div>`
}

/* ——— Sidebar pieces for the split template ——— */

function langBarsHTML(list) {
  return list.map(l => `<div class="r-lang">
    <div class="r-lang-row">
      <span class="r-lang-name">${esc(l.name)}</span>
      <span class="r-lang-bars">${
        Array.from({ length: 5 }, (_, i) =>
          `<i class="${i < l.bars ? 'on' : ''}"></i>`).join('')
      }</span>
    </div>
    ${l.level ? `<div class="r-lang-level">${esc(l.level)}</div>` : ''}
  </div>`).join('')
}

/* Donut built from stroke-dasharray arcs on concentric circles — no JS,
   no chart library, and it survives being serialised into innerHTML. */
export function donutSVG(timeList, size = 132) {
  if (!timeList || !timeList.length) return ''
  const r = size / 2 - 16, cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  const LETTERS = 'ABCDEFGH'
  let offset = 0
  const arcs = timeList.slice(0, 8).map((t, i) => {
    const len = (t.pct / 100) * circ
    const gap = Math.min(3, len * 0.08)          // small separator between slices
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="var(--tpl-accent, #2563eb)" stroke-width="22"
      stroke-dasharray="${Math.max(0, len - gap)} ${circ}"
      stroke-dashoffset="${-offset}"
      opacity="${1 - i * 0.09}" transform="rotate(-90 ${cx} ${cy})" />`
    offset += len
    return seg
  }).join('')

  /* Letter pucks positioned at each slice midpoint */
  let acc = 0
  const pucks = timeList.slice(0, 8).map((t, i) => {
    const mid = acc + t.pct / 2
    acc += t.pct
    const ang = (mid / 100) * 2 * Math.PI - Math.PI / 2
    const px = cx + Math.cos(ang) * (r + 13)
    const py = cy + Math.sin(ang) * (r + 13)
    return `<circle cx="${px}" cy="${py}" r="9" fill="#111"/>
      <text x="${px}" y="${py + 3.4}" text-anchor="middle"
        font-size="9.5" font-weight="700" fill="#fff">${LETTERS[i]}</text>`
  }).join('')

  return `<svg class="r-donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"
    xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Time allocation">
    ${arcs}${pucks}
  </svg>`
}

function timeHTML(timeList) {
  const LETTERS = 'ABCDEFGH'
  const legend = timeList.slice(0, 8).map((t, i) =>
    `<li><span class="r-time-key">${LETTERS[i]}</span>${esc(t.label)}
      <span class="r-time-pct">${Math.round(t.pct)}%</span></li>`).join('')
  return `<div class="r-time">${donutSVG(timeList)}<ul class="r-time-legend">${legend}</ul></div>`
}

/* Templates that render as two columns. Kept here so the scorer and the
   preview agree on which layouts carry an ATS parsing risk. */
export const SPLIT_TEMPLATES = ['split']
export const isSplitTemplate = t => SPLIT_TEMPLATES.includes(t)

/* ═══════════════════════════════════════════════════════════
   Split layout planner

   A fixed main/sidebar split leaves the sidebar empty whenever the
   optional fields aren't filled. Instead, estimate how tall each
   section renders and pack the two columns to similar heights.

   Two sections are anchored: the summary and experience carry the
   narrative and belong in the wide column. Everything else floats
   to whichever side keeps the page balanced, nudged by a bias that
   reflects how each section reads — skills and languages scan well
   narrow, the donut needs width.
   ═══════════════════════════════════════════════════════════ */

const wordCount = s => String(s || '').trim().split(/\s+/).filter(Boolean).length

/* Rough rendered height in px. Absolute accuracy doesn't matter —
   only the ratio between sections, which drives the packing. */
function sectionHeights(d) {
  const entryH = list => (list || []).reduce((sum, e) => {
    const descLines = e.desc
      ? e.desc.split(';').filter(s => s.trim()).reduce((n, b) => n + Math.max(1, Math.ceil(wordCount(b) / 9)), 0)
      : 0
    return sum + 34 + descLines * 15
  }, 0)

  return {
    summary: d.summary ? 26 + Math.ceil(wordCount(d.summary) / 9) * 15 : 0,
    exp:     (d.expList || []).length  ? 26 + entryH(d.expList)  : 0,
    proj:    (d.projList || []).length ? 26 + entryH(d.projList) : 0,
    edu:     (d.eduList || []).length  ? 26 + (d.eduList).length * 46 : 0,
    certs:   (d.certList || []).length ? 26 + (d.certList).length * 40 : 0,
    skills:  (d.skillList || []).length ? 26 + Math.ceil((d.skillList).length / 3) * 24 : 0,
    ach:     (d.achList || []).length  ? 26 + (d.achList).length * 44 : 0,
    courses: (d.courseList || []).length ? 26 + (d.courseList).length * 42 : 0,
    langs:   (d.langList || []).length ? 26 + (d.langList).length * 34 : 0,
    time:    (d.timeList || []).length ? 26 + Math.max(150, (d.timeList).length * 20) : 0,
  }
}

/* > 0 leans to the sidebar, < 0 leans to the main column.
   Magnitude is a height allowance, not a hard rule — a strongly
   biased section still moves if it would badly unbalance the page. */
const COLUMN_BIAS = {
  langs: 260, skills: 200, ach: 150, courses: 150, certs: 60, edu: 40,
  proj: -80, time: -220,
}

/* `pins` maps a section key to 'main' or 'side'. A pinned section is placed
   where the user put it and taken out of the balancing entirely — an explicit
   choice should never be second-guessed by the estimator. */
export function planSplitLayout(data, order = [], pins = {}) {
  const d = data || {}
  const h = sectionHeights(d)
  const present = k => h[k] > 0

  const pinnedTo = k => (pins && (pins[k] === 'main' || pins[k] === 'side')) ? pins[k] : null

  /* Summary and experience carry the narrative, but an explicit pin wins. */
  const main = ['summary', 'exp'].filter(k => present(k) && pinnedTo(k) !== 'side')
  const side = ['summary', 'exp'].filter(k => present(k) && pinnedTo(k) === 'side')
  let hMain = main.reduce((s, k) => s + h[k], 0)
  let hSide = side.reduce((s, k) => s + h[k], 0)

  /* Largest first — big blocks decide the shape of the page, small ones
     are better used afterwards to even out whatever gap remains. */
  const candidates = ['ach', 'skills', 'edu', 'certs', 'courses', 'langs', 'proj', 'time']
    .filter(present)

  /* Honour pins before anything floats, so the balancer works with what is
     actually left rather than a layout the user has already overridden. */
  candidates.filter(k => pinnedTo(k)).forEach(k => {
    if (pinnedTo(k) === 'main') { main.push(k); hMain += h[k] }
    else { side.push(k); hSide += h[k] }
  })

  const floating = candidates
    .filter(k => !pinnedTo(k))
    .sort((a, b) => h[b] - h[a])

  floating.forEach(k => {
    const bias = COLUMN_BIAS[k] || 0
    /* Compare the resulting imbalance either way, with the bias acting
       as a discount on its preferred side. */
    const ifSide = Math.abs((hSide + h[k] - bias) - hMain)
    const ifMain = Math.abs(hSide - (hMain + h[k] + bias))
    if (ifSide <= ifMain) { side.push(k); hSide += h[k] }
    else { main.push(k); hMain += h[k] }
  })

  /* A single-column page defeats the template. If everything landed in
     one column, move the most sidebar-friendly sections across until
     the shorter column holds a reasonable share. */
  const rescue = (from, to, fromH, toH) => {
    const movable = [...from]
      .filter(k => !['summary', 'exp'].includes(k) && !pinnedTo(k))   // never move a pin
      .sort((a, b) => (COLUMN_BIAS[b] || 0) - (COLUMN_BIAS[a] || 0))
    for (const k of movable) {
      if (toH >= fromH * 0.45) break
      from.splice(from.indexOf(k), 1)
      to.push(k)
      fromH -= h[k]; toH += h[k]
    }
    return [fromH, toH]
  }
  if (side.length === 0 || hSide < hMain * 0.25) [hMain, hSide] = rescue(main, side, hMain, hSide)
  if (main.length <= 2 && hMain < hSide * 0.4) [hSide, hMain] = rescue(side, main, hSide, hMain)

  /* Respect the user's section-order chips where both live in the same column. */
  const rank = k => {
    const alias = { ach: 'certs', courses: 'edu', langs: 'skills', time: 'proj' }
    const i = order.indexOf(k)
    if (i !== -1) return i
    const j = order.indexOf(alias[k])
    return j !== -1 ? j + 0.5 : 99
  }
  main.sort((a, b) => rank(a) - rank(b))
  side.sort((a, b) => rank(a) - rank(b))

  return { main, side, heights: h, balance: { main: hMain, side: hSide } }
}

export function buildResumeHTML(data, options = {}) {
  const d = data || {}
  const order = options.sectionOrder || ['summary', 'exp', 'proj', 'edu', 'certs', 'skills']

  const head =
    `<h1>${esc(d.name) || 'Your Name'}</h1>` +
    (isSplitTemplate(options.template)
      ? `${d.title ? `<div class="r-role-line">${esc(d.title)}</div>` : ''}
         <div class="r-contact">${
           joinParts([d.phone, d.email, d.link, d.location].map(esc), '  ·  ')
           || 'phone · email · link · location'
         }</div>`
      : `<div class="r-contact">${
           joinParts([d.title, d.email, d.phone, d.location, d.link].map(esc))
           || 'Job title · email · phone'
         }</div>`)

  const sections = {
    summary: d.summary ? `<section><h2>Summary</h2><div class="r-summary">${esc(d.summary)}</div></section>` : '',
    exp: (d.expList && d.expList.length) ? `<section><h2>Experience</h2>` + d.expList.map(itemHTML).join('') + `</section>` : '',
    proj: (d.projList && d.projList.length) ? `<section><h2>Projects</h2>` + d.projList.map(itemHTML).join('') + `</section>` : '',
    edu: (d.eduList && d.eduList.length) ? `<section><h2>Education</h2>` + d.eduList.map(itemHTML).join('') + `</section>` : '',
    certs: (d.certList && d.certList.length) ? `<section><h2>Certifications</h2><div class="r-skills">${joinParts(d.certList.map(e => joinParts([esc(e.role), esc(e.org), esc(e.when)], ' — ')), '  ·  ')}</div></section>` : '',
    skills: (d.skillList && d.skillList.length) ? `<section><h2>Skills</h2><div class="r-skills">${d.skillList.map(esc).join(' · ')}</div></section>` : '',
  }

  /* ——— Single column (classic / modern / minimal) ——— */
  if (!isSplitTemplate(options.template)) {
    let h = head
    order.forEach(k => { if (sections[k]) h += sections[k] })
    return h
  }

  /* ——— Two column (split) ———
     Which section lands in which column is decided by planSplitLayout,
     so every block below must render correctly at either width. */
  const entryBlock = (title, list, opts = {}) =>
    `<section class="${opts.sectionClass || ''}"><h2>${title}</h2>` +
    list.map(e => `<div class="r-item">
      <div class="r-role">${esc(e.role || e.title)}</div>
      ${e.org ? `<div class="${opts.plainOrg ? 'r-org-plain' : 'r-org'}">${esc(e.org)}</div>` : ''}
      ${(e.when || (opts.showDesc && e.desc))
        ? `<div class="r-when-line">${joinParts([esc(e.when), opts.showDesc ? esc(e.desc) : ''], '  ·  ')}</div>`
        : ''}
      ${(!opts.showDesc && e.desc) ? `<div class="r-desc">${bullets(e.desc)}</div>` : ''}
    </div>`).join('') + `</section>`

  const blocks = {
    summary: () => sections.summary,
    exp:     () => `<section><h2>Experience</h2>${d.expList.map(itemHTML).join('')}</section>`,
    proj:    () => `<section><h2>Projects</h2>${d.projList.map(itemHTML).join('')}</section>`,
    edu:     () => entryBlock('Education', d.eduList, { showDesc: true }),
    /* Certificate names read as a list, not as headings — regular weight by
       default, with an opt-in for people who want them to stand out. */
    certs:   () => entryBlock('Certifications', d.certList, { sectionClass: 'r-certs' }),
    courses: () => entryBlock('Training / Courses', d.courseList, { plainOrg: true }),
    skills:  () => `<section><h2>Skills</h2><div class="r-chips">${
      d.skillList.map(s => `<span class="r-chip">${esc(s)}</span>`).join('')}</div></section>`,
    ach:     () => `<section><h2>Key Achievements</h2>${d.achList.map(a => `<div class="r-ach">
      <div class="r-ach-title">${esc(a.title)}</div>
      ${a.desc ? `<div class="r-ach-desc">${esc(a.desc)}</div>` : ''}
    </div>`).join('')}</section>`,
    langs:   () => `<section><h2>Languages</h2>${langBarsHTML(d.langList)}</section>`,
    time:    () => `<section><h2>My Time</h2>${timeHTML(d.timeList)}</section>`,
  }

  const plan = options.plan || planSplitLayout(d, order, options.columnPins)
  const render = keys => keys.map(k => (blocks[k] ? blocks[k]() : '')).join('')
  const sideHTML = render(plan.side)

  /* Nothing to put beside the main column — fall back to full width
     rather than leaving a conspicuous empty gutter. */
  if (!sideHTML.trim()) {
    return head + `<div class="r-solo">${render(plan.main)}</div>`
  }

  return `${head}<div class="r-split">
    <div class="r-main">${render(plan.main)}</div>
    <div class="r-side">${sideHTML}</div>
  </div>`
}
