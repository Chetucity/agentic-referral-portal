'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

import Header from './Header.jsx'
import CreateTab from './CreateTab.jsx'
import ImproveTab from './ImproveTab.jsx'
import Preview from './Preview.jsx'
import CompareView from './CompareView.jsx'
import Inspector from './Inspector.jsx'
import { getStructuredData } from '@/lib/resume/resumeData.js'
import { scoreResume } from '@/lib/resume/scorer.js'

/**
 * The resume builder, as it lives inside the portal.
 *
 * This is a port of the standalone QuickResume app. Three things changed, all
 * of them because the surrounding product now answers questions the standalone
 * app had to answer for itself:
 *
 *   1. **No auth of its own.** The original signed people in with a Supabase
 *      magic link so it could tell who they were. The portal already knows,
 *      and the server actions take the identity from the session cookie, so
 *      the sign-in modal, the account chip and the email gate are gone.
 *
 *   2. **No download gating.** Free-download counters and daily quotas existed
 *      to convert anonymous visitors into email addresses. Everyone here has
 *      an account already, so downloads are simply unlimited. The concurrency
 *      guard and cooldown are kept — those stop a double-click producing two
 *      PDFs, which is an engineering concern rather than a commercial one.
 *
 *   3. **Resumes persist server-side.** The original autosaved to
 *      localStorage under a per-tab UUID. That is still here as an instant
 *      local buffer, but the document is also written to the database on a
 *      debounce, which is what lets a resume be attached to a referral and
 *      read by the person being asked to make it.
 */

const INITIAL_FORM = {
  name: '', email: '', phone: '', title: '', location: '', link: '', summary: '', skills: '',
  exp: '', edu: '', proj: '', certs: '',
  /* Split-template sidebar fields */
  achievements: '', courses: '', languages: '', timeAlloc: '',
}

const DEFAULT_ORDER = ['summary', 'exp', 'proj', 'edu', 'certs', 'skills']

/** localStorage key for the working draft of a given resume row (or a new one). */
const draftKey = (id) => `referin-resume-draft-${id ?? 'new'}`

/** Pulls the document out of component state into the shape the server stores. */
function serialise(s) {
  return JSON.stringify({
    v: 1,
    form: s.form,
    template: s.template,
    accent: s.accent,
    sectionOrder: s.sectionOrder,
    fontScale: s.fontScale,
    columnPins: s.columnPins,
    boldCerts: s.boldCerts,
  })
}

