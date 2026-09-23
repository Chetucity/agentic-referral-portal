/* Rule-based grammar, spelling, and phrasing checker.
   All pure functions — no DOM, no React.
   checkLine(text) → { issues[], fixed }
   checkAllWriting(form) → flaggedLine[]
   autoFixAllWriting(form) → { ...form, ...correctedFields } */

const MISSPELLINGS = {
  recieve:'receive',recieved:'received',acheive:'achieve',acheived:'achieved',achivement:'achievement',
  acheivement:'achievement',achievment:'achievement',seperate:'separate',seperated:'separated',
  definately:'definitely',occured:'occurred',occuring:'occurring',sucessful:'successful',
  succesful:'successful',sucessfully:'successfully',succesfully:'successfully',responsable:'responsible',
  responsibilty:'responsibility',responsibilites:'responsibilities',managment:'management',
  developement:'development',enviroment:'environment',enviornment:'environment',experiance:'experience',
  experianced:'experienced',knowlege:'knowledge',knowledgable:'knowledgeable',profesional:'professional',
  proffesional:'professional',comunication:'communication',communciation:'communication',
  colaboration:'collaboration',collabration:'collaboration',independant:'independent',
  maintainance:'maintenance',maintenence:'maintenance',performace:'performance',perfomance:'performance',
  effeciency:'efficiency',efficency:'efficiency',optimisation:'optimization',analize:'analyze',
  anaylsis:'analysis',analysys:'analysis',buisness:'business',bussiness:'business',begining:'beginning',
  beleive:'believe',calender:'calendar',carrer:'career',carreer:'career',challange:'challenge',
  commited:'committed',commitee:'committee',compitition:'competition',concious:'conscious',
  dependant:'dependent',discription:'description',excelent:'excellent',excellant:'excellent',
  existance:'existence',familliar:'familiar',flexable:'flexible',goverment:'government',
  grammer:'grammar',garantee:'guarantee',immediatly:'immediately',implementaion:'implementation',
  improvment:'improvement',intergrate:'integrate',intrest:'interest',lenght:'length',
  liason:'liaison',maintaing:'maintaining',neccessary:'necessary',necesary:'necessary',
  noticable:'noticeable',oppurtunity:'opportunity',opportunuty:'opportunity',particulary:'particularly',
  persue:'pursue',posible:'possible',preformed:'performed',priviledge:'privilege',
  proceedure:'procedure',productivty:'productivity',reccomend:'recommend',recomend:'recommend',
  recommand:'recommend',refered:'referred',relevent:'relevant',requirment:'requirement',
  requirments:'requirements',reserch:'research',scheduel:'schedule',strenght:'strength',
  strengh:'strength',sucess:'success',supervisior:'supervisor',techinical:'technical',
  technicial:'technical',tecnology:'technology',thier:'their',throught:'throughout',truely:'truly',
  untill:'until',usefull:'useful',varius:'various',visiblity:'visibility',wich:'which',
  writting:'writing',teh:'the',adn:'and',taht:'that',wtih:'with',nad:'and',hte:'the',
  javascrip:'JavaScript',javasript:'JavaScript',pyhton:'Python',phyton:'Python',
}

const PROPER_NOUNS = {
  javascript:'JavaScript',typescript:'TypeScript',html:'HTML',css:'CSS',sql:'SQL',api:'API',
  apis:'APIs',rest:'REST',json:'JSON',aws:'AWS',gcp:'GCP',sdk:'SDK',ui:'UI',ux:'UX',
  python:'Python',java:'Java',react:'React',angular:'Angular',vue:'Vue','node.js':'Node.js',
  github:'GitHub',gitlab:'GitLab',git:'Git',docker:'Docker',kubernetes:'Kubernetes',linux:'Linux',
  mongodb:'MongoDB',mysql:'MySQL',postgresql:'PostgreSQL',firebase:'Firebase',android:'Android',
  ios:'iOS',figma:'Figma',excel:'Excel',powerpoint:'PowerPoint',tableau:'Tableau',jira:'Jira',
  agile:'Agile',scrum:'Scrum',saas:'SaaS','ci/cd':'CI/CD',devops:'DevOps',ml:'ML',ai:'AI',
  graphql:'GraphQL',redux:'Redux',nextjs:'Next.js',vercel:'Vercel',netlify:'Netlify',
  tailwind:'Tailwind',webpack:'Webpack',eslint:'ESLint',jest:'Jest',pytest:'pytest',
  fastapi:'FastAPI',django:'Django',flask:'Flask',spring:'Spring',dotnet:'.NET',
}

