import { apiFetch, apiFetchBlob } from './client'

export type DocumentType = 'contract' | 'id' | 'certificate'

export type DocumentSummary = { id: string; docType: DocumentType; fileName: string; format: string; uploadedAt: string }

export const listDocuments = (employeeId: string) =>
  apiFetch<{ documents: DocumentSummary[]; canUpload: boolean }>(`/employees/${employeeId}/documents`)

export function uploadDocument(employeeId: string, docType: string, file: File) {
  const form = new FormData()
  form.append('docType', docType)
  form.append('file', file)
  return apiFetch<{ uploaded: true }>(`/employees/${employeeId}/documents`, { method: 'POST', body: form })
}

export const fetchDocumentFile = (employeeId: string, id: string): Promise<Blob> =>
  apiFetchBlob(`/employees/${employeeId}/documents/${id}/content`)
