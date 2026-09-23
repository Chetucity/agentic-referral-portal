'use client'

import { useState } from 'react'
import { autoSummary } from '@/lib/resume/resumeData.js'

const HINT_EXP    = 'One job per line: Role | Company | Dates | What you did   (separate achievements with ";")'
const HINT_EDU    = 'One per line: Degree | School | Years | Extra (optional)'
const HINT_PROJ   = 'One per line: Project name | Tech stack | What it does'
const HINT_CERTS  = 'One per line: Certificate Name | Issuing Org | Year'
const HINT_ACH    = 'One per line: Achievement | What you did and the impact it had'
const HINT_LANG   = 'One per line: Language | Level  —  Native, Advanced, Intermediate, Basic (or 1–5)'
const HINT_COURSE = 'One per line: Course Title | Institution | Year'
const HINT_TIME   = 'One per line: Activity | Share  —  numbers are normalised, so they need not total 100'

/* Collapsible group. The count in the header lets you see what a closed
   section holds without opening it. */
function Section({ id, title, count, open, onToggle, children }) {
  return (
    <div className="acc">
      <button className="acc-head" onClick={() => onToggle(id)} aria-expanded={open}>
        {title}
        {count > 0 && <span className="acc-count">{count}</span>}
        <span className="acc-chev">›</span>
      </button>
      {open && <div className="acc-body">{children}</div>}
    </div>
  )
}

const lineCount = v => String(v || '').split('\n').filter(l => l.trim()).length

export default function CreateTab({ form, updateForm, setForm, showToast }) {
  const [open, setOpen] = useState({ basics: true, history: true, extras: false })
  const toggle = id => setOpen(o => ({ ...o, [id]: !o[id] }))

  const field = (id, label, type = 'text', placeholder = '', hint = null) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input type={type} id={id} value={form[id] || ''} placeholder={placeholder}
        onChange={e => updateForm(id, e.target.value)} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  )

  const area = (id, placeholder, hint, extra = {}) => (
    <>
      <textarea id={id} value={form[id] || ''} placeholder={placeholder}
        onChange={e => updateForm(id, e.target.value)} {...extra} />
      <p className="hint">{hint}</p>
    </>
  )

  function handleAutoSummary() {
    updateForm('summary', autoSummary(form))
    showToast('Summary generated')
  }

  const filled = ['name', 'email', 'phone', 'title', 'location', 'link', 'summary', 'skills']
    .filter(k => (form[k] || '').trim()).length

  return (
    <div className="panel">
      <Section id="basics" title="Basics" count={filled} open={open.basics} onToggle={toggle}>
        {field('name', 'Full name', 'text', 'Chetan Sharma')}
        <div className="row-2">
          {field('email', 'Email', 'email', 'you@mail.com')}
          {field('phone', 'Phone', 'text', '+91 98xxxxxx')}
        </div>
        <div className="row-2">
          {field('title', 'Job title', 'text', 'Data Engineer')}
          {field('location', 'Location', 'text', 'Delhi, India')}
        </div>
        {field('link', 'Link', 'text', 'linkedin.com/in/you or github.com/you')}

        <label htmlFor="summary">
          Summary
          <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={handleAutoSummary}>
            ✦ Auto-generate
          </button>
        </label>
        <textarea id="summary" value={form.summary || ''}
          placeholder="2–3 lines about you (or click auto-generate)"
          onChange={e => updateForm('summary', e.target.value)} />

        {field('skills', 'Skills (comma separated)', 'text', 'SQL, Python, AWS, Azure, PySpark')}
      </Section>

      <Section
        id="history" title="Experience &amp; education"
        count={lineCount(form.exp) + lineCount(form.edu) + lineCount(form.proj) + lineCount(form.certs)}
        open={open.history} onToggle={toggle}
      >
        <label htmlFor="exp">Experience</label>
        {area('exp', 'Web Dev Intern | ABC Tech | Jan 2025 – Jun 2025 | Built 5 React dashboards used by 200+ users; Reduced load time by 40%', HINT_EXP, { style: { minHeight: 92 } })}

        <label htmlFor="edu">Education</label>
        {area('edu', 'B.Tech Computer Science | XYZ University | 2021 – 2025 | CGPA 8.5', HINT_EDU)}

        <label htmlFor="proj">Projects <span style={{ color: 'var(--text-faint)' }}>(optional)</span></label>
        {area('proj', 'Expense Tracker | React, Firebase | Real-time budget app with 1k+ downloads', HINT_PROJ)}

        <label htmlFor="certs">Certifications <span style={{ color: 'var(--text-faint)' }}>(optional)</span></label>
        {area('certs', 'AWS Certified Cloud Practitioner | AWS | 2023', HINT_CERTS)}
      </Section>

      <Section
        id="extras" title="Split template extras"
        count={lineCount(form.achievements) + lineCount(form.languages) + lineCount(form.courses) + lineCount(form.timeAlloc)}
        open={open.extras} onToggle={toggle}
      >
        <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
          These fill the sidebar when the <strong>Split</strong> template is selected.
          Other templates ignore them.
        </p>

        <label htmlFor="achievements">Key achievements</label>
        {area('achievements', 'Cut deployment time 70% | Rebuilt the CI pipeline, taking releases from 40 min to 12', HINT_ACH)}

        <label htmlFor="languages">Languages</label>
        {area('languages', 'English | Native\nHindi | Advanced\nGerman | Basic', HINT_LANG)}

        <label htmlFor="courses">Training / Courses</label>
        {area('courses', 'Machine Learning Specialization | Coursera | 2024', HINT_COURSE)}

        <label htmlFor="timeAlloc">My Time (donut chart)</label>
        {area('timeAlloc', 'Data pipelines | 40\nCode review | 20\nMentoring | 15\nPlanning | 25', HINT_TIME)}
      </Section>
    </div>
  )
}
