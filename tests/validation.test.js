/**
 * @jest-environment node
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DB_PATH = path.join(os.tmpdir(), `orlando-test-validation-${Date.now()}.db`);

const {
    db,
    splitFullName,
    normalizeDisplayName,
    validatePassword,
    validateFlightPayload,
    validateExpensePayload,
    validateTripMetaPayload
} = require('../server');

afterAll(() => {
    try {
        db.close();
    } catch (err) {
        // ignore close errors in tests
    }
    if (process.env.DB_PATH && fs.existsSync(process.env.DB_PATH)) {
        try {
            fs.unlinkSync(process.env.DB_PATH);
        } catch (err) {
            // ignore locked temp db on Windows
        }
    }
});

describe('validation helpers', () => {
    test('splitFullName handles empty, single, and multi-part names', () => {
        expect(splitFullName(null)).toEqual({ first: null, last: null });
        expect(splitFullName('  ')).toEqual({ first: null, last: null });
        expect(splitFullName('Taylor')).toEqual({ first: 'Taylor', last: 'Taylor' });
        expect(splitFullName('Taylor Swift')).toEqual({ first: 'Taylor', last: 'Swift' });
        expect(splitFullName('Taylor Alison Swift')).toEqual({
            first: 'Taylor',
            last: 'Alison Swift'
        });
    });

    test('normalizeDisplayName trims and validates length', () => {
        expect(normalizeDisplayName(null)).toEqual({ value: null });
        expect(normalizeDisplayName(123)).toEqual({ error: 'Display name must be a string.' });
        expect(normalizeDisplayName('A')).toEqual({
            error: 'Display name must be between 2 and 60 characters.'
        });
        const longName = 'a'.repeat(61);
        expect(normalizeDisplayName(longName)).toEqual({
            error: 'Display name must be between 2 and 60 characters.'
        });
        expect(normalizeDisplayName('  Kovoy  ')).toEqual({ value: 'Kovoy' });
    });

    test('validatePassword enforces strength rules', () => {
        expect(validatePassword('user@example.com', null)).toEqual(['Invalid password.']);
        expect(validatePassword('user@example.com', 'Short1!')).toContain('Password must be at least 9 characters.');
        expect(validatePassword('user@example.com', 'lowercase1!')).toContain('Password must include 1 uppercase letter.');
        expect(validatePassword('user@example.com', 'UPPERCASE1!')).toContain('Password must include 1 lowercase letter.');
        expect(validatePassword('user@example.com', 'NoNumbers!')).toContain('Password must include 1 number.');
        expect(validatePassword('user@example.com', 'NoSpecial123')).toContain('Password must include 1 special character.');
    });

    test('validateFlightPayload returns error on invalid currency', () => {
        const result = validateFlightPayload({
            airline: 'Test Airline',
            from: 'MCO',
            to: 'JFK',
            departAt: '2026-02-22T10:00:00Z',
            arriveAt: '2026-02-22T14:00:00Z',
            currency: 'EUR',
            cost: 300
        });
        expect(result).toEqual({ error: 'Currency is invalid.' });
    });

    test('validateExpensePayload normalizes optional fields', () => {
        const result = validateExpensePayload({
            category: 'Tickets',
            amount: 120,
            currency: 'USD',
            status: 'planned'
        });
        expect(result.value).toMatchObject({
            category: 'Tickets',
            amount: 120,
            currency: 'USD',
            status: 'planned',
            dueDate: null,
            group: null,
            split: null,
            notes: null
        });
    });

    test('validateTripMetaPayload falls back to current data', () => {
        const current = {
            name: 'Orlando',
            start_date: '2026-02-22',
            end_date: '2026-03-11',
            base: 'Davenport',
            family_one: 'Family One',
            family_two: 'Family Two',
            subtitle: 'Trip subtitle'
        };
        const result = validateTripMetaPayload({ name: 'Kovoy Trip' }, current);
        expect(result.value).toEqual({
            name: 'Kovoy Trip',
            startDate: current.start_date,
            endDate: current.end_date,
            base: current.base,
            familyOne: current.family_one,
            familyTwo: current.family_two,
            subtitle: current.subtitle
        });
    });
});
