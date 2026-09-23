/* Rule-based ATS score /100. Pure function — no DOM, no React.
   scoreResume(structuredData, jobDescription) → { score, potential, issues[] }
   Weights: contact 17, summary 9, sections 17, skills 7, bullets 20, length 5, writing 11, keywords 14 = 100 */

import { checkAllWriting } from './checker.js'
import { parseLines, isSplitTemplate } from './resumeData.js'

/* Real ATS parsers read a PDF's text stream in document order. A two-column
   layout interleaves the columns in that stream, so sidebar content can land
   mid-sentence inside an experience bullet. The penalty reflects measurable
   parsing risk, not a style opinion. */
const SPLIT_LAYOUT_PENALTY = 6

const WEAK_VERBS = [/\bworked on\b/i, /\bhelped( with)?\b/i, /\bresponsible for\b/i, /\bwas involved\b/i, /\bassisted\b/i]
const ACTION_VERBS = /\b(built|led|created|developed|designed|launched|improved|increased|reduced|delivered|implemented|automated|optimized|managed|shipped|achieved|drove|architected|founded|scaled|negotiated|mentored|resolved|deployed|integrated|migrated)\b/i
const STOPWORDS = new Set('a an the and or for with of to in on at is are we you our your their this that will be as by from have has can'.split(' '))

