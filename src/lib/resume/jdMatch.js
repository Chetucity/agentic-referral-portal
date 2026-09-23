/* Job-description matching — pure functions, no DOM, no React, no network.

   Design rule: this module never invents experience. It can
     • report what a posting asks for,
     • say whether your resume already covers it,
     • and re-word claims you have ALREADY made to match the posting's
       vocabulary (same substance, their terminology).
   It will not write a bullet asserting work you did not do. Anything that
   would add a new claim is returned as a suggestion for the user to confirm
   and edit, never applied automatically. */

import { getStructuredData } from './resumeData.js'

/* ── Boilerplate: sections of a posting that say nothing about the job ── */
const BOILERPLATE = [
  /equal\s+opportunity|eeo|affirmative\s+action|without\s+regard\s+to/i,
  /\b(401\s*\(?k\)?|health\s+insurance|dental|vision|pto|paid\s+time\s+off|parental\s+leave|wellness)\b/i,
  /\b(salary|compensation|pay\s+range|base\s+pay|bonus|equity|stock\s+options)\b.*\$?\d/i,
  /\babout\s+(us|the\s+company|our\s+team)\b|our\s+(mission|values|culture)\b/i,
  /\b(apply\s+now|click\s+apply|submit\s+your\s+(resume|application)|we\s+look\s+forward)\b/i,
  /\b(perks|benefits)\b\s*:?\s*$/i,
  /^\s*(job\s+type|schedule|location|work\s+setting|seniority\s+level|employment\s+type|industries?|job\s+function)\s*:/i,
  /\b(diverse|inclusive)\s+(workplace|environment|team)\b/i,
  /^\s*#/,                                   // hashtag spam at the end of LinkedIn posts
]

/* Lines that introduce a list rather than being a requirement themselves */
const IS_HEADING = /^\s*(what\s+you.{0,4}ll\s+(do|need|bring)|responsibilities|requirements|qualifications|must\s+haves?|nice\s+to\s+haves?|preferred|basic\s+qualifications|who\s+you\s+are|the\s+role|your\s+impact|skills?)\s*:?\s*$/i

/* Phrases that mark a genuine requirement */
const REQ_MARKER = /\b(experience|proficien|familiar|knowledge|expertise|skilled|ability|able\s+to|must|should|required|strong|hands[- ]on|working\s+with|background\s+in|understanding\s+of|degree|bachelor|master|years?)\b/i

/* Verb openers that mark a responsibility line */
const RESP_VERB = /^(design|develop|build|create|implement|maintain|manage|lead|own|drive|deliver|collaborate|partner|work|support|optimi[sz]e|automate|monitor|analy[sz]e|architect|scale|migrate|integrate|deploy|test|document|mentor|coordinate|translate|define|establish|improve|ensure|write|produce|perform|conduct|execute|oversee|contribute|participate)\w*\b/i

/* Known technology tokens — used to classify a requirement as a tool. */
const TECH = new Set(`
python java javascript typescript scala golang go rust ruby php c c++ c# swift kotlin r matlab
sql nosql mysql postgresql postgres oracle sqlserver mongodb cassandra redis dynamodb snowflake
redshift bigquery databricks synapse teradata hive hbase elasticsearch neo4j clickhouse duckdb
spark pyspark hadoop kafka flink airflow dagster prefect dbt luigi nifi beam storm
aws azure gcp cloud lambda s3 ec2 emr glue athena kinesis sagemaker iam cloudformation
docker kubernetes k8s terraform ansible jenkins gitlab github circleci argocd helm
react angular vue svelte nextjs node express django flask fastapi spring rails laravel
tableau powerbi looker qlik superset metabase grafana kibana excel
git jira confluence agile scrum kanban devops mlops cicd
tensorflow pytorch sklearn keras pandas numpy scipy huggingface langchain
rest graphql grpc soap microservices serverless etl elt api apis
linux unix bash shell powershell windows macos
`.trim().split(/\s+/))

