import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { fetchDocumentFile, listDocuments, uploadDocument, type DocumentSummary, type DocumentType } from '../api/documents'
import { Toast } from '../components/Toast'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png']
const TYPE_ERROR = 'This file type is not allowed. Allowed types: PDF, JPG, PNG.'
const SIZE_ERROR = 'This file is larger than the 10 MB maximum. Choose a file of 10 MB or less.'

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'contract', label: 'Contract' },
  { value: 'id', label: 'ID' },
  { value: 'certificate', label: 'Certificate' },
]
const typeLabel = (t: DocumentType) => DOC_TYPES.find((d) => d.value === t)?.label ?? t

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

type Load = 'loading' | 'ready' | 'forbidden' | 'error'
type Problem = { kind: 'type' | 'size'; message: string; fileName: string } | { kind: 'refused' } | { kind: 'failed' }

const hasAllowedExtension = (name: string) => ALLOWED_EXTENSIONS.includes(name.split('.').pop()?.toLowerCase() ?? '')

/** Maps a message from the API's file field to the state the prototype draws for it. */
const fileProblem = (message: string, fileName: string): Problem => ({
  kind: message.includes('larger') ? 'size' : 'type',
  message,
  fileName,
})

type Props = { employeeId: string; employeeName: string }

export function EmployeeDocumentsPanel({ employeeId, employeeName }: Props) {
  const [load, setLoad] = useState<Load>('loading')
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [canUpload, setCanUpload] = useState(false)
  const [docType, setDocType] = useState<DocumentType>('contract')
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  const reload = useCallback(
    () =>
      listDocuments(employeeId).then(
        (res) => {
          setDocuments(res.documents)
          setCanUpload(res.canUpload)
          setLoad('ready')
        },
        (err) => setLoad(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'error'),
      ),
    [employeeId],
  )

  useEffect(() => {
    setLoad('loading')
    reload()
  }, [reload])

  async function submit() {
    if (!file) {
      setProblem({ kind: 'type', message: 'Choose a file to upload.', fileName: '' })
      return
    }
    if (!hasAllowedExtension(file.name)) return setProblem(fileProblem(TYPE_ERROR, file.name))
    if (file.size > MAX_BYTES) return setProblem(fileProblem(SIZE_ERROR, file.name))
    setProblem(null)
    setUploading(true)
    try {
      await uploadDocument(employeeId, docType, file)
      setFile(null)
      setFileKey((k) => k + 1)
      await reload()
      setToast(`Document uploaded. It is listed under Documents for ${employeeName}.`)
    } catch (err) {
      const message = err instanceof ApiError ? (err.body as { fieldErrors?: { file?: string } } | undefined)?.fieldErrors?.file : undefined
      if (err instanceof ApiError && err.status === 403) setProblem({ kind: 'refused' })
      else if (message) setProblem(fileProblem(message, file.name))
      else setProblem({ kind: 'failed' })
    } finally {
      setUploading(false)
    }
  }

  async function view(doc: DocumentSummary) {
    try {
      const blob = await fetchDocumentFile(employeeId, doc.id)
      window.open(URL.createObjectURL(blob), '_blank')
    } catch {
      setProblem({ kind: 'failed' })
    }
  }

  if (load === 'loading') {
    return (
      <div className="stack" aria-busy="true">
        <div className="card">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton skeleton-line" />
          ))}
        </div>
      </div>
    )
  }

  if (load === 'forbidden') {
    return (
      <div className="empty-state" role="alert">
        <h3>You do not have access to this employee's documents</h3>
        <p>Only HR and the employee can see them. Ask someone in HR if you need a document.</p>
      </div>
    )
  }

  if (load === 'error') {
    return (
      <div className="alert alert-danger" role="alert">
        <div className="alert-title">The documents could not be loaded.</div>
        Reload the page or try again in a moment.
      </div>
    )
  }

  const fieldProblem = problem?.kind === 'type' || problem?.kind === 'size' ? problem : null

  return (
    <div className="stack">
      {problem?.kind === 'refused' && (
        <div className="alert alert-warning" role="alert">
          <div className="alert-title">Upload refused</div>
          You cannot add documents to your own record. Ask HR to upload them.
        </div>
      )}
      {problem?.kind === 'failed' && (
        <div className="alert alert-danger" role="alert">
          <div className="alert-title">The document could not be opened or uploaded.</div>
          Try again in a moment.
        </div>
      )}
      {canUpload && (
        <section className="card">
          <h2 className="section-title">Upload a document</h2>
          {fieldProblem ? (
            <div className="alert alert-danger" role="alert">
              <div className="alert-title">The document was not uploaded.</div>
              {fieldProblem.kind === 'size' ? 'The file is too large.' : 'The file type is not allowed.'}
            </div>
          ) : (
            <p className="lead">Allowed types: PDF, JPG, PNG. Maximum size 10 MB.</p>
          )}
          <div className="grid grid-2" style={{ marginTop: 'var(--space-3)' }}>
            <div className="field">
              <label htmlFor="doc-type">Document type</label>
              <select className="select" id="doc-type" value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
                {DOC_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="doc-file">File</label>
              <input
                key={fileKey}
                className={`input${fieldProblem ? ' is-invalid' : ''}`}
                type="file"
                id="doc-file"
                accept=".pdf,.jpg,.jpeg,.png"
                aria-invalid={fieldProblem ? true : undefined}
                aria-describedby={fieldProblem ? 'doc-file-err' : undefined}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  setProblem(null)
                }}
              />
              {fieldProblem && (
                <>
                  {fieldProblem.fileName && <span className="field-hint">{fieldProblem.fileName}</span>}
                  <span className="field-error" id="doc-file-err">
                    {fieldProblem.message}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="actions-end" style={{ marginTop: 'var(--space-3)' }}>
            <button type="button" className="btn btn-primary" disabled={uploading} onClick={submit}>
              Upload document
            </button>
          </div>
        </section>
      )}
      {documents.length === 0 && canUpload ? (
        <div className="empty-state">
          <h3>No documents on this record yet</h3>
          <p>Choose a document type and file above to add the first contract, ID or certificate.</p>
        </div>
      ) : (
        <>
          <h2 className="section-title">{canUpload ? `Documents for ${employeeName}` : 'My documents'}</h2>
          <ul className="row-list">
            {documents.map((doc) => (
              <li key={doc.id} className="cluster cluster-between">
                <div className="doc-main">
                  <strong>{doc.fileName}</strong> <span className="badge badge-neutral">{typeLabel(doc.docType)}</span>
                  <span className="doc-meta">
                    {doc.format}, uploaded {formatDate(doc.uploadedAt)}
                  </span>
                </div>
                <button type="button" className="btn btn-secondary" aria-label={`View ${doc.fileName}`} onClick={() => view(doc)}>
                  View
                </button>
              </li>
            ))}
          </ul>
          {!canUpload && <p className="lead">Only you and HR can see these documents. To add one, ask HR.</p>}
        </>
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  )
}
