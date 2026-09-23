/* Heuristic resume text parser and PDF/DOCX reader.
   readFile(file) → Promise<string>   (raw extracted text)
   parseResumeText(text) → formFields  (parsed into the form's shape) */

import * as pdfjsLib from 'pdfjs-dist'

/* The worker is served from /public rather than imported.

   The standalone app used Vite's `?url` suffix, which webpack does not
   understand. `scripts/copy-pdf-worker.mjs` copies the worker out of
   node_modules on every install and build, so this URL always matches the
   installed pdfjs-dist version rather than a stale copy someone committed. */
const pdfjsWorkerUrl = '/pdf.worker.min.js'

let workerInitialized = false
function initWorker() {
  if (!workerInitialized) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl
    workerInitialized = true
  }
}

export async function readFile(file, onProgress) {
  const name = file.name.toLowerCase()
  const progress = msg => onProgress && onProgress(msg)

  if (file.size > 12 * 1024 * 1024) throw new Error('File is larger than 12 MB')

  if (name.endsWith('.pdf')) {
    initWorker()
    return await readPdf(file, progress)
  }
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const buf = await file.arrayBuffer()
    const res = await mammoth.default.extractRawText({ arrayBuffer: buf })
    return res.value || ''
  }
  if (name.endsWith('.txt') || name.endsWith('.md')) {
    return await file.text()
  }
  if (name.endsWith('.doc')) {
    throw new Error('Old .doc format is not supported. Open it in Word and "Save as" .docx or export as PDF.')
  }
  throw new Error('Unsupported file type. Use PDF, .docx, or .txt')
}

/* ——— PDF reader with two-column detection ——— */
async function readPdf(file, progress) {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise
  let out = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    progress(`Reading page ${i} of ${pdf.numPages}…`)
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1 })
    const pageWidth = viewport.width
    const content = await page.getTextContent()
    const allItems = content.items
      .filter(it => it.transform[4] > 5)  // skip decorative elements at left edge
      .map(it => ({ s: it.str || '', x: it.transform[4], y: it.transform[5], w: it.width || 0 }))
    const items = allItems.filter(it => it.s && it.s.trim())

    const splitX = detectColumnSplit(items, pageWidth)
    if (splitX) {
      const left  = allItems.filter(it => it.x < splitX).sort(byYthenX)
      const right = allItems.filter(it => it.x >= splitX).sort(byYthenX)
      out += buildText(left) + '\n' + buildText(right) + '\n\n'
    } else {
      out += buildText(allItems.sort(byYthenX)) + '\n\n'
    }
  }
  return fixLigatures(out.replace(/\n{3,}/g, '\n\n').trim())
}

function byYthenX(a, b) {
  return Math.abs(a.y - b.y) > 3 ? b.y - a.y : a.x - b.x
}

/* Many PDF fonts ship no ToUnicode entry for their ligature glyphs, so pdf.js
   emits U+0000 where "fi/fl/ff/ffi/ffl" belong — "Pro\0cient" for "Proficient".
   Rebuild the word by testing each ligature against a known-word list, longest
   first, and falling back to "fi" (by far the most common of the five). */
const LIGATURES = ['ffi', 'ffl', 'ff', 'fl', 'fi']

const LIG_WORDS = new Set([
  'efficient','efficiency','efficiently','office','officer','officers','official','officially',
  'sufficient','sufficiently','difficult','difficulty','difficulties','traffic','coefficient',
  'affiliate','affiliated','affiliation','staff','staffing','staffed','effort','efforts',
  'effective','effectively','effectiveness','different','difference','differences','differential',
  'offer','offered','offering','affect','affected','offline','off','buffer','buffered',
  'workflow','workflows','flow','flows','flexible','flexibility','reflect','reflected','conflict',
  'conflicts','influence','influenced','fluent','flag','flagged','flags','flat','float','fleet',
  'proficient','proficiency','configuration','configurations','configure','configured','configuring',
  'significant','significantly','significance','confident','confidence','confidential','define',
  'defined','defining','financial','finance','finances','identify','identified','identifying',
  'verify','verified','verifying','verification','notification','notifications','notify','notified',
  'classification','classified','specific','specifically','specification','specifications','benefit',
  'benefits','beneficial','profile','profiles','certificate','certificates','certification',
  'certifications','qualified','qualification','qualifications','modified','modify','specified',
  'unified','satisfied','satisfaction','artificial','first','field','fields','file','files','filter',
  'filtered','filtering','filters','final','finally','finalized','finding','findings','fix','fixed',
  'fixes','firmware','confirm','confirmed','confirmation','profit','profitable','simplified',
  'simplify','amplified','justified','clarify','clarified','diversified','magnified','fifty',
  'fiscal','figure','figures','five','fill','filled','film','fine','finish','finished','fire',
  'firm','fit','fitness','scientific','pacific','deficit','deficiency','proficiently',
])

const NUL = '\u0000'
const NUL_TOKEN = new RegExp('[A-Za-z]*' + NUL + '[A-Za-z' + NUL + ']*', 'g')
const NUL_ALL = new RegExp(NUL, 'g')

