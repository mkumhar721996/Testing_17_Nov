import type { EmergencyContactInput } from './employees.repository';

export type { EmergencyContactInput };

export type EmployeeInput = {
  fullName: string;
  jobTitle: string;
  departmentId: string;
  managerId: string;
  startDate: string;
  dateOfBirth: string | null;
  workEmail: string | null;
  phone: string | null;
  emergencyContacts: EmergencyContactInput[];
};

export type EmployeePatch = Partial<EmployeeInput>;

type Result<T> = { ok: true; value: T } | { ok: false; fieldErrors: Record<string, string> };

const REQUIRED = {
  fullName: 'Required. Enter the full name.',
  jobTitle: 'Required. Enter the job title.',
  departmentId: 'Required. Choose a department.',
  managerId: 'Required. Choose a manager.',
  startDate: 'Required. Enter the start date.',
} as const;

const OPTIONAL_TEXT = ['workEmail', 'phone'] as const;

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Hand-written so the API needs no decorator metadata or extra dependency. */
export function validateEmployeeInput(input: unknown, opts: { partial: true }): Result<EmployeePatch>;
export function validateEmployeeInput(input: unknown, opts?: { partial?: false }): Result<EmployeeInput>;
export function validateEmployeeInput(input: unknown, opts: { partial?: boolean } = {}): Result<EmployeePatch> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, fieldErrors: { body: 'Send the employee record as a JSON object.' } };
  }
  const src = input as Record<string, unknown>;
  const partial = opts.partial === true;
  const fieldErrors: Record<string, string> = {};
  const value: Record<string, unknown> = {};

  for (const [field, message] of Object.entries(REQUIRED)) {
    if (partial && !(field in src)) continue;
    const v = text(src[field]);
    if (!v) fieldErrors[field] = message;
    else if (field === 'startDate' && !isCalendarDate(v)) fieldErrors[field] = 'Enter a valid date.';
    else value[field] = v;
  }

  if (!partial || 'dateOfBirth' in src) {
    const v = text(src.dateOfBirth);
    if (v && !isCalendarDate(v)) fieldErrors.dateOfBirth = 'Enter a valid date.';
    else value.dateOfBirth = v || null;
  }
  for (const field of OPTIONAL_TEXT) {
    if (!partial || field in src) value[field] = text(src[field]) || null;
  }

  if (!partial || 'emergencyContacts' in src) {
    const raw = src.emergencyContacts ?? [];
    if (!Array.isArray(raw)) fieldErrors.emergencyContacts = 'Send emergency contacts as a list.';
    else {
      const contacts: EmergencyContactInput[] = [];
      raw.forEach((c, i) => {
        const row = (typeof c === 'object' && c !== null ? c : {}) as Record<string, unknown>;
        const contact = { name: text(row.name), relationship: text(row.relationship), phone: text(row.phone) };
        for (const key of ['name', 'relationship', 'phone'] as const) {
          if (!contact[key]) fieldErrors[`emergencyContacts.${i}.${key}`] = 'Required.';
        }
        contacts.push(contact);
      });
      value.emergencyContacts = contacts;
    }
  }

  return Object.keys(fieldErrors).length ? { ok: false, fieldErrors } : { ok: true, value };
}
