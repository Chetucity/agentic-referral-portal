'use client'

import { useState, useMemo, useRef } from 'react'
import { getStructuredData, buildResumeHTML } from '@/lib/resume/resumeData.js'
import { downloadPDF, downloadWord, downloadPNG } from '@/lib/resume/exports.js'

function paintColor(score) {
  if (score >= 75) return '#16a34a'
  if (score >= 50) return '#d97706'
  return '#dc2626'
}

export default function CompareView({ originalFileUrl, originalRawText, lastParsed, baseForm, lastResult, gatedDownload, downloading }) {
  const [tpl, setTpl] = useState('classic')
  const afterRef = useRef(null)
  const accent = '#2563eb'

  const data = useMemo(() => {
    if (!lastParsed) return null
    return getStructuredData({ ...baseForm, ...lastParsed })
  }, [lastParsed, baseForm])

  const afterHTML = useMemo(() => {
    if (!data) return ''
    return buildResumeHTML(data)
  }, [data])

  return (
    <div className="compare-section">
      <div className="compare-header">
        <div>
          <div className="compare-heading">Before / After</div>
          <div className="compare-sub">Original upload vs. your improved resume</div>
        </div>
        <div className="pills">
          {['classic', 'modern', 'minimal'].map(t => (
            <button key={t} className={`pill ${tpl === t ? 'active' : ''}`} onClick={() => setTpl(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="compare-cols">
        {/* BEFORE — raw uploaded file */}
        <div className="compare-col">
          <div className="compare-col-header before-header">
            <span className="compare-dot before-dot" />
            <span className="compare-col-title">Original (as uploaded)</span>
            {lastResult && (
              <span className="compare-score-badge" style={{ color: paintColor(lastResult.score), borderColor: paintColor(lastResult.score) }}>
                {lastResult.score}/100
              </span>
            )}
          </div>
          <div className="compare-page-wrap">
            {originalFileUrl
              ? <iframe
                  src={originalFileUrl}
                  title="Original resume"
                  style={{ width: '100%', height: '100%', border: 'none', background: '#fff', display: 'block' }}
                />
              : originalRawText
                ? <pre className="compare-raw-text">{originalRawText}</pre>
                : <p style={{ color: '#aaa', padding: 40, textAlign: 'center' }}>Upload a resume to see the original here.</p>
            }
          </div>
        </div>

        {/* divider */}
        <div className="compare-divider">
          <div className="compare-divider-line" />
          <div className="compare-divider-arrow">→</div>
          <div className="compare-divider-line" />
        </div>

        {/* AFTER — formatted improved resume */}
        <div className="compare-col">
          <div className="compare-col-header after-header">
            <span className="compare-dot after-dot" />
            <span className="compare-col-title">Improved</span>
            {lastResult && (
              <span className="compare-score-badge" style={{ color: paintColor(lastResult.potential), borderColor: paintColor(lastResult.potential) }}>
                {lastResult.potential}/100
              </span>
            )}
          </div>
          <div className="compare-page-wrap">
            <div
              id="compare-after"
              ref={afterRef}
              className={`resume-page tpl-${tpl}`}
              style={{ '--tpl-accent': accent }}
              dangerouslySetInnerHTML={{ __html: afterHTML || '<p style="color:#aaa;padding:40px;text-align:center">Apply fixes to see the improved version here.</p>' }}
            />
          </div>
          {data && (
            <div className="compare-download-row">
              <button className="btn btn-primary" disabled={downloading} onClick={() => gatedDownload(() => downloadPDF(data, tpl, accent))}>
                {downloading ? '⏳ Downloading…' : '⬇ PDF'}
              </button>
              <button className="btn" disabled={downloading} onClick={() => gatedDownload(() => downloadWord(data, tpl, accent))}>
                {downloading ? '⏳ Downloading…' : '⬇ Word'}
              </button>
              <button className="btn" disabled={downloading} onClick={() => gatedDownload(() => downloadPNG(afterRef.current, data.name))}>
                {downloading ? '⏳ Downloading…' : '⬇ PNG'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
