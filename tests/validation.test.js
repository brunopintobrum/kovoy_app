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
    validateTripMetaPayload,
    validateExpenseSplitPayload,
    validateGroupFlightPayload,
    validateGroupLodgingPayload,
    validateGroupTransportPayload,
    validateGroupTicketPayload,
    validateSplitSum
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

    test('validateSplitSum ensures split total matches amount', () => {
        expect(validateSplitSum(120, [{ amount: 60 }, { amount: 60 }])).toEqual({ ok: true });
        expect(validateSplitSum(100, [{ amount: 30 }, { amount: 30 }])).toEqual({
            error: 'Split totals must match the expense amount.'
        });
    });

    test('validateExpenseSplitPayload supports manual splits', () => {
        const result = validateExpenseSplitPayload({
            description: 'Tickets',
            amount: 100,
            currency: 'USD',
            date: '2026-02-22',
            category: 'Parks',
            payerParticipantId: 1,
            splitType: 'participants',
            splitMode: 'manual',
            splits: [
                { targetId: 1, amount: 60 },
                { targetId: 2, amount: 40 }
            ]
        });
        expect(result.value).toMatchObject({
            splitMode: 'manual',
            splitType: 'participants'
        });
        expect(result.value.targetIds).toEqual([1, 2]);
        expect(result.value.splits).toHaveLength(2);
    });

    test('validateExpenseSplitPayload rejects manual splits with mismatched totals', () => {
        const result = validateExpenseSplitPayload({
            description: 'Tickets',
            amount: 100,
            currency: 'USD',
            date: '2026-02-22',
            payerParticipantId: 1,
            splitType: 'participants',
            splitMode: 'manual',
            splits: [
                { targetId: 1, amount: 50 },
                { targetId: 2, amount: 30 }
            ]
        });
        expect(result).toEqual({ error: 'Split totals must match the expense amount.' });
    });

    test('validateGroupFlightPayload enforces required fields', () => {
        const result = validateGroupFlightPayload({
            airline: 'Air Canada',
            flightNumber: 'AC123',
            from: 'YUL',
            to: 'MCO',
            departAt: '2026-02-22T10:00:00Z',
            arriveAt: '2026-02-22T14:30:00Z',
            cost: 1200,
            currency: 'CAD'
        });
        expect(result.value).toMatchObject({
            airline: 'Air Canada',
            flightNumber: 'AC123',
            from: 'YUL',
            to: 'MCO',
            status: 'planned',
            cost: 1200,
            currency: 'CAD'
        });
    });

    test('validateGroupFlightPayload rejects invalid cabin class', () => {
        const result = validateGroupFlightPayload({
            airline: 'JetBlue',
            flightNumber: 'B612',
            from: 'JFK',
            to: 'MCO',
            departAt: '2026-02-22T10:00:00Z',
            arriveAt: '2026-02-22T14:30:00Z',
            cost: 400,
            currency: 'USD',
            cabinClass: 'ultra'
        });
        expect(result).toEqual({ error: 'Cabin class is invalid.' });
    });

    test('validateGroupLodgingPayload requires address and dates', () => {
        const result = validateGroupLodgingPayload({
            name: 'Resort',
            address: '123 Main St',
            checkIn: '2026-02-22',
            checkOut: '2026-02-25',
            cost: 300,
            currency: 'USD'
        });
        expect(result.value).toMatchObject({
            name: 'Resort',
            address: '123 Main St',
            cost: 300,
            currency: 'USD'
        });
    });

    test('validateGroupTransportPayload validates amount and currency', () => {
        const result = validateGroupTransportPayload({
            type: 'Shuttle',
            date: '2026-02-22',
            amount: 45,
            currency: 'USD'
        });
        expect(result.value).toMatchObject({
            type: 'Shuttle',
            amount: 45,
            currency: 'USD'
        });
    });

    test('validateGroupTicketPayload validates ticket fields', () => {
        const result = validateGroupTicketPayload({
            name: 'Theme Park',
            date: '2026-02-24',
            amount: 180,
            currency: 'USD',
            holder: 'Bruno'
        });
        expect(result.value).toMatchObject({
            name: 'Theme Park',
            amount: 180,
            currency: 'USD',
            holder: 'Bruno'
        });
    });
});