/* ── Term equivalence ──
   Groups of phrases that mean the same thing. If your resume uses one member
   and the posting uses another, we can swap yours for theirs without
   changing what you claimed. Longest phrases first when matching. */
const EQUIV_GROUPS = [
  ['etl', 'elt', 'extract transform load', 'data pipeline', 'data pipelines', 'pipeline development', 'data ingestion'],
  ['bi reporting', 'business intelligence', 'dashboard', 'dashboards', 'dashboarding', 'data visualization', 'data visualisation', 'reporting'],
  ['data warehouse', 'data warehousing', 'dwh', 'warehouse'],
  ['data modeling', 'data modelling', 'dimensional modeling', 'dimensional modelling', 'schema design'],
  ['data quality', 'data validation', 'data integrity', 'data governance'],
  ['ci/cd', 'cicd', 'continuous integration', 'continuous delivery', 'continuous deployment', 'build pipeline'],
  ['machine learning', 'ml', 'predictive modeling', 'predictive modelling'],
  ['cloud migration', 'cloud modernization', 'lift and shift', 'on-premise migration', 'on-prem migration'],
  ['stakeholder management', 'stakeholder engagement', 'cross-functional collaboration', 'cross functional collaboration'],
  ['performance tuning', 'performance optimization', 'performance optimisation', 'query optimization', 'query optimisation', 'query tuning'],
  ['unit testing', 'automated testing', 'test automation', 'test coverage'],
  ['requirement gathering', 'requirements gathering', 'requirement analysis', 'business requirements'],
  ['orchestration', 'workflow orchestration', 'job scheduling', 'workflow automation'],
  ['rest api', 'restful api', 'rest apis', 'web services', 'api development'],
  ['version control', 'source control', 'git'],
  ['agile', 'scrum', 'sprint'],
]

/* How each term should be written when it appears in a resume. Without this
   an equivalence swap lands lowercase — "built etl" instead of "built ETL". */
const DISPLAY = {
  'etl': 'ETL', 'elt': 'ELT', 'ci/cd': 'CI/CD', 'cicd': 'CI/CD', 'ml': 'ML',
  'bi reporting': 'BI reporting', 'business intelligence': 'business intelligence',
  'dwh': 'data warehouse', 'rest api': 'REST API', 'restful api': 'RESTful API',
  'rest apis': 'REST APIs', 'api development': 'API development',
  's3': 'S3', 'glue': 'AWS Glue', 'emr': 'EMR', 'iam': 'IAM', 'ec2': 'EC2',
  'github': 'GitHub', 'gitlab': 'GitLab', 'k8s': 'Kubernetes', 'cicd ': 'CI/CD',
  'aws': 'AWS', 'gcp': 'Google Cloud', 'sql': 'SQL', 'nosql': 'NoSQL',
  'postgresql': 'PostgreSQL', 'mysql': 'MySQL', 'mongodb': 'MongoDB',
  'pyspark': 'PySpark', 'dbt': 'dbt', 'grpc': 'gRPC', 'graphql': 'GraphQL',
  'nodejs': 'Node.js', 'nextjs': 'Next.js', 'powerbi': 'Power BI',
  'sklearn': 'scikit-learn', 'mlops': 'MLOps', 'devops': 'DevOps',
  'kubernetes': 'Kubernetes', 'airflow': 'Airflow', 'snowflake': 'Snowflake',
  'kafka': 'Kafka', 'spark': 'Spark', 'redshift': 'Redshift', 'lambda': 'Lambda',
  'python': 'Python', 'java': 'Java', 'scala': 'Scala', 'docker': 'Docker',
  'terraform': 'Terraform', 'tableau': 'Tableau', 'databricks': 'Databricks',
}
const display = t => DISPLAY[String(t).toLowerCase()] || t

/* An acronym cannot stand in for a noun phrase — "building data pipelines"
   must not become "building ETL". Keep the head noun: "building ETL pipelines". */
const isAcronym = s => /^[A-Z0-9/]{2,5}$/.test(s)
const HEAD_NOUNS = /\b(pipelines?|processes|workflows?|jobs?|systems?|models?|reports?|frameworks?|services?|apis?)\b/i