export default function ResumeBuilder({
  initialResumes = [],
  initialId = null,
  initialTitle = 'Untitled resume',
  initialDoc = null,
  profile = null,
  actions,
}) {
  const router = useRouter()

  /* ——— Document state ——— */
  const [form, setForm] = useState(() => ({ ...INITIAL_FORM, ...(initialDoc?.form ?? {}) }))
  const [template, setTemplate] = useState(initialDoc?.template ?? 'classic')
  const [accent, setAccent] = useState(initialDoc?.accent ?? '#2563eb')
  const [sectionOrder, setSectionOrder] = useState(
    Array.isArray(initialDoc?.sectionOrder) ? initialDoc.sectionOrder : DEFAULT_ORDER,
  )
  const [fontScale, setFontScale] = useState(initialDoc?.fontScale ?? null)
  const [columnPins, setColumnPins] = useState(initialDoc?.columnPins ?? {})
  const [boldCerts, setBoldCerts] = useState(Boolean(initialDoc?.boldCerts))

  /* ——— Shell state ——— */
  const [activeId, setActiveId] = useState(initialId)
  const [title, setTitle] = useState(initialTitle)
  const [resumes, setResumes] = useState(initialResumes)
  const [activeTab, setActiveTab] = useState('create')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  /* ——— Improve-tab state ——— */
  const [uploadedText, setUploadedText] = useState('')
  const [originalFileUrl, setOriginalFileUrl] = useState(null)
  const [originalParsed, setOriginalParsed] = useState(null)
  const [lastParsed, setLastParsed] = useState(null)
  const [lastResult, setLastResult] = useState(null)

  const pageRef = useRef(null)

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }, [])

  /* ——— Prefill from the portal profile ———
     A brand-new resume starts with what the portal already knows about this
     person. It saves retyping their own name, and it means the very first
     preview is not an empty sheet of paper. */
  useEffect(() => {
    if (initialDoc || !profile) return
    setForm((f) => {
      if (f.name || f.email) return f
      return {
        ...f,
        name: profile.name ?? '',
        email: profile.email ?? '',
        title: profile.headline ?? '',
        location: profile.location ?? '',
        link: profile.linkedinUrl ?? '',
        skills: profile.skills ?? '',
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ——— Local draft buffer ———
     Written synchronously on every change so a refresh mid-sentence loses
     nothing, even if the server save has not fired yet. */
  useEffect(() => {
    try {
      localStorage.setItem(
        draftKey(activeId),
        serialise({ form, template, accent, sectionOrder, fontScale, columnPins, boldCerts }),
      )
    } catch {
      /* Private mode, or storage full. The server save is the real one. */
    }
  }, [form, template, accent, sectionOrder, fontScale, columnPins, boldCerts, activeId])

  /* ——— Server autosave ———
     Debounced, and deliberately not on a timer: it fires 1.2 s after the last
     keystroke, so a burst of typing is one write rather than thirty. */
  const dirty = useRef(false)
  useEffect(() => {
    dirty.current = true
  }, [form, template, accent, sectionOrder, fontScale, columnPins, boldCerts, title])

  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(async () => {
      // Nothing worth persisting yet — don't create an empty row the moment
      // the page opens.
      const structured = getStructuredData(form)
      if (!structured.name && !structured.email && !form.summary && !form.exp) return

      setSaving(true)
      try {
        const res = await actions.save({
          id: activeId ?? undefined,
          title: title.trim() || 'Untitled resume',
          data: serialise({ form, template, accent, sectionOrder, fontScale, columnPins, boldCerts }),
          fullName: structured.name || undefined,
          headline: form.title || undefined,
          atsScore: scoreResume(structured, form.jd || '', { template }).score,
        })

        if (res?.ok) {
          dirty.current = false
          if (!activeId) setActiveId(res.id)
          setResumes((list) => {
            const next = list.filter((r) => r.id !== res.id)
            return [
              { id: res.id, title: title.trim() || 'Untitled resume', updatedAt: res.updatedAt },
              ...next,
            ]
          })
          setSaved(true)
          setTimeout(() => setSaved(false), 1600)
        } else if (res?.error) {
          showToast(res.error)
        }
      } catch {
        showToast('Could not reach the server — your draft is saved locally.')
      } finally {
        setSaving(false)
      }
    }, 1200)
    return () => clearTimeout(t)
  }, [form, template, accent, sectionOrder, fontScale, columnPins, boldCerts, title, activeId, actions, showToast])

  /* ——— Switching, creating and deleting ——— */

  const loadDoc = useCallback((doc) => {
    setForm({ ...INITIAL_FORM, ...(doc?.form ?? {}) })
    setTemplate(doc?.template ?? 'classic')
    setAccent(doc?.accent ?? '#2563eb')
    setSectionOrder(Array.isArray(doc?.sectionOrder) ? doc.sectionOrder : DEFAULT_ORDER)
    setFontScale(doc?.fontScale ?? null)
    setColumnPins(doc?.columnPins ?? {})
    setBoldCerts(Boolean(doc?.boldCerts))
  }, [])

  const switchTo = useCallback(async (id) => {
    if (!id || id === activeId) return
    try {
      const row = await actions.load(id)
      if (!row) { showToast('That resume could not be opened.'); return }
      dirty.current = false
      setActiveId(row.id)
      setTitle(row.title)
      loadDoc(JSON.parse(row.data))
      setActiveTab('create')
      showToast(`Opened “${row.title}”`)
    } catch {
      showToast('That resume could not be opened.')
    }
  }, [activeId, actions, loadDoc, showToast])

  const newResume = useCallback(() => {
    dirty.current = false
    setActiveId(null)
    setTitle('Untitled resume')
    loadDoc(null)
    setActiveTab('create')
    setUploadedText(''); setOriginalFileUrl(null); setOriginalParsed(null)
    setLastParsed(null); setLastResult(null)
    showToast('New resume started')
  }, [loadDoc, showToast])

  const removeResume = useCallback(async () => {
    if (!activeId) return
    const name = title || 'this resume'
    if (!window.confirm(`Delete “${name}”? Referrals you already sent keep their history, but stop showing it.`)) return
    await actions.remove(activeId)
    setResumes((list) => list.filter((r) => r.id !== activeId))
    newResume()
    showToast('Resume deleted')
    router.refresh()
  }, [activeId, title, actions, newResume, showToast, router])

  /* ——— Editing helpers ——— */

  const updateForm = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }))
  }, [])

  const applyParsed = useCallback((parsed) => {
    setForm((f) => {
      const next = { ...f }
      Object.keys(parsed).forEach((k) => { if (parsed[k]) next[k] = parsed[k] })
      return next
    })
    setTemplate('classic')
    setActiveTab('create')
    showToast('Loaded into editor — review, tweak, then download')
  }, [showToast])

  /* ——— Downloads ———
     No quota, no gate. The in-flight guard and the cooldown remain so a
     double-click cannot start two renders of the same page at once. */
  const [downloading, setDownloading] = useState(false)
  const downloadInFlight = useRef(false)

  const runDownload = useCallback(async (fn) => {
    if (downloadInFlight.current) return
    downloadInFlight.current = true
    setDownloading(true)
    try {
      await fn()
    } catch (err) {
      console.error('Download error:', err)
      showToast('That export failed. Try again.')
    } finally {
      setTimeout(() => {
        downloadInFlight.current = false
        setDownloading(false)
      }, 1200)
    }
  }, [showToast])

  return (
    <>
      <Header
        saved={saved}
        saving={saving}
        form={form}
        template={template}
        title={title}
        onTitleChange={setTitle}
        resumes={resumes}
        activeId={activeId}
        onSwitch={switchTo}
        onNewResume={newResume}
        onDelete={removeResume}
      />

      <div className="app-tabs">
        <button
          className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create new
        </button>
        <button
          className={`tab-btn ${activeTab === 'improve' ? 'active' : ''}`}
          onClick={() => setActiveTab('improve')}
        >
          Improve existing
        </button>
      </div>

      <div className="app-main">
        <div>
          {activeTab === 'create' ? (
            <CreateTab form={form} updateForm={updateForm} setForm={setForm} showToast={showToast} />
          ) : (
            <ImproveTab
              form={form} setForm={setForm}
              uploadedText={uploadedText} setUploadedText={setUploadedText}
              setOriginalFileUrl={setOriginalFileUrl}
              setOriginalParsed={setOriginalParsed}
              lastParsed={lastParsed} setLastParsed={setLastParsed}
              lastResult={lastResult} setLastResult={setLastResult}
              applyParsed={applyParsed}
              showToast={showToast}
            />
          )}
        </div>

        <div>
          <Preview
            form={form} template={template} accent={accent}
            setTemplate={setTemplate} setAccent={setAccent}
            sectionOrder={sectionOrder} setSectionOrder={setSectionOrder}
            fontScale={fontScale} setFontScale={setFontScale}
            columnPins={columnPins} setColumnPins={setColumnPins}
            boldCerts={boldCerts} setBoldCerts={setBoldCerts}
            pageRef={pageRef} showToast={showToast}
            gatedDownload={runDownload} downloading={downloading}
          />
          <Inspector
            form={form} setForm={setForm}
            template={template} accent={accent}
            showToast={showToast}
            registered
            gatedCoverDownload={runDownload}
            downloading={downloading}
            coverRemaining={Infinity}
            onRequestUnlock={() => {}}
          />
        </div>
      </div>

      {originalParsed && lastParsed && (
        <CompareView
          originalFileUrl={originalFileUrl}
          originalRawText={uploadedText}
          lastParsed={lastParsed}
          baseForm={form}
          lastResult={lastResult}
          gatedDownload={runDownload} downloading={downloading}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