export function scoreResume(data, jd, options = {}) {
  const d = data || {}
  const issues = []
  let score = 0
  const add = (pts, ok, issue) => { if (ok) score += pts; else if (issue) issues.push({ ...issue, pts }); return ok }

  add(6,  !!d.email,          { sev:'high', t:'No email found',              d:'Add an email address — required by ATS and recruiters.', fix:null })
  add(3,  !!d.phone,          { sev:'med',  t:'No phone number',              d:'Add a phone number to your contact info.', fix:null })
  add(4,  !!d.name,           { sev:'high', t:'Name not detected',            d:'Put your full name on the first line.', fix:null })
  add(2,  !!d.link,           { sev:'low',  t:'No LinkedIn / portfolio link', d:'A LinkedIn or GitHub link builds credibility.', fix:null })
  add(8,  !!d.summary && (d.summary.split(/\s+/).length >= 15),
                              { sev:'med',  t:'Missing or thin summary',       d:'Write a 2–3 line summary with your title and top skills.', fix:'summary' })
  add(10, (d.expList || []).length > 0,
                              { sev:'high', t:'No experience section detected', d:'Add an Experience section with role, company, and dates.', fix:null })
  add(5,  (d.projList || []).length > 0,
                              { sev:'med',  t:'No projects section',           d:'Highlight key projects with tech stack and measurable outcomes.', fix:null })
  add(4,  (d.certList || []).length > 0,
                              { sev:'low',  t:'No certifications listed',      d:'Add professional certifications or credentials.', fix:null })
  add(4,  (d.eduList || []).length > 0,
                              { sev:'med',  t:'No education section',          d:'Add education with a standard "Education" heading.', fix:null })
  add(6,  (d.skillList || []).length >= 5,
                              { sev:'med',  t:'Fewer than 5 skills listed',    d:'List 5–12 skills — ATS keyword-matches this section.', fix:null })

  const expBullets = (d.expList || []).flatMap(e => (e.desc || '').split(';'))
  const projBullets = (d.projList || []).flatMap(e => (e.desc || '').split(';'))
  const allBullets = [...expBullets, ...projBullets].map(s => s.trim()).filter(Boolean)
  const withNumbers = allBullets.filter(b => /\d/.test(b))

  add(10, allBullets.length > 0 && withNumbers.length / Math.max(allBullets.length, 1) >= 0.3,
    { sev:'med', t:'Bullets lack numbers', d:'Quantify impact — "Built 5 dashboards used by 200+ users" beats "Built dashboards".', fix:null })

  const weak = allBullets.filter(b => WEAK_VERBS.some(r => r.test(b)))
  add(5, allBullets.length > 0 && weak.length === 0,
    { sev:'med', t:'Weak bullet wording', d: weak.length ? `Replace "${weak[0].slice(0, 60)}" with action verbs: built, led, launched…` : 'Start bullets with action verbs.', fix:'verbs' })
  add(4, allBullets.some(b => ACTION_VERBS.test(b)),
    { sev:'low', t:'No strong action verbs', d:'Start bullets with: built, developed, launched, optimized, led…', fix:null })

  const words = [d.summary, d.exp, d.edu, d.proj, d.certs, d.skills].join(' ').split(/\s+/).filter(Boolean).length
  add(4, words >= 150 && words <= 1200,
    { sev:'low', t: words < 150 ? 'Resume too short' : 'Resume is very long', d: words < 150 ? 'Aim for 250–600 words.' : 'Keep it under ~2 pages.', fix:null })

  /* Writing quality (11 pts) */
  const wr = checkAllWriting(d)
  const wc = { high:0, med:0, low:0 }
  wr.forEach(r => r.issues.forEach(i => wc[i.sev]++))
  const wrPenalty = Math.min(11, wc.high * 3 + wc.med * 1.5 + wc.low * 0.5)
  score += Math.round(11 - wrPenalty)
  if (wrPenalty > 0) {
    const bits = []
    if (wc.high) bits.push(`${wc.high} spelling/grammar error${wc.high > 1 ? 's' : ''}`)
    if (wc.med)  bits.push(`${wc.med} phrasing issue${wc.med > 1 ? 's' : ''}`)
    if (wc.low)  bits.push(`${wc.low} minor formatting issue${wc.low > 1 ? 's' : ''}`)
    issues.push({
      sev: wc.high ? 'high' : 'med', pts: Math.round(wrPenalty),
      t: `Writing issues (${bits.join(', ')})`,
      d: wr.length ? `First: "${wr[0].original.slice(0, 70)}" — ${wr[0].issues[0].msg}` : '',
      fix: 'writing',
    })
  }

  /* Keyword matching (14 pts) */
  if (jd && jd.trim().length > 30) {
    const kws = topKeywords(jd)
    const hay = [d.skills, d.exp, d.summary, d.proj, d.certs, d.title].join(' ').toLowerCase()
    const missing = kws.filter(k => !hay.includes(k))
    const matched = kws.length - missing.length
    score += Math.round(14 * matched / Math.max(kws.length, 1))
    if (missing.length) {
      issues.push({ sev:'high', pts: Math.round(14 * missing.length / kws.length),
        t:'Missing keywords from job description',
        d:'Add if true for you: ' + missing.slice(0, 8).join(', '),
        fix:'keywords', kw: missing.slice(0, 8) })
    }
  } else {
    score += Math.round(14 * 0.65)
    issues.push({ sev:'low', pts:0, t:'No job description provided',
      d:'Paste a job description above to unlock keyword matching (worth up to 14 points).', fix:null })
  }

  /* Two-column layout penalty — applied last so it reads as a deduction
     from an otherwise-earned score. */
  if (isSplitTemplate(options.template)) {
    score -= SPLIT_LAYOUT_PENALTY
    issues.push({
      sev: 'med', pts: SPLIT_LAYOUT_PENALTY,
      t: 'Two-column layout carries parsing risk',
      d: `Many ATS read a PDF top-to-bottom and interleave the two columns, which can scramble your bullets. Great for humans and direct applications — switch to Classic or Modern when applying through a job portal.`,
      fix: null,
    })
  }

  score = Math.max(0, Math.min(100, score))
  const potential = Math.min(100, score + issues.filter(i => i.fix || i.sev !== 'low').reduce((s, i) => s + (i.pts || 0), 0))
  return { score, potential, issues }
}

function topKeywords(jd) {
  const freq = {}
  jd.toLowerCase().replace(/[^a-z0-9+#. ]/g, ' ').split(/\s+/).forEach(w => {
    if (w.length > 2 && !STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1
  })
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 14).map(e => e[0])
}