function fixLigatures(text) {
  if (text.indexOf(NUL) === -1) return text
  return text.replace(NUL_TOKEN, token => {
    for (const lig of LIGATURES) {
      const candidate = token.replace(NUL_ALL, lig)
      if (LIG_WORDS.has(candidate.toLowerCase())) return candidate
    }
    return token.replace(NUL_ALL, 'fi')
  })
}

/* Find a significant horizontal gap that splits items into two columns.
   Returns the split x-coordinate, or null if single-column. */
function detectColumnSplit(items, pageWidth) {
  if (items.length < 15) return null
  const rightItems = items.filter(it => it.x > pageWidth * 0.45)
  // If right items are mostly short date/location strings, this is a single column layout with right-aligned dates
  const longRightItems = rightItems.filter(it => (it.s || '').trim().length > 30)
  if (longRightItems.length < 5) return null

  const bucketSize = 6
  const xCounts = {}
  for (const it of items) {
    const bucket = Math.round(it.x / bucketSize) * bucketSize
    xCounts[bucket] = (xCounts[bucket] || 0) + 1
  }
  const xs = Object.keys(xCounts).map(Number).sort((a, b) => a - b)
  let maxGap = 0, splitX = null
  for (let i = 1; i < xs.length; i++) {
    const gap = xs[i] - xs[i - 1]
    if (gap > maxGap && xs[i] > pageWidth * 0.25 && xs[i] < pageWidth * 0.75) {
      maxGap = gap
      splitX = (xs[i - 1] + xs[i]) / 2
    }
  }
  return maxGap > pageWidth * 0.15 ? splitX : null
}

/* Convert a sorted list of text items into plain text lines with ligature decoding. */
function buildText(sortedItems) {
  let text = '', line = '', lastY = null, lastX = null
  for (const it of sortedItems) {
    let str = (it.s || '')
      .replace(/\ufb01/g, 'fi')
      .replace(/\ufb02/g, 'fl')
      .replace(/\ufb03/g, 'ffi')
      .replace(/\ufb04/g, 'ffl')
      .replace(/\ufb00/g, 'ff')
      .trim()
    if (!str) {
      if (it.y && lastY === null) lastY = it.y
      lastX = it.x + it.w
      continue
    }
    if (lastY !== null && Math.abs(it.y - lastY) > 3) {
      text += line.trim() + '\n'
      line = str
      lastY = it.y
      lastX = it.x + it.w
    } else {
      if (lastX !== null && it.x - lastX > 1.5 && !/\s$/.test(line)) {
        line += ' '
      }
      line += str
      lastX = it.x + it.w
      if (lastY === null) lastY = it.y
    }
  }
  return text + line.trim()
}

/* ——— Heuristic parser ——— */
const SECTION_HEADS = {
  summary: /^(summary|career\s+objective|objective|profile|about\s*me?)\b/i,
  exp:     /^(work\s+)?(professional\s+)?(experience|employment|work history)\b/i,
  edu:     /^(education|academic|qualification)/i,
  skills:  /^(technical\s+)?skills?\b/i,
  proj:    /^(projects?|personal\s+projects?|key\s+projects?)\b/i,
  certs:   /^(certifications?|licenses?|credentials?|certificates?)\b/i,
}

const SKIP_HEADS = /^(contact|languages?|interests?|hobbies|references?)\b/i

