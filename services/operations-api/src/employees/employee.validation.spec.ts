import { validateEmployeeInput } from './employee.validation';

const validInput = {
  fullName: 'A B',
  jobTitle: 'Engineer',
  departmentId: 'd1',
  managerId: 'm1',
  startDate: '2026-03-02',
};

describe('validateEmployeeInput (create)', () => {
  it.each(['fullName', 'jobTitle', 'departmentId', 'managerId', 'startDate'])('rejects missing %s', (field) => {
    const r = validateEmployeeInput({ ...validInput, [field]: '' });
    expect(r).toEqual({ ok: false, fieldErrors: { [field]: expect.any(String) } });
  });

  it('rejects a field that is absent or only whitespace', () => {
    const { jobTitle: _omit, ...rest } = validInput;
    expect(validateEmployeeInput(rest)).toMatchObject({ ok: false });
    expect(validateEmployeeInput({ ...validInput, fullName: '   ' })).toMatchObject({ ok: false });
  });

  it('accepts the required fields alone and defaults contacts to empty', () => {
    const r = validateEmployeeInput(validInput);
    expect(r).toEqual({
      ok: true,
      value: {
        ...validInput,
        dateOfBirth: null,
        workEmail: null,
        phone: null,
        emergencyContacts: [],
      },
    });
  });

  it('rejects a start date that is not a calendar date', () => {
    expect(validateEmployeeInput({ ...validInput, startDate: '02/03/2026' })).toMatchObject({ ok: false });
    expect(validateEmployeeInput({ ...validInput, startDate: '2026-02-30' })).toMatchObject({ ok: false });
  });

  it('keeps optional details and emergency contacts in order', () => {
    const r = validateEmployeeInput({
      ...validInput,
      dateOfBirth: '1990-07-14',
      workEmail: 'a@example.com',
      phone: '+44 7700 900123',
      emergencyContacts: [
        { name: 'Raj', relationship: 'Spouse', phone: '1' },
        { name: 'Mira', relationship: 'Sister', phone: '2' },
      ],
    });
    expect(r.ok && r.value.emergencyContacts.map((c) => c.name)).toEqual(['Raj', 'Mira']);
    expect(r.ok && r.value.dateOfBirth).toBe('1990-07-14');
  });

  it('rejects an emergency contact with a blank field', () => {
    const r = validateEmployeeInput({ ...validInput, emergencyContacts: [{ name: 'Raj', relationship: '', phone: '1' }] });
    expect(r).toEqual({ ok: false, fieldErrors: { 'emergencyContacts.0.relationship': expect.any(String) } });
  });

  it('rejects a body that is not an object', () => {
    expect(validateEmployeeInput(null)).toMatchObject({ ok: false });
  });
});

describe('validateEmployeeInput (partial)', () => {
  it('accepts only the fields given', () => {
    expect(validateEmployeeInput({ jobTitle: 'Staff Engineer' }, { partial: true })).toEqual({
      ok: true,
      value: { jobTitle: 'Staff Engineer' },
    });
  });

  it('still rejects a required field set to blank', () => {
    expect(validateEmployeeInput({ startDate: '' }, { partial: true })).toMatchObject({ ok: false });
  });

  it('allows clearing an optional field', () => {
    expect(validateEmployeeInput({ phone: null }, { partial: true })).toEqual({ ok: true, value: { phone: null } });
  });
});
