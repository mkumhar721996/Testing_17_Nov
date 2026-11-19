import { MAX_BYTES, validateDocumentUpload } from './document.validation';

const TYPE_ERROR = 'This file type is not allowed. Allowed types: PDF, JPG, PNG.';
const SIZE_ERROR = 'This file is larger than the 10 MB maximum. Choose a file of 10 MB or less.';

const MAGIC = { pdf: [0x25, 0x50, 0x44, 0x46], jpg: [0xff, 0xd8, 0xff, 0xe0], png: [0x89, 0x50, 0x4e, 0x47] };

function file(originalname: string, mimetype: string, size: number, magic: number[] = MAGIC.pdf) {
  const buffer = Buffer.alloc(Math.max(size, magic.length));
  Buffer.from(magic).copy(buffer);
  return { originalname, mimetype, size, buffer };
}

describe('validateDocumentUpload', () => {
  it('accepts a PDF, JPG and PNG whose extension, type and bytes agree', () => {
    for (const f of [
      file('a.pdf', 'application/pdf', 100),
      file('a.JPG', 'image/jpeg', 100, MAGIC.jpg),
      file('a.jpeg', 'image/jpeg', 100, MAGIC.jpg),
      file('a.png', 'image/png', 100, MAGIC.png),
    ]) {
      expect(validateDocumentUpload({ docType: 'id', file: f }).ok).toBe(true);
    }
  });

  it('refuses a type that is not allowed and names the allowed types (AC7, AC8)', () => {
    const r = validateDocumentUpload({
      docType: 'contract',
      file: file('notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 100),
    });
    expect(r).toEqual({ ok: false, fieldErrors: { file: TYPE_ERROR } });
  });

  it('refuses a .pdf name whose bytes are a PNG', () => {
    const r = validateDocumentUpload({ docType: 'contract', file: file('a.pdf', 'application/pdf', 100, MAGIC.png) });
    expect(r).toEqual({ ok: false, fieldErrors: { file: TYPE_ERROR } });
  });

  it('refuses a declared type that disagrees with the extension', () => {
    const r = validateDocumentUpload({ docType: 'contract', file: file('a.pdf', 'image/png', 100) });
    expect(r).toEqual({ ok: false, fieldErrors: { file: TYPE_ERROR } });
  });

  it('refuses a file over the maximum and names the size (AC9, AC10)', () => {
    const r = validateDocumentUpload({ docType: 'contract', file: file('big.pdf', 'application/pdf', MAX_BYTES + 1) });
    expect(r).toEqual({ ok: false, fieldErrors: { file: SIZE_ERROR } });
  });

  it('accepts a file exactly at the maximum', () => {
    expect(validateDocumentUpload({ docType: 'contract', file: file('ok.pdf', 'application/pdf', MAX_BYTES) }).ok).toBe(true);
  });

  it('requires a file and a known document type', () => {
    expect(validateDocumentUpload({ docType: 'contract', file: undefined })).toMatchObject({ ok: false, fieldErrors: { file: expect.any(String) } });
    expect(validateDocumentUpload({ docType: 'passport', file: file('a.pdf', 'application/pdf', 10) })).toMatchObject({
      ok: false,
      fieldErrors: { docType: expect.any(String) },
    });
  });
});
