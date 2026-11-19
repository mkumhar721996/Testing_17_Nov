export const ALLOWED_TYPES = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' } as const;
export const MAX_BYTES = 10 * 1024 * 1024;
export const DOC_TYPES = ['contract', 'id', 'certificate'] as const;

export type DocType = (typeof DOC_TYPES)[number];
export type UploadedFile = { originalname: string; mimetype: string; size: number; buffer: Buffer };
export type DocumentInput = { docType: DocType; fileName: string; contentType: string; content: Buffer };

const TYPE_ERROR = 'This file type is not allowed. Allowed types: PDF, JPG, PNG.';
export const SIZE_ERROR ='This file is larger than the 10 MB maximum. Choose a file of 10 MB or less.';

const MAGIC: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
};

/** The allowed content type when extension, declared type and leading bytes all agree; otherwise null. */
function allowedContentType(file: UploadedFile): string | null {
  const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
  const expected = (ALLOWED_TYPES as Record<string, string>)[ext];
  if (!expected || file.mimetype !== expected) return null;
  const magic = MAGIC[expected];
  return magic.every((byte, i) => file.buffer[i] === byte) ? expected : null;
}

export function validateDocumentUpload(input: {
  docType: unknown;
  file: UploadedFile | undefined;
}): { ok: true; value: DocumentInput } | { ok: false; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  const { docType, file } = input;
  if (typeof docType !== 'string' || !(DOC_TYPES as readonly string[]).includes(docType)) {
    fieldErrors.docType = 'Choose a document type: contract, ID or certificate.';
  }
  let contentType: string | null = null;
  if (!file) fieldErrors.file = 'Choose a file to upload.';
  else if (file.size > MAX_BYTES) fieldErrors.file = SIZE_ERROR;
  else if (!(contentType = allowedContentType(file))) fieldErrors.file = TYPE_ERROR;
  if (Object.keys(fieldErrors).length || !file || !contentType) return { ok: false, fieldErrors };
  return { ok: true, value: { docType: docType as DocType, fileName: file.originalname, contentType, content: file.buffer } };
}
