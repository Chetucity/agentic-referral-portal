/* Cover letter generator — pure functions, no DOM, no React.
   buildCoverLetter(form, opts) → { greeting, paragraphs[], closing, signature }
   coverLetterText(letter) → plain string (used by exports)

   The letter is assembled from resume data the user already entered, so
   there is nothing extra to fill in beyond company and role. */

import { getStructuredData } from './resumeData.js'

const STOPWORDS = new Set('a an the and or for with of to in on at is are we you our your their this that will be as by from have has can what who how'.split(' '))

/* Generic recruiting boilerplate — never interesting enough to name in a letter. */
const JD_NOISE = new Set([
  'need','needs','needed','looking','seeking','strong','excellent','good','great','solid',
  'must','should','would','required','require','requires','preferred','plus','bonus',
  'experience','experienced','years','year','skills','skill','ability','able','work','working',
  'role','position','job','candidate','candidates','applicant','team','teams','company',
  'responsibilities','requirements','qualifications','duties','opportunity','join','help',
  'engineer','engineers','developer','developers','manager','analyst','designer','intern',
  'senior','junior','lead','staff','principal','level','entry','mid','full','time','remote',
  'about','also','well','make','makes','build','builds','building','using','use','used',
  'you','your','their','our','they','them','who','what','when','where','why','how','with',
])

/* Terms the JD emphasises that are worth naming — prefers things the
   candidate actually lists as skills, so the letter never over-claims. */
function jdKeywords(jd, skillList = [], limit = 4) {
  if (!jd || jd.trim().length < 30) return []
  const freq = {}
  jd.toLowerCase().replace(/[^a-z0-9+#. ]/g, ' ').split(/\s+/).forEach(w => {
    const t = w.replace(/[.]+$/, '')
    if (t.length > 3 && !STOPWORDS.has(t) && !JD_NOISE.has(t)) freq[t] = (freq[t] || 0) + 1
  })

  /* Skills the candidate has AND the JD mentions — the strongest overlap. */
  const owned = skillList
    .map(s => s.toLowerCase().trim())
    .filter(s => s && jd.toLowerCase().includes(s))
  if (owned.length) {
    /* Preserve the original casing the user typed (React, not react) */
    const cased = skillList.filter(s => owned.includes(s.toLowerCase().trim()))
    return cased.slice(0, limit)
  }

  /* No overlap — fall back to the most-repeated substantive terms. */
  return Object.entries(freq)
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(e => e[0])
}

/* Strongest bullet = the one with a number in it (quantified impact wins). */
function bestAchievement(expList) {
  const bullets = (expList || []).flatMap(e =>
    (e.desc || '').split(';').map(s => s.trim()).filter(Boolean)
  )
  if (!bullets.length) return ''
  const quantified = bullets.filter(b => /\d/.test(b))
  const pick = (quantified.length ? quantified : bullets)
    .sort((a, b) => b.length - a.length)[0] || ''
  return pick.replace(/[.]+$/, '')
}

function joinList(items) {
  const a = items.filter(Boolean)
  if (a.length === 0) return ''
  if (a.length === 1) return a[0]
  if (a.length === 2) return `${a[0]} and ${a[1]}`
  return `${a.slice(0, -1).join(', ')}, and ${a[a.length - 1]}`
}

export function buildCoverLetter(form, opts = {}) {
  const d = getStructuredData(form || {})
  const company = (opts.company || '').trim()
  const role    = (opts.role || '').trim()
  const manager = (opts.manager || '').trim()
  const jd      = opts.jd || ''
  const tone    = opts.tone || 'professional'

  const companyName = company || 'your organisation'
  const namedRole   = role || d.title || ''            // '' when we know nothing
  const topSkills   = joinList((d.skillList || []).slice(0, 4))
  const achievement = bestAchievement(d.expList)
  const latest      = (d.expList || [])[0] || {}
  const keywords    = joinList(jdKeywords(jd, d.skillList || [], 4))

  const greeting = manager
    ? `Dear ${manager},`
    : company
      ? `Dear ${company} Hiring Team,`
      : 'Dear Hiring Manager,'

  /* ——— Opening ———
     Phrasing branches on whether we actually know the role, so an empty
     form never produces "the this role position". */
  const rolePhrase = namedRole ? `the ${namedRole} position` : 'this opportunity'
  const openPhrase = namedRole ? `the ${namedRole} opening` : 'this opening'
  const opener = tone === 'warm'
    ? `I was glad to come across ${openPhrase} at ${companyName}.`
    : tone === 'direct'
      ? `I am applying for ${rolePhrase} at ${companyName}.`
      : `I am writing to express my interest in ${rolePhrase} at ${companyName}.`

  const openerCtx = latest.role && latest.org
    ? ` As ${/^[aeiou]/i.test(latest.role) ? 'an' : 'a'} ${latest.role} at ${latest.org}, I have built the kind of experience this role calls for.`
    : d.title
      ? ` My background as ${/^[aeiou]/i.test(d.title) ? 'an' : 'a'} ${d.title} maps closely to what you are looking for.`
      : ''

  const p1 = opener + openerCtx

  /* ——— Body: proof ——— */
  let p2 = ''
  if (achievement) {
    p2 = `In my most recent role, I ${achievement.charAt(0).toLowerCase() + achievement.slice(1)}.`
    if (topSkills) p2 += ` Day to day, I work across ${topSkills}, and I am comfortable owning problems end to end.`
  } else if (topSkills) {
    p2 = `My core strengths are ${topSkills}. I focus on shipping work that holds up in production and on leaving things clearer than I found them.`
  } else if (d.summary) {
    p2 = d.summary
  }

  /* ——— Body: fit ——— */
  let p3 = ''
  if (keywords) {
    p3 = `What draws me to this position specifically is the emphasis on ${keywords}. That is the work I want to be doing, and it lines up with where I have spent my time so far.`
  } else if (company) {
    p3 = `I have been following ${companyName} and I like the direction the team is heading. I would welcome the chance to contribute to that work rather than watch it from the outside.`
  } else {
    p3 = `I would welcome the chance to bring this experience to your team and to grow alongside people who care about the craft.`
  }

  /* ——— Close ——— */
  const contactBits = [d.email, d.phone].filter(Boolean).join(' or ')
  const p4 = contactBits
    ? `My resume is attached with more detail. I would be glad to talk through how I could help — you can reach me at ${contactBits}. Thank you for your time and consideration.`
    : `My resume is attached with more detail. I would be glad to talk through how I could help. Thank you for your time and consideration.`

  return {
    greeting,
    paragraphs: [p1, p2, p3, p4].filter(Boolean),
    closing: 'Sincerely,',
    signature: d.name || 'Your Name',
    meta: {
      name: d.name || '',
      title: d.title || '',
      email: d.email || '',
      phone: d.phone || '',
      location: d.location || '',
      link: d.link || '',
      company,
      role,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    },
  }
}

/* Flatten to plain text — used by the .doc export and the copy button. */
export function coverLetterText(letter) {
  if (!letter) return ''
  const m = letter.meta || {}
  const header = [m.name, [m.title, m.location].filter(Boolean).join(' · '), [m.email, m.phone, m.link].filter(Boolean).join(' · ')]
    .filter(Boolean).join('\n')
  return [
    header,
    m.date,
    m.company ? `${m.company}${m.role ? `\nRe: ${m.role}` : ''}` : '',
    letter.greeting,
    ...letter.paragraphs,
    letter.closing,
    letter.signature,
  ].filter(Boolean).join('\n\n')
}
