const normalizeRevision = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
};

const getScheduleRevision = (db, groupId) => {
  if (!db || !Number.isFinite(Number(groupId))) return 0;
  const row = db
    .prepare('SELECT schedule_revision FROM groups WHERE id = ?')
    .get(Number(groupId));
  return normalizeRevision(row?.schedule_revision);
};

const setScheduleRevision = (db, groupId, revision) => {
  if (!db || !Number.isFinite(Number(groupId))) return 0;
  const next = normalizeRevision(revision);
  db.prepare('UPDATE groups SET schedule_revision = ? WHERE id = ?')
    .run(next, Number(groupId));
  return next;
};

const bumpScheduleRevision = (db, groupId) => {
  const current = getScheduleRevision(db, groupId);
  return setScheduleRevision(db, groupId, current + 1);
};

module.exports = {
  getScheduleRevision,
  setScheduleRevision,
  bumpScheduleRevision
};
