const path = require('path');
const Database = require('better-sqlite3');

const resolveDbPath = () => {
    if (process.env.DB_PATH) return process.env.DB_PATH;
    return path.join(__dirname, '..', 'data', 'app.db');
};

const normalizeDisplayName = (value) => {
    return String(value || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
};

const dbPath = resolveDbPath();
const db = new Database(dbPath);

const rows = db
    .prepare('SELECT id, group_id, user_id, display_name FROM participants')
    .all();

const grouped = new Map();
rows.forEach((row) => {
    const key = `${row.group_id}::${normalizeDisplayName(row.display_name)}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
});

const deleteConflictingFlightParticipants = db.prepare(`
    DELETE FROM group_flight_participants
    WHERE participant_id = ?
      AND EXISTS (
          SELECT 1
          FROM group_flight_participants g2
          WHERE g2.participant_id = ?
            AND g2.flight_id = group_flight_participants.flight_id
      )
`);
const deleteConflictingTicketParticipants = db.prepare(`
    DELETE FROM group_ticket_participants
    WHERE participant_id = ?
      AND EXISTS (
          SELECT 1
          FROM group_ticket_participants g2
          WHERE g2.participant_id = ?
            AND g2.ticket_id = group_ticket_participants.ticket_id
      )
`);
const updateExpensePayer = db.prepare(
    'UPDATE expenses SET payer_participant_id = ? WHERE payer_participant_id = ?'
);
const updateExpenseSplits = db.prepare(
    "UPDATE expense_splits SET target_id = ? WHERE target_type = 'participant' AND target_id = ?"
);
const updateFlightParticipants = db.prepare(
    'UPDATE group_flight_participants SET participant_id = ? WHERE participant_id = ?'
);
const updateTicketParticipants = db.prepare(
    'UPDATE group_ticket_participants SET participant_id = ? WHERE participant_id = ?'
);
const deleteParticipant = db.prepare('DELETE FROM participants WHERE id = ?');
const updateParticipantUserId = db.prepare('UPDATE participants SET user_id = ? WHERE id = ?');

const mergeDuplicates = db.transaction(() => {
    let mergedCount = 0;
    grouped.forEach((participants) => {
        const withUser = participants.filter((row) => row.user_id);
        const withoutUser = participants.filter((row) => !row.user_id);
        if (withUser.length !== 1 || withoutUser.length === 0) return;
        const keeper = withUser[0];
        withoutUser.forEach((dup) => {
            deleteConflictingFlightParticipants.run(dup.id, keeper.id);
            deleteConflictingTicketParticipants.run(dup.id, keeper.id);
            updateExpensePayer.run(keeper.id, dup.id);
            updateExpenseSplits.run(keeper.id, dup.id);
            updateFlightParticipants.run(keeper.id, dup.id);
            updateTicketParticipants.run(keeper.id, dup.id);
            deleteParticipant.run(dup.id);
            mergedCount += 1;
        });
        updateParticipantUserId.run(keeper.user_id, keeper.id);
    });
    return mergedCount;
});

const merged = mergeDuplicates();
console.log(`Merged ${merged} duplicate participants in ${dbPath}`);