const WEAK_PHRASES = [
  [/\bworked on\b/gi, 'built / developed / delivered'],
  [/\bresponsible for\b/gi, 'led / owned / managed'],
  [/\bhelped (with|in)?\b/gi, 'supported / contributed to / drove'],
  [/\bwas involved in\b/gi, 'contributed to / drove'],
  [/\bassisted (with|in)?\b/gi, 'supported / partnered on'],
  [/\bin charge of\b/gi, 'led / owned'],
  [/\bduties included\b/gi, 'delivered / led'],
  [/\btasked with\b/gi, 'led / delivered'],
  [/\bvarious\b/gi, 'a specific number or list'],
  [/\bstuff\b/gi, 'a specific noun'],
  [/\bthings\b/gi, 'a specific noun'],
  [/\bgood\b/gi, 'a stronger, specific adjective'],
  [/\ba lot of\b/gi, 'a specific number'],
]

const FILLER = /\b(really|very|basically|actually|just|quite|simply|somewhat|kind of|sort of)\b/gi

const SOUNDS_CONSONANT = /^(uni|use|user|usu|util|euro|europ|eula|ubiqu|one|once|ukrain)/i
const SOUNDS_VOWEL = /^(hour|honest|honou?r|heir|mba|ms\b|mca|hr\b|sql|xml|http|api|ai\b|ml\b)/i

