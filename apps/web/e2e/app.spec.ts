import { test, expect, type Page } from '@playwright/test'

const EMPLOYEE = {
  id: 'e1',
  fullName: 'Priya Raman',
  dateOfBirth: null,
  workEmail: null,
  phone: null,
  jobTitle: 'Senior Analyst',
  startDate: '2025-02-03',
  department: { id: 'fin', name: 'Finance' },
  manager: { id: 'ana', fullName: 'Ana Costa' },
  emergencyContacts: [],
}

/** Stubs the API, creates a record through the form and opens its Documents tab. */
async function openDocuments(page: Page, list: () => unknown) {
  await page.route('**/api/departments', (r) => r.fulfill({ json: [{ id: 'fin', name: 'Finance', employeeCount: 1 }] }))
  await page.route('**/api/employees/options', (r) => r.fulfill({ json: [{ id: 'ana', fullName: 'Ana Costa' }] }))
  await page.route('**/api/employees', (r) => r.fulfill({ status: 201, json: EMPLOYEE }))
  await page.route('**/api/employees/e1/documents', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: list() }) : r.fulfill({ status: 201, json: { uploaded: true } })))
  await page.goto('/')
  await page.getByLabel('Full name').fill('Priya Raman')
  await page.getByLabel('Job title').fill('Senior Analyst')
  await page.getByLabel('Department').selectOption('fin')
  await page.getByLabel('Manager').selectOption('ana')
  await page.getByLabel('Start date').fill('2025-02-03')
  await page.getByRole('button', { name: 'Create employee' }).click()
  await page.getByRole('tab', { name: 'Documents' }).click()
}

const contract = { id: 'd1', docType: 'contract', fileName: 'contract.pdf', format: 'PDF', uploadedAt: '2025-02-02T00:00:00.000Z' }

test('HR uploads a document and sees it listed', async ({ page }) => {
  let documents: unknown[] = []
  await openDocuments(page, () => ({ documents, canUpload: true }))
  await expect(page.getByText('No documents on this record yet')).toBeVisible()
  documents = [contract]
  await page.getByLabel('File').setInputFiles({ name: 'contract.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') })
  await page.getByRole('button', { name: 'Upload document' }).click()
  await expect(page.getByText('contract.pdf')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Document uploaded')
})

test('the employee sees their documents with no upload control', async ({ page }) => {
  await openDocuments(page, () => ({ documents: [contract], canUpload: false }))
  await expect(page.getByRole('heading', { name: 'My documents' })).toBeVisible()
  await expect(page.getByText('contract.pdf')).toBeVisible()
  await expect(page.getByLabel('File')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Upload document' })).toHaveCount(0)
})

test('home page shows the heading', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Web App' })).toBeVisible()
})