export function parseResumeText(text) {
  const out = { name:'', email:'', phone:'', title:'', location:'', link:'', summary:'', skills:'', exp:'', edu:'', proj:'', certs:'' }
  if (!text) return out

  const emailM = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)
  if (emailM) out.email = emailM[0]

  const phoneM = text.match(/(\+?\d[\d\s()./-]{7,}\d)/)
  if (phoneM) out.phone = phoneM[0].trim()

  const linkM = text.match(/(?:https?:\/\/|www\.)[^\s|,<>]*/i) || text.match(/(?:linkedin\.com|github\.com)[^\s|,<>]*/i)
  if (linkM) out.link = linkM[0]

  let cleanText = text
  if (out.email) cleanText = cleanText.replace(out.email, '')
  if (out.phone) cleanText = cleanText.replace(out.phone, '')
  if (out.link)  cleanText = cleanText.replace(out.link, '')

  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean)

  // Name: first short non-contact line near the top
  for (const l of lines.slice(0, 8)) {
    const w = l.split(/\s+/)
    if (w.length >= 2 && w.length <= 5 && !/[@|:\d]/.test(l) && l.length < 50 && !/^(summary|experience|education|skills|objective|about|certifications)/i.test(l)) {
      out.name = l; break
    }
  }

  // Bucket lines into sections
  let cur = null
  const buckets = { summary:[], exp:[], edu:[], skills:[], proj:[], certs:[] }

  for (const l of lines) {
    let matched = null
    for (const k in SECTION_HEADS) {
      if (SECTION_HEADS[k].test(l) && l.length < 50) { matched = k; break }
    }
    if (matched) { cur = matched; continue }
    if (SKIP_HEADS.test(l) && l.length < 40) { cur = null; continue }
    if (cur) buckets[cur].push(l)
  }

  // Summary
  const fullSummary = buckets.summary.join(' ').trim()
  if (fullSummary.length <= 1500) {
    out.summary = fullSummary
  } else {
    const cut = fullSummary.slice(0, 1500)
    const lastDot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
    out.summary = lastDot > 200 ? cut.slice(0, lastDot + 1) : cut
  }

  // Merge wrapped skill lines
  const mergedSkills = []
  for (const l of buckets.skills) {
    if (!mergedSkills.length || /^[•▪\-–*]/.test(l)) {
      mergedSkills.push(l)
    } else {
      mergedSkills[mergedSkills.length - 1] += ' ' + l
    }
  }
  out.skills = mergedSkills.join(', ')
    .replace(/[•▪|·*]/g, ',').split(',').map(s => s.trim())
    .filter(s => s && s.length < 80 && !/^\d+$/.test(s)).join(', ')

  out.exp   = groupEntries(buckets.exp).join('\n')
  out.edu   = groupEntries(buckets.edu).join('\n')
  out.proj  = groupEntries(buckets.proj).join('\n')
  out.certs = buckets.certs.map(l => l.replace(/^[•▪\-–*]\s*/, '').trim()).filter(Boolean).join('\n')

  // Guess title from subtitle line
  if (!out.title) {
    for (const l of lines.slice(1, 6)) {
      if (l.length > 5 && l.length < 80 && !/[@\d]/.test(l) && /teacher|engineer|developer|designer|manager|analyst|specialist|coordinator|consultant|director|officer/i.test(l)) {
        out.title = l.split('|')[0].split('–')[0].trim()
        break
      }
    }
  }
  if (!out.title && buckets.exp.length) {
    const first = buckets.exp[0]
    if (first && first.length < 60 && !/\d{4}/.test(first)) {
      out.title = first.split('|')[0].split(' at ')[0].trim()
    }
  }

  return out
}

function groupEntries(lines) {
  const entries = []
  let cur = null
  for (const raw of lines) {
    const l = raw.replace(/^[•▪\-–*]\s*/, '').trim()
    if (!l) continue
    const hasYear = /(19|20)\d{2}/.test(l)
    const isBulletChar = /^[•▪\-–*]/.test(raw.trim())
    const isExplicitBulletStart = isBulletChar || /^[A-Z][A-Za-z0-9\s/&()-]{2,40}:\s+/.test(l)
    const isLikelyRole = /^[A-Z]/.test(l) && l.length < 60 && !isExplicitBulletStart && !/^(and|or|with|by|to|in|on|for|from|as|that|which)\b/i.test(l) && !/[.!?]$/.test(l)

    if (hasYear && !isBulletChar) {
      const whenM = l.match(/((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?(19|20)\d{2}\s*[–—\-]?\s*(([A-Za-z]+\.?\s*)?(19|20)\d{2}|present|current|ongoing)?/i)
      const when = whenM ? whenM[0].trim() : ''
      const rest = l.replace(when, '').replace(/[|,–—\-]\s*$/, '').trim()

      if (!rest && cur) {
        cur.when = when
      } else if (cur && cur.role && !cur.when && !cur.desc.length) {
        const parts = rest.split(/\s*[|,@]\s*|\s+at\s+/).filter(Boolean)
        if (parts[0]) cur.org = parts[0]
        cur.when = when
      } else if (cur && cur.desc.length > 0) {
        entries.push(cur)
        const parts = rest.split(/\s*[|,@]\s*|\s+at\s+/).filter(Boolean)
        cur = { role: parts[0] || rest, org: parts.slice(1).join(', '), when, desc: [] }
      } else {
        if (cur) entries.push(cur)
        const parts = rest.split(/\s*[|,@]\s*|\s+at\s+/).filter(Boolean)
        cur = { role: parts[0] || rest, org: parts.slice(1).join(', '), when, desc: [] }
      }
    } else if (!hasYear && !isExplicitBulletStart && cur && !cur.org && l.length < 45 && cur.desc.length === 0) {
      cur.org = l
    } else if (cur && cur.desc.length > 0 && isLikelyRole && !isExplicitBulletStart) {
      entries.push(cur)
      cur = { role: l, org: '', when: '', desc: [] }
    } else if (cur) {
      if (isExplicitBulletStart || cur.desc.length === 0) {
        cur.desc.push(l)
      } else {
        const lastIndex = cur.desc.length - 1
        const lastDesc = cur.desc[lastIndex]
        const lastEndsPunctuation = /[.!?]$/.test(lastDesc.trim())

        if (!lastEndsPunctuation) {
          cur.desc[lastIndex] += ' ' + l
        } else {
          cur.desc.push(l)
        }
      }
    } else {
      cur = { role: l, org: '', when: '', desc: [] }
    }
  }
  if (cur) entries.push(cur)
  return entries.map(e =>
    [e.role, e.org, e.when, e.desc.join('; ')].map(s => String(s).trim()).join(' | ').replace(/(\s*\|\s*)+$/, '')
  )
}
