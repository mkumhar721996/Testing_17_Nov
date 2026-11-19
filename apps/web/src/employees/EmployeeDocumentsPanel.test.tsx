import { fireEvent, render, screen } from '@testing-library/react'
import { ApiError } from '../api/client'
import * as documents from '../api/documents'
import { EmployeeDocumentsPanel } from './EmployeeDocumentsPanel'

vi.mock('../api/documents')
const api = vi.mocked(documents)

const doc = (id: string, fileName: string, docType: documents.DocumentType = 'contract'): documents.DocumentSummary => ({
  id,
  docType,
  fileName,
  format: 'PDF',
  uploadedAt: '2025-02-02T00:00:00.000Z',
})

const TYPE_ERROR = 'This file type is not allowed. Allowed types: PDF, JPG, PNG.'
const SIZE_ERROR = 'This file is larger than the 10 MB maximum. Choose a file of 10 MB or less.'

beforeEach(() => vi.resetAllMocks())

const renderPanel = () => render(<EmployeeDocumentsPanel employeeId="e1" employeeName="Priya Raman" />)
const choose = (file: File) => fireEvent.change(screen.getByLabelText('File'), { target: { files: [file] } })
const pdf = (name = 'contract.pdf') => new File(['%PDF-1.4'], name, { type: 'application/pdf' })
const upload = () => fireEvent.click(screen.getByRole('button', { name: 'Upload document' }))

describe('EmployeeDocumentsPanel as HR', () => {
  it('uploads a document and lists it (AC1)', async () => {
    api.listDocuments.mockResolvedValueOnce({ documents: [], canUpload: true })
    api.uploadDocument.mockResolvedValue({ uploaded: true })
    renderPanel()
    await screen.findByText('No documents on this record yet')
    api.listDocuments.mockResolvedValueOnce({ documents: [doc('d1', 'contract.pdf')], canUpload: true })
    choose(pdf())
    upload()
    expect(await screen.findByText('contract.pdf')).toBeInTheDocument()
    expect(api.uploadDocument).toHaveBeenCalledWith('e1', 'contract', expect.any(File))
    expect(screen.getByRole('status')).toHaveTextContent('Document uploaded. It is listed under Documents for Priya Raman.')
  })

  it('lists every document with a View control (AC2)', async () => {
    api.listDocuments.mockResolvedValue({ documents: [doc('d1', 'a.pdf'), doc('d2', 'b.pdf', 'id')], canUpload: true })
    renderPanel()
    await screen.findByText('a.pdf')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Documents for Priya Raman' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View b.pdf' })).toBeInTheDocument()
    expect(screen.getAllByText('PDF, uploaded 2 Feb 2025')).toHaveLength(2)
  })

  it('opens a document through a fetched blob', async () => {
    api.listDocuments.mockResolvedValue({ documents: [doc('d1', 'a.pdf')], canUpload: true })
    api.fetchDocumentFile.mockResolvedValue(new Blob(['x']))
    const createObjectURL = vi.fn().mockReturnValue('blob:doc')
    const open = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL }))
    vi.stubGlobal('open', open)
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'View a.pdf' }))
    await vi.waitFor(() => expect(open).toHaveBeenCalledWith('blob:doc', '_blank'))
    expect(api.fetchDocumentFile).toHaveBeenCalledWith('e1', 'd1')
    vi.unstubAllGlobals()
  })

  it('refuses a type that is not allowed, naming the allowed types, and keeps the file name (AC7, AC8)', async () => {
    api.listDocuments.mockResolvedValue({ documents: [], canUpload: true })
    renderPanel()
    await screen.findByLabelText('File')
    choose(new File(['x'], 'notes.docx', { type: 'application/msword' }))
    upload()
    expect(screen.getByRole('alert')).toHaveTextContent('The document was not uploaded.')
    expect(screen.getByText(/Allowed types: PDF, JPG, PNG\./)).toBeInTheDocument()
    expect(screen.getByLabelText('File')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('notes.docx')).toBeInTheDocument()
    expect(api.uploadDocument).not.toHaveBeenCalled()
  })

  it('shows the API message when the server refuses the type (AC8)', async () => {
    api.listDocuments.mockResolvedValue({ documents: [], canUpload: true })
    api.uploadDocument.mockRejectedValue(new ApiError(422, { fieldErrors: { file: TYPE_ERROR } }))
    renderPanel()
    await screen.findByLabelText('File')
    choose(pdf('fake.pdf'))
    upload()
    expect(await screen.findByText(TYPE_ERROR)).toBeInTheDocument()
    expect(screen.getByText('The file type is not allowed.')).toBeInTheDocument()
  })

  it('names the maximum size when the file is too large (AC10)', async () => {
    api.listDocuments.mockResolvedValue({ documents: [], canUpload: true })
    renderPanel()
    await screen.findByLabelText('File')
    const big = pdf('big.pdf')
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 })
    choose(big)
    upload()
    expect(screen.getByText(SIZE_ERROR)).toBeInTheDocument()
    expect(screen.getByText('The file is too large.')).toBeInTheDocument()
    expect(screen.getByText(/10 MB maximum/)).toBeInTheDocument()
    expect(api.uploadDocument).not.toHaveBeenCalled()
  })
})

describe('EmployeeDocumentsPanel as the employee', () => {
  it('lists their own documents with no upload control (AC3, AC4)', async () => {
    api.listDocuments.mockResolvedValue({ documents: [doc('d1', 'a.pdf'), doc('d2', 'b.pdf')], canUpload: false })
    renderPanel()
    expect(await screen.findByRole('heading', { name: 'My documents' })).toBeInTheDocument()
    expect(screen.getByText('a.pdf')).toBeInTheDocument()
    expect(screen.getByText('b.pdf')).toBeInTheDocument()
    expect(screen.queryByLabelText('File')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Upload document' })).not.toBeInTheDocument()
    expect(screen.getByText('Only you and HR can see these documents. To add one, ask HR.')).toBeInTheDocument()
  })
})

describe('EmployeeDocumentsPanel refusals', () => {
  it('says the upload was refused when the server answers 403 (AC5)', async () => {
    api.listDocuments.mockResolvedValue({ documents: [], canUpload: true })
    api.uploadDocument.mockRejectedValue(new ApiError(403, {}))
    renderPanel()
    await screen.findByLabelText('File')
    choose(pdf())
    upload()
    expect(await screen.findByText('Upload refused')).toBeInTheDocument()
    expect(screen.getByText('You cannot add documents to your own record. Ask HR to upload them.')).toBeInTheDocument()
  })

  it('shows no documents when the list is forbidden (AC6)', async () => {
    api.listDocuments.mockRejectedValue(new ApiError(403, {}))
    renderPanel()
    expect(await screen.findByText("You do not have access to this employee's documents")).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('shows a generic failure when the list cannot be loaded', async () => {
    api.listDocuments.mockRejectedValue(new ApiError(500, {}))
    renderPanel()
    expect(await screen.findByText('The documents could not be loaded.')).toBeInTheDocument()
  })
})