/* Spelling variants where one form is simply the accepted name. */
const CANONICAL = {
  postgres: 'PostgreSQL', psql: 'PostgreSQL', 'postgre sql': 'PostgreSQL',
  k8s: 'Kubernetes', js: 'JavaScript', ts: 'TypeScript', py: 'Python',
  'node js': 'Node.js', nodejs: 'Node.js', 'react js': 'React', reactjs: 'React',
  'ms sql': 'SQL Server', mssql: 'SQL Server', 'sql server': 'SQL Server',
  gcp: 'Google Cloud', aws: 'AWS', 'power bi': 'Power BI', powerbi: 'Power BI',
  sklearn: 'scikit-learn', 'sci-kit learn': 'scikit-learn',
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9+#./\s-]/g, ' ').replace(/\s+/g, ' ').trim()

/* ── parseJD ──
   Turns a pasted posting into discrete requirement objects. */
export function parseJD(text) {
  const raw = String(text || '')
  if (!raw.trim()) return []

  /* Postings arrive either as real bullet lines or as one wrapped blob.
     Split on newlines first; any very long line is then split on sentences. */
  const chunks = []
  raw.split('\n').forEach(line => {
    const t = line.replace(/^[\s•▪◦*\-–—·]+/, '').trim()
    if (!t) return
    if (t.length > 180) {
      t.split(/(?<=[.;])\s+(?=[A-Z])/).forEach(s => chunks.push(s.trim()))
    } else {
      chunks.push(t)
    }
  })

  const seen = new Set()
  const out = []
  for (const c of chunks) {
    if (c.length < 8 || c.length > 260) continue
    if (IS_HEADING.test(c)) continue
    if (BOILERPLATE.some(re => re.test(c))) continue

    const key = norm(c).slice(0, 60)
    if (seen.has(key)) continue          // postings repeat themselves constantly
    seen.add(key)

    const terms = extractTerms(c)
    /* "You will translate…" and "the candidate will own…" are responsibilities
       wearing the employer's voice. Test the stripped form, or they get
       discarded before the drafter ever sees them. */
    const bare = c.replace(EMPLOYER_VOICE, '').replace(/^\s*[a-z,\s]{0,40},\s*/i, '')
    if (!terms.length && !REQ_MARKER.test(c) && !RESP_VERB.test(c) && !RESP_VERB.test(bare)) continue

    out.push({
      id: `r${out.length}`,
      text: c.replace(/\s+/g, ' ').trim(),
      type: classify(c, terms),
      terms,
    })
  }
  return out.slice(0, 40)                // a posting past 40 real requirements is noise
}

function classify(line, terms) {
  if (/\b(bachelor|master|phd|degree|diploma|b\.?tech|m\.?tech|mba|\d+\+?\s*years?)\b/i.test(line)) return 'qualification'
  if (terms.length && norm(line).split(' ').length <= 12) return 'tool'
  if (RESP_VERB.test(line)) return 'responsibility'
  if (terms.length) return 'tool'
  return 'skill'
}

/* Pull technology tokens and multi-word equivalence phrases out of a line. */
function extractTerms(line) {
  const n = ' ' + norm(line) + ' '
  const found = new Set()

  EQUIV_GROUPS.forEach(group => {
    group.forEach(phrase => {
      if (phrase.includes(' ') && n.includes(' ' + phrase + ' ')) found.add(phrase)
    })
  })
  n.split(' ').forEach(w => {
    const t = w.replace(/[.,;:]+$/, '')
    if (TECH.has(t)) found.add(t)
  })
  return [...found]
}

/* ── matchResume ──
   For each requirement, decide whether the resume already covers it and
   record the line that provides the evidence. */
export function matchResume(data, requirements) {
  const d = getStructuredData(data || {})
  const lines = resumeLines(d)
  const haystack = norm(lines.map(l => l.text).join(' '))
  const skillsNorm = (d.skillList || []).map(norm)

  return (requirements || []).map(req => {
    let status = 'missing'
    let evidence = null

    const hits = req.terms.filter(t => haystack.includes(t) || skillsNorm.some(s => s.includes(t) || t.includes(s)))

    if (req.terms.length && hits.length === req.terms.length) status = 'covered'
    else if (hits.length) status = 'partial'

    /* No technology tokens to compare — fall back to meaningful word overlap. */
    if (!req.terms.length) {
      const words = norm(req.text).split(' ').filter(w => w.length > 4)
      const overlap = words.filter(w => haystack.includes(w))
      const ratio = words.length ? overlap.length / words.length : 0
      status = ratio >= 0.6 ? 'covered' : ratio >= 0.3 ? 'partial' : 'missing'
    }

    if (status !== 'missing') {
      evidence = lines.find(l => {
        const ln = norm(l.text)
        return hits.some(t => ln.includes(t))
      }) || null
    }

    return { ...req, status, hits, evidence }
  })
}

/* Every editable line of the resume, tagged with where it came from so a
   rewrite can be written back to the right field and line. */
function resumeLines(d) {
  const out = []
  const push = (field, lineIndex, seg, text) => {
    if (text && text.trim()) out.push({ field, lineIndex, seg, text: text.trim() })
  }
  if (d.summary) push('summary', 0, -1, d.summary)
  ;['exp', 'proj'].forEach(field => {
    String(d[field] || '').split('\n').forEach((line, lineIndex) => {
      if (!line.trim()) return
      const segs = line.split('|')
      /* Only the description segment is rewritten — role, company and dates
         are facts and must not be touched. */
      if (segs.length >= 4) push(field, lineIndex, 3, segs.slice(3).join('|'))
      else push(field, lineIndex, 0, line)
    })
  })
  return out
}

/* ── buildRewrites ──
   The core of the feature: where your line and the posting describe the same
   thing in different words, propose swapping yours for theirs.
   Only fires on claims already present in the resume. */
export function buildRewrites(data, jdText) {
  const d = getStructuredData(data || {})
  const jdNorm = ' ' + norm(jdText) + ' '
  const lines = resumeLines(d)
  const rewrites = []

  lines.forEach(line => {
    let text = line.text
    const changes = []

    /* 1. Equivalence swaps — same concept, their wording. */
    EQUIV_GROUPS.forEach(group => {
      const jdVariant = group.find(p => jdNorm.includes(' ' + p + ' '))
      if (!jdVariant) return
      const mine = group.filter(p => p !== jdVariant)
      for (const m of mine.sort((a, b) => b.length - a.length)) {
        const re = new RegExp(`\\b${escapeRe(m)}\\b`, 'i')
        if (!re.test(text)) continue

        let replacement = display(jdVariant)
        /* Swapping a noun phrase for an acronym strands the sentence —
           "built data pipelines" must not become "built ETL". Carry the
           head noun across so it reads "built ETL pipelines". */
        if (isAcronym(replacement)) {
          const head = (m.match(HEAD_NOUNS) || [])[0]
          if (head) replacement = `${replacement} ${head.toLowerCase()}`
          else if (m.split(' ').length > 1) continue   // no safe way to swap — skip
        }

        const before = text
        text = text.replace(re, match => matchCase(match, replacement))
        if (text !== before) {
          changes.push({ from: m, to: replacement, why: 'the posting uses this term' })
        }
        break                     // one swap per group is enough
      }
    })

    /* 2. Canonical naming — only when the posting itself uses the full form. */
    Object.entries(CANONICAL).forEach(([variant, proper]) => {
      if (!jdNorm.includes(' ' + norm(proper) + ' ')) return
      const re = new RegExp(`\\b${escapeRe(variant)}\\b`, 'i')
      if (re.test(text) && !new RegExp(`\\b${escapeRe(proper)}\\b`, 'i').test(text)) {
        text = text.replace(re, proper)
        changes.push({ from: variant, to: proper, why: 'matches the posting’s spelling' })
      }
    })

    if (changes.length && text !== line.text) {
      rewrites.push({
        id: `w${rewrites.length}`,
        field: line.field, lineIndex: line.lineIndex, seg: line.seg,
        before: line.text, after: text, changes,
      })
    }
  })

  return rewrites
}

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function matchCase(sample, replacement) {
  /* A replacement that already carries capitals is a display form
     ("BI reporting", "AWS Glue") — its own casing is the correct one. */
  if (/[A-Z]/.test(replacement)) return replacement
  if (sample === sample.toUpperCase() && sample.length > 1) return replacement.toUpperCase()
  if (sample[0] === sample[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1)
  return replacement
}

/* ── Missing skills worth offering ──
   Tool/skill requirements the resume does not mention. Returned as
   candidates only; the user ticks the ones that are actually true. */
export function missingSkills(matched) {
  const seen = new Set()
  const out = []
  ;(matched || []).forEach(m => {
    if (m.status === 'covered') return
    if (m.type !== 'tool' && m.type !== 'skill') return
    m.terms.forEach(t => {
      if (m.hits.includes(t)) return
      const label = display(CANONICAL[t] || t)
      const k = label.toLowerCase()
      if (seen.has(k)) return
      seen.add(k)
      out.push({ id: `s${out.length}`, term: properCase(label), source: m.text })
    })
  })
  return out
}

function properCase(t) {
  if (/[A-Z]/.test(t)) return t                       // already a display form
  if (TECH.has(t) && t.length <= 4) return t.toUpperCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/* ── suggestBullets ──
   Turns a requirement the resume does not yet address into a DRAFT bullet.

   These are scaffolds, not claims. Each one is returned unconfirmed, in the
   resume's own voice (past tense, action verb), and carries a metric
   placeholder so it reads as unfinished until the user supplies the detail
   only they can know. The UI keeps them unticked and editable. */

const IMPERATIVE_PAST = {
  design: 'Designed', build: 'Built', develop: 'Developed', create: 'Created',
  implement: 'Implemented', maintain: 'Maintained', manage: 'Managed', lead: 'Led',
  own: 'Owned', drive: 'Drove', deliver: 'Delivered', collaborate: 'Collaborated',
  partner: 'Partnered', work: 'Worked', support: 'Supported', optimize: 'Optimized',
  optimise: 'Optimised', automate: 'Automated', monitor: 'Monitored',
  analyze: 'Analyzed', analyse: 'Analysed', architect: 'Architected', scale: 'Scaled',
  migrate: 'Migrated', integrate: 'Integrated', deploy: 'Deployed', test: 'Tested',
  document: 'Documented', mentor: 'Mentored', coordinate: 'Coordinated',
  translate: 'Translated', define: 'Defined', establish: 'Established',
  improve: 'Improved', ensure: 'Ensured', write: 'Wrote', produce: 'Produced',
  perform: 'Performed', conduct: 'Conducted', execute: 'Executed', oversee: 'Oversaw',
  contribute: 'Contributed', participate: 'Participated', run: 'Ran',
  troubleshoot: 'Troubleshot', debug: 'Debugged', refactor: 'Refactored',
}

function toPast(verb) {
  const v = verb.toLowerCase()
  if (IMPERATIVE_PAST[v]) return IMPERATIVE_PAST[v]
  if (/e$/.test(v)) return cap(v + 'd')
  if (/[^aeiou]y$/.test(v)) return cap(v.slice(0, -1) + 'ied')
  return cap(v + 'ed')
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

/* Phrases a posting uses to describe the job rather than the work — all of
   them are the employer talking, and none belong on a resume. */
const EMPLOYER_VOICE = new RegExp(
  '^\\s*(?:' +
  'this\\s+(?:role|position|job)\\s+(?:will|is|involves|requires)|' +
  'the\\s+(?:successful|ideal|right)\\s+candidate\\s+will|' +
  'the\\s+candidate\\s+(?:will|should|must)|' +
  'you\\s+will|you.{0,3}ll|we\\s+are\\s+looking\\s+for|looking\\s+for|' +
  'in\\s+this\\s+role,?\\s+you\\s+will|' +
  'the\\s+role\\s+(?:will|involves|requires)|' +
  'reporting\\s+to|as\\s+an?\\s+[\\w\\s]{3,30},?\\s+you\\s+will' +
  ')\\s+', 'i'
)

export function suggestBullets(matched, opts = {}) {
  const limit = opts.limit || 6
  const out = []
  const usedTerms = new Set()

  /* Degrees and years-of-experience are facts about you, not work you did —
     everything else is fair game, because draftFrom returns nothing for any
     line it cannot turn into a proper bullet. */
  const candidates = (matched || [])
    .filter(m => m.status !== 'covered')
    .filter(m => m.type !== 'qualification')

  for (const m of candidates) {
    if (out.length >= limit) break

    /* Skip a requirement that repeats ground an earlier draft already covers —
       three bullets about pipelines helps nobody. */
    const sig = m.terms.slice(0, 2).join('|')
    if (sig && usedTerms.has(sig)) continue
    if (sig) usedTerms.add(sig)

    const text = draftFrom(m.text)
    if (!text) continue

    out.push({
      id: `b${out.length}`,
      text,
      source: m.text,
      terms: m.terms,
      /* Flagged in the UI rather than written into the sentence — a bullet
         with a placeholder inside it is just text the user has to clean up. */
      needsDetail: !/\d/.test(text),
    })
  }
  return out
}

/* Rewrites one posting line into resume-bullet shape. */
function draftFrom(line) {
  let s = String(line || '')
    /* Leading clause before the real sentence: "Reporting to the Head of
       Data, the candidate will own…" — drop it, then strip the voice. */
    .replace(/^\s*(reporting\s+to|working\s+(?:with|alongside)|as\s+part\s+of)\b[^,]{0,60},\s*/i, '')
    .replace(EMPLOYER_VOICE, '')
    .replace(/^\s*(the\s+ability\s+to|ability\s+to|responsible\s+for|help(?:ing)?\s+to)\s+/i, '')
    .replace(/^\s*(experience|proficiency|expertise|knowledge|familiarity)\s+(with|in|of)\s+/i, 'Worked with ')
    .replace(/^\s*(strong|solid|excellent|proven|demonstrated|hands[- ]on|deep)\s+/i, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')                       // drop parenthetical asides
    .replace(/\s*\b(is\s+a\s+plus|preferred|required|nice\s+to\s+have|a\s+plus)\b\s*\.?$/i, '')
    /* A posting speaks as the employer — "our estate", "we use X". On a resume
       that reads as someone else's voice, so neutralise it. */
    .replace(/\b(our|the\s+company.s|company.s)\s+/gi, 'the ')
    .replace(/\b(we|our\s+team)\s+(use|uses|used|leverage|leverages)\b/gi, 'using')
    .replace(/\s+/g, ' ')
    .trim()

  if (!s) return ''

  /* Lead the bullet with a past-tense verb. Handles "Design and build …". */
  const compound = s.match(/^([A-Za-z]+)\s+and\s+([A-Za-z]+)\s+(.*)$/)
  if (compound && IMPERATIVE_PAST[compound[1].toLowerCase()] && IMPERATIVE_PAST[compound[2].toLowerCase()]) {
    s = `${toPast(compound[1])} and ${toPast(compound[2]).toLowerCase()} ${compound[3]}`
  } else {
    const first = s.match(/^([A-Za-z]+)\b/)
    if (first && IMPERATIVE_PAST[first[1].toLowerCase()]) {
      s = toPast(first[1]) + s.slice(first[1].length)
    } else if (!/^[A-Z]/.test(s)) {
      s = cap(s)
    }
  }

  /* Fix the display form of any technology named in the line. */
  Object.entries(DISPLAY).forEach(([k, v]) => {
    const re = new RegExp(`\\b${escapeRe(k)}\\b`, 'gi')
    if (re.test(s) && !s.includes(v)) s = s.replace(re, v)
  })

  s = s.replace(/[.\s]+$/, '')

  /* A posting sentence that still has no past-tense verb at the front never
     became a resume bullet — emitting it would just paste the advert back.
     Better to return nothing than something the user must rewrite anyway. */
  const lead = (s.match(/^([A-Za-z]+)/) || [])[1]
  if (!lead || !Object.values(IMPERATIVE_PAST).some(v => v.toLowerCase() === lead.toLowerCase())) {
    if (!/^(worked|used|built|led)\b/i.test(s)) return ''
  }

  /* Postings often pile five responsibilities into one sentence. Cut at the
     first natural boundary so the bullet stays readable. */
  if (s.split(' ').length > 22) {
    const cut = s.slice(0, 190)
    const at = Math.max(cut.lastIndexOf(', including'), cut.lastIndexOf(' that '), cut.lastIndexOf(' which '))
    s = (at > 60 ? cut.slice(0, at) : cut.split(' ').slice(0, 22).join(' ')).replace(/[,\s]+$/, '')
  }

  /* No terminal period — bullets are joined with ";" and the writing checker
     applies punctuation consistently across the whole resume. */
  return s
}

/* ── applyDecisions ──
   Writes back ONLY what the user ticked. Returns a new form object.
   decisions = { rewrites: [], skills: [], bullets: [] }
   Each bullet carries { text, targetField, targetLine } naming the entry it
   should join. */
export function applyDecisions(form, { rewrites = [], skills = [], bullets = [] } = {}) {
  const out = { ...(form || {}) }

  /* Group rewrites by field so each field is rebuilt once. */
  const byField = {}
  rewrites.forEach(r => {
    (byField[r.field] = byField[r.field] || []).push(r)
  })

  Object.entries(byField).forEach(([field, list]) => {
    if (field === 'summary') {
      const r = list[0]
      if (r) out.summary = r.after
      return
    }
    const lines = String(out[field] || '').split('\n')
    list.forEach(r => {
      const line = lines[r.lineIndex]
      if (line === undefined) return
      if (r.seg < 0) { lines[r.lineIndex] = r.after; return }
      const segs = line.split('|')
      if (segs.length >= 4 && r.seg === 3) {
        lines[r.lineIndex] = [...segs.slice(0, 3), ' ' + r.after].join('|')
      } else {
        lines[r.lineIndex] = r.after
      }
    })
    out[field] = lines.join('\n')
  })

  if (skills.length) {
    const cur = String(out.skills || '').split(',').map(s => s.trim()).filter(Boolean)
    skills.forEach(s => {
      if (!cur.some(c => c.toLowerCase() === String(s).toLowerCase())) cur.push(s)
    })
    out.skills = cur.join(', ')
  }

  /* Confirmed draft bullets join the chosen entry's description, which is
     always the segment after the third pipe — role, company and dates stay
     exactly as they were. */
  bullets.forEach(b => {
    const field = b.targetField || 'exp'
    const lines = String(out[field] || '').split('\n')
    const idx = Math.min(Math.max(0, b.targetLine ?? 0), Math.max(0, lines.length - 1))
    const line = lines[idx]
    if (line === undefined) return

    const clean = String(b.text || '').trim().replace(/^[•\-–*]\s*/, '')
    if (!clean) return

    const segs = line.split('|')
    if (segs.length >= 4) {
      const desc = segs.slice(3).join('|').trim()
      segs.length = 3
      lines[idx] = [...segs, ' ' + (desc ? `${desc}; ${clean}` : clean)].join('|')
    } else {
      lines[idx] = line.trim() ? `${line.trim()}; ${clean}` : clean
    }
    out[field] = lines.join('\n')
  })

  return out
}

/* Entries a draft bullet can be attached to, for the target picker. */
export function bulletTargets(form) {
  const out = []
  ;['exp', 'proj'].forEach(field => {
    String((form || {})[field] || '').split('\n').forEach((line, lineIndex) => {
      if (!line.trim()) return
      const segs = line.split('|').map(s => s.trim())
      const label = [segs[0], segs[1]].filter(Boolean).join(' · ') || `Line ${lineIndex + 1}`
      out.push({ field, lineIndex, label, group: field === 'exp' ? 'Experience' : 'Projects' })
    })
  })
  return out
}
