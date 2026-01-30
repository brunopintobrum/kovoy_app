const { buildBalanceState, buildDebtPlan } = require('../server');

describe('group balance helpers', () => {
    test('computes participant balances from participant split', () => {
        const participants = [
            { id: 1, familyId: null, displayName: 'Bruno' },
            { id: 2, familyId: null, displayName: 'Fernanda' }
        ];
        const families = [];
        const expenses = [
            { id: 100, amount: 100, payerParticipantId: 1 }
        ];
        const expenseSplits = new Map([
            [100, [
                { targetType: 'participant', targetId: 1, amount: 50 },
                { targetType: 'participant', targetId: 2, amount: 50 }
            ]]
        ]);

        const state = buildBalanceState({
            participants,
            families,
            expenses,
            expenseSplits,
            familyBalanceMode: 'participants'
        });

        expect(state.participantBalances.get(1)).toBe(5000);
        expect(state.participantBalances.get(2)).toBe(-5000);
    });

    test('computes family balance and distributes to family participants', () => {
        const participants = [
            { id: 1, familyId: 10, displayName: 'Bruno' },
            { id: 2, familyId: 10, displayName: 'Fernanda' },
            { id: 3, familyId: 20, displayName: 'Wilton' }
        ];
        const families = [
            { id: 10, name: 'Silva' },
            { id: 20, name: 'Celia' }
        ];
        const expenses = [
            { id: 200, amount: 90, payerParticipantId: 3 }
        ];
        const expenseSplits = new Map([
            [200, [
                { targetType: 'family', targetId: 10, amount: 45 },
                { targetType: 'family', targetId: 20, amount: 45 }
            ]]
        ]);

        const state = buildBalanceState({
            participants,
            families,
            expenses,
            expenseSplits,
            familyBalanceMode: 'participants'
        });

        expect(state.familyBalances.get(10)).toBe(-4500);
        expect(state.familyBalances.get(20)).toBe(4500);
        expect(state.participantBalances.get(1)).toBe(-2250);
        expect(state.participantBalances.get(2)).toBe(-2250);
        expect(state.participantBalances.get(3)).toBe(4500);
    });

    test('computes family balance using equalized families mode', () => {
        const participants = [
            { id: 1, familyId: 10, displayName: 'Bruno' },
            { id: 2, familyId: 10, displayName: 'Fernanda' },
            { id: 3, familyId: 20, displayName: 'Wilton' }
        ];
        const families = [
            { id: 10, name: 'Silva' },
            { id: 20, name: 'Celia' }
        ];
        const expenses = [
            { id: 200, amount: 90, payerParticipantId: 3 }
        ];
        const expenseSplits = new Map([
            [200, [
                { targetType: 'participant', targetId: 1, amount: 30 },
                { targetType: 'participant', targetId: 2, amount: 30 },
                { targetType: 'participant', targetId: 3, amount: 30 }
            ]]
        ]);

        const state = buildBalanceState({
            participants,
            families,
            expenses,
            expenseSplits,
            familyBalanceMode: 'families'
        });

        expect(state.familyBalances.get(10)).toBe(-4500);
        expect(state.familyBalances.get(20)).toBe(4500);
    });

    test('builds debt plan from balances', () => {
        const balances = new Map([
            [1, 5000],
            [2, -2000],
            [3, -3000]
        ]);

        const transfers = buildDebtPlan(balances);

        expect(transfers).toEqual([
            { fromParticipantId: 3, toParticipantId: 1, amount: 30 },
            { fromParticipantId: 2, toParticipantId: 1, amount: 20 }
        ]);
    });
});