export function checkLine(rawText) {
  const issues = []
  const text = String(rawText || '')
  if (!text.trim()) return { issues, fixed: text }
  let fixed = text

  const add = (sev, msg) => issues.push({ sev, msg })

  /* Spelling */
  const misspelled = []
  fixed = fixed.replace(/\b[A-Za-z][A-Za-z']*\b/g, w => {
    const lower = w.toLowerCase()
    if (MISSPELLINGS[lower]) {
      const corrected = MISSPELLINGS[lower]
      misspelled.push(`${w} → ${corrected}`)
      return w[0] === w[0].toUpperCase()
        ? corrected[0].toUpperCase() + corrected.slice(1)
        : corrected
    }
    return w
  })
  if (misspelled.length) add('high', `Spelling: ${misspelled.join(', ')}`)

  /* Proper noun capitalisation */
  const miscased = []
  fixed = fixed.replace(/\b[A-Za-z][A-Za-z.#+]*\b/g, w => {
    const proper = PROPER_NOUNS[w.toLowerCase()]
    if (proper && w !== proper) { miscased.push(`${w} → ${proper}`); return proper }
    return w
  })
  if (miscased.length) add('low', `Capitalisation: ${miscased.join(', ')}`)

  /* Repeated words */
  if (/\b(\w+)\s+\1\b/i.test(fixed)) {
    const dup = fixed.match(/\b(\w+)\s+\1\b/i)
    add('high', `Repeated word: "${dup[0]}"`)
    fixed = fixed.replace(/\b(\w+)(\s+)\1\b/gi, '$1')
  }

  /* a / an — by pronunciation, not spelling */
  const anErrors = []
  fixed = fixed.replace(/\ba\s+([A-Za-z0-9][\w.#+]*)/g, (m, w) => {
    const needsAn = (/^[aeiou]/i.test(w) && !SOUNDS_CONSONANT.test(w)) || SOUNDS_VOWEL.test(w)
    if (!needsAn) return m
    anErrors.push(`a ${w} → an ${w}`)
    return (m[0] === 'A' ? 'An ' : 'an ') + w
  })
  fixed = fixed.replace(/\ban\s+([A-Za-z0-9][\w.#+]*)/g, (m, w) => {
    const needsAn = (/^[aeiou]/i.test(w) && !SOUNDS_CONSONANT.test(w)) || SOUNDS_VOWEL.test(w)
    if (needsAn) return m
    anErrors.push(`an ${w} → a ${w}`)
    return (m[0] === 'A' ? 'A ' : 'a ') + w
  })
  if (anErrors.length) add('med', `Article: ${anErrors.join(', ')}`)

  /* Space before punctuation — commas never, periods only at end-of-sentence */
  const beforeFix = fixed
    .replace(/\s+([,;:!?])/g, '$1')
    .replace(/\s+(\.)(?=\s|$)/g, '$1')
  if (beforeFix !== fixed) { add('low', 'Space before punctuation'); fixed = beforeFix }

  /* Multiple spaces */
  if (/ {2,}/.test(fixed)) { add('low', 'Multiple spaces in a row'); fixed = fixed.replace(/ {2,}/g, ' ') }

  /* Missing space after punctuation — with carve-outs for abbreviations and tech names */
  const spaceFix = fixed.replace(/([,;:.])(?=[A-Za-z])/g, (m, p, off, str) => {
    const before = str.slice(Math.max(0, off - 4), off)
    const after = str.slice(off + 1, off + 7)
    if (p === '.') {
      if (/(^|[^A-Za-z])[A-Za-z]$/.test(before)) return m          // B.Tech, U.S.A
      if (/^(js|net|ts|py|io|com|org|co|sh|md|dev|ai)\b/i.test(after)) return m // Node.js .NET
      if (/^[A-Z](?![a-z])/.test(after)) return m                   // Ph.D, SQL.Server
    }
    if ((p === ':' || p === ',') && /\d$/.test(before) && /^\d/.test(after)) return m
    return p + ' '
  })
  if (spaceFix !== fixed) { add('low', 'Missing space after punctuation'); fixed = spaceFix }

  /* Duplicate punctuation */
  if (/[.,]{2,}/.test(fixed)) {
    add('low', 'Duplicate punctuation')
    fixed = fixed.replace(/\.{2,}/g, '.').replace(/,{2,}/g, ',')
  }

  /* Sentence starts with lowercase */
  if (/^[a-z]/.test(fixed.trim())) {
    add('med', 'Line should start with a capital letter')
    fixed = fixed.trim().replace(/^[a-z]/, c => c.toUpperCase())
  }
  /* Mid-sentence capitalisation after period */
  fixed = fixed.replace(/([.!?]\s+)([a-z])/g, (m, p, c) => p + c.toUpperCase())

  /* Standalone lowercase "i" */
  if (/\bi\b/.test(fixed)) {
    add('high', 'Lowercase "i" should be capitalised')
    fixed = fixed.replace(/\bi\b/g, 'I')
  }

  /* Trailing comma or semicolon */
  if (/[,;]$/.test(fixed.trim())) {
    add('low', 'Line ends with a comma or semicolon')
    fixed = fixed.trim().replace(/[,;]$/, '')
  }

  /* ALL CAPS (that aren't known acronyms) */
  const caps = fixed.match(/\b[A-Z]{4,}\b/g)
  if (caps) {
    const real = caps.filter(w =>
      !PROPER_NOUNS[w.toLowerCase()] &&
      !/^(HTML|JSON|REST|SAAS|SDLC|CGPA|GPA|MBA|IEEE|BTECH|MTECH|HTTP|HTTPS|REST|CRUD|AJAX|MEAN|MERN|LAMP|SOAP)$/.test(w)
    )
    if (real.length) add('low', `Avoid ALL CAPS: ${real.join(', ')}`)
  }

  /* Filler words */
  const fill = fixed.match(FILLER)
  if (fill) add('med', `Remove filler words: ${[...new Set(fill.map(f => f.toLowerCase()))].join(', ')}`)

  /* Weak phrasing */
  for (const [re, better] of WEAK_PHRASES) {
    re.lastIndex = 0
    const m = re.exec(fixed)
    if (m) { add('med', `Weak wording "${m[0]}" — use ${better}`); break }
  }

  /* First-person pronouns */
  if (/\b(I am|I've|I have|I was|I built|I led|I managed|me|my|we|our)\b/.test(fixed)) {
    add('med', 'Drop first-person pronouns — resumes use implied subject ("Built X", not "I built X")')
  }

  /* Overlong sentence */
  const wordCount = fixed.split(/\s+/).filter(Boolean).length
  if (wordCount > 34) add('med', `Line is ${wordCount} words — split it or trim to under 30`)

  /* Gerund opener on bullet */
  const firstWord = fixed.trim().split(/\s+/)[0] || ''
  if (
    wordCount >= 4 &&
    /ing$/i.test(firstWord) &&
    !/^(engineering|marketing|accounting|consulting|training|programming|computing|networking|reporting)$/i.test(firstWord)
  ) {
    add('low', `Start with a past-tense verb ("Built") rather than "${firstWord}"`)
  }

  return { issues, fixed: fixed.trim() }
}

export const CHECK_FIELDS = [
  { key: 'summary', label: 'Summary' },
  { key: 'exp',     label: 'Experience' },
  { key: 'edu',     label: 'Education' },
  { key: 'proj',    label: 'Projects' },
  { key: 'certs',   label: 'Certifications' },
]

/* Runs checkLine on each segment of each pipe-delimited line, across all checked fields. */
export function checkAllWriting(form) {
  const results = []
  CHECK_FIELDS.forEach(f => {
    const val = (form || {})[f.key] || ''
    if (!val.trim()) return
    val.split('\n').forEach((line, idx) => {
      if (!line.trim()) return
      const segs = line.split('|')
      const segResults = segs.map(s => checkLine(s))
      const issues = segResults.flatMap((r, si) => r.issues.map(i => ({ ...i, seg: si })))
      if (!issues.length) return
      const lead = s => s.match(/^\s*/)[0]
      const trail = s => s.match(/\s*$/)[0]
      const fixedLine = segResults.map((r, si) =>
        lead(segs[si]).slice(0, 1) + r.fixed + trail(segs[si]).slice(0, 1)
      ).join('|')
      results.push({ field: f.key, fieldLabel: f.label, lineIndex: idx, original: line, fixed: fixedLine, issues })
    })
  })
  return results
}

/* ——— Rewriting pass ———
   checkLine only *flags* weak wording. These functions actually rewrite it:
   weak openers become action verbs, gerunds become past tense, filler and
   first-person pronouns are dropped, and bullets get consistent punctuation. */

const IRREGULAR_PAST = {
  building:'built', leading:'led', making:'made', writing:'wrote', running:'ran',
  driving:'drove', taking:'took', giving:'gave', holding:'held', keeping:'kept',
  teaching:'taught', bringing:'brought', buying:'bought', finding:'found',
  growing:'grew', meeting:'met', overseeing:'oversaw', rebuilding:'rebuilt',
  selling:'sold', sending:'sent', setting:'set', spending:'spent', speaking:'spoke',
  winning:'won', cutting:'cut', beginning:'began', choosing:'chose', dealing:'dealt',
  drawing:'drew', getting:'got', becoming:'became', seeing:'saw', doing:'did',
}

function toPastTense(gerund) {
  const lower = String(gerund || '').toLowerCase()
  if (IRREGULAR_PAST[lower]) return IRREGULAR_PAST[lower]
  const stem = lower.replace(/ing$/, '')
  if (!stem) return lower
  if (/[^aeiou]y$/.test(stem)) return stem.slice(0, -1) + 'ied'
  if (/e$/.test(stem)) return stem + 'd'
  return stem + 'ed'
}

const cap = s => String(s || '').replace(/^[a-z]/, c => c.toUpperCase())

/* Gerunds that are really nouns — don't convert these to past tense */
const NOUN_ING = /^(engineering|marketing|accounting|consulting|training|programming|computing|networking|reporting|banking|manufacturing|onboarding|forecasting|staffing|purchasing)$/i

/* A weak opener, optionally preceded by "was" — captured so we can look for a gerund after it */
const WEAK_OPENER = '(?:was\\s+)?(?:responsible\\s+for|worked\\s+on|helped\\s+(?:with|in|to)?|assisted\\s+(?:with|in)?|(?:was\\s+)?involved\\s+in|in\\s+charge\\s+of|duties\\s+included|tasked\\s+with)'

const WEAK_OPENERS = [
  [/^was\s+responsible\s+for\s+/i, 'Led '],
  [/^responsible\s+for\s+/i,       'Led '],
  [/^worked\s+on\s+/i,             'Built '],
  [/^helped\s+(?:with|in|to)\s+/i, 'Supported '],
  [/^helped\s+/i,                  'Supported '],
  [/^assisted\s+(?:with|in)\s+/i,  'Supported '],
  [/^assisted\s+/i,                'Supported '],
  [/^was\s+involved\s+in\s+/i,     'Contributed to '],
  [/^involved\s+in\s+/i,           'Contributed to '],
  [/^in\s+charge\s+of\s+/i,        'Led '],
  [/^duties\s+included\s+/i,       'Delivered '],
  [/^tasked\s+with\s+/i,           'Led '],
]

const WEAK_MID = [
  [/\bwas\s+responsible\s+for\b/gi, 'led'],
  [/\bresponsible\s+for\b/gi,       'led'],
  [/\bworked\s+on\b/gi,             'built'],
  [/\bwas\s+involved\s+in\b/gi,     'contributed to'],
  [/\bin\s+charge\s+of\b/gi,        'led'],
  [/\bhelped\s+with\b/gi,           'supported'],
  [/\bassisted\s+with\b/gi,         'supported'],
  [/\bduties\s+included\b/gi,       'delivered'],
]

/* Rewrites one bullet into stronger, resume-standard phrasing. */
export function strengthenLine(raw) {
  let s = String(raw || '').trim()
  if (!s) return { text: s, changes: [] }
  const changes = []
  const mark = c => { if (!changes.includes(c)) changes.push(c) }

  /* Drop a leading first-person subject: "I built X" → "Built X" */
  const noFp = s.replace(/^(?:I|We)\s+(?:also\s+)?/i, '')
  if (noFp !== s) { s = noFp; mark('first-person removed') }

  /* Weak opener directly followed by a gerund collapses into one strong verb:
     "Responsible for managing a team" → "Managed a team" */
  const gm = s.match(new RegExp(`^${WEAK_OPENER}\\s*([A-Za-z]+ing)\\b\\s*`, 'i'))
  if (gm && !NOUN_ING.test(gm[1])) {
    s = cap(toPastTense(gm[1])) + ' ' + s.slice(gm[0].length)
    mark('stronger verb')
  } else {
    for (const [re, rep] of WEAK_OPENERS) {
      if (re.test(s)) { s = s.replace(re, rep); mark('stronger verb'); break }
    }
  }

  for (const [re, rep] of WEAK_MID) {
    const before = s
    s = s.replace(re, rep)
    if (s !== before) mark('stronger verb')
  }

  const noFill = s.replace(FILLER, ' ').replace(/\s{2,}/g, ' ').trim()
  if (noFill !== s) { s = noFill; mark('filler removed') }

  /* Bullet opening on a gerund → past tense: "Managing X" → "Managed X" */
  const go = s.match(/^([A-Za-z]+ing)\b/)
  if (go && !NOUN_ING.test(go[1])) {
    s = cap(toPastTense(go[1])) + s.slice(go[1].length)
    mark('past-tense verb')
  }

  s = s.replace(/\s+([,.;:])/g, '$1').replace(/\s{2,}/g, ' ').trim()
  s = cap(s)
  return { text: s, changes }
}

/* Full improvement pass: spelling/grammar fixes, then rewriting and realignment.
   Returns a new form object — the "After" side of the comparison. */
export function enhanceResume(form) {
  const out = autoFixAllWriting(form)

  /* Experience and Projects: rewrite the description bullets only, never the
     role/company/date segments. */
  ;['exp', 'proj'].forEach(key => {
    const val = out[key] || ''
    if (!val.trim()) return
    out[key] = val.split('\n').map(line => {
      if (!line.trim()) return line
      const segs = line.split('|')
      if (segs.length < 4) return line          // heading-only line, leave it
      const head = segs.slice(0, 3).map(s => s.trim())
      const bullets = segs.slice(3).join('|')
        .split(';').map(b => b.trim()).filter(Boolean)
        .map(b => {
          let t = strengthenLine(b).text
          if (t && !/[.!?]$/.test(t)) t += '.'   // consistent terminal punctuation
          return t
        })
        .filter(Boolean)
      return [...head, bullets.join('; ')].join(' | ')
    }).join('\n')
  })

  /* Summary: prose, so strip filler and first person but keep the sentences. */
  if (out.summary && out.summary.trim()) {
    let s = out.summary
      .replace(/^(?:I\s+am|I'm)\s+(?:an?\s+)?/i, '')
      .replace(FILLER, ' ')
      .replace(/\s+([,.;:])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim()
    s = cap(s)
    if (s && !/[.!?]$/.test(s)) s += '.'
    out.summary = s
  }

  return out
}

/* Applies all auto-fixable corrections and returns a new form object. */
export function autoFixAllWriting(form) {
  const out = { ...form }
  CHECK_FIELDS.forEach(f => {
    const val = (form || {})[f.key] || ''
    if (!val.trim()) return
    out[f.key] = val.split('\n').map(line => {
      if (!line.trim()) return line
      const segs = line.split('|')
      return segs.map(s => {
        if (!s.trim()) return s
        const r = checkLine(s)
        const lead = /^\s/.test(s) ? ' ' : ''
        const trail = /\s$/.test(s) ? ' ' : ''
        return lead + r.fixed + trail
      }).join('|')
    }).join('\n')
  })
  return out
}
