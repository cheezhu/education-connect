const express = require('express');
const { resolveUserRecord } = require('../middleware/permission');

const router = express.Router();

const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 5000;
const STATUS_OPTIONS = new Set(['open', 'in_review', 'planned', 'resolved', 'rejected']);
const MODULE_OPTIONS = new Set(['groups', 'designer', 'locations', 'users', 'settings', 'other']);

const toText = (value, maxLength = MAX_CONTENT_LENGTH) => String(value ?? '').trim().slice(0, maxLength);
const toBoolean = (value) => value === true || value === 1 || value === '1' || value === 'true';

const mapPost = (row) => ({
  id: row.id,
  title: row.title,
  content: row.content,
  moduleKey: row.module_key,
  status: row.status,
  isPinned: Boolean(row.is_pinned),
  createdBy: row.created_by,
  createdByName: row.created_by_name || row.created_by,
  createdByRole: row.created_by_role || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  resolvedAt: row.resolved_at,
  commentCount: Number(row.comment_count || 0),
  likeCount: Number(row.like_count || 0),
  likedByMe: Boolean(row.liked_by_me),
  lastActivityAt: row.last_activity_at || row.updated_at
});

const mapComment = (row) => ({
  id: row.id,
  postId: row.post_id,
  content: row.content,
  createdBy: row.created_by,
  createdByName: row.created_by_name || row.created_by,
  createdByRole: row.created_by_role || null,
  isAdminReply: Boolean(row.is_admin_reply),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const getPostBaseSql = () => `
  SELECT
    p.id,
    p.title,
    p.content,
    p.module_key,
    p.status,
    p.is_pinned,
    p.created_by,
    p.created_at,
    p.updated_at,
    p.resolved_at,
    COALESCE(u.display_name, p.created_by) AS created_by_name,
    COALESCE(u.role, '') AS created_by_role,
    (SELECT COUNT(1) FROM feedback_comments c WHERE c.post_id = p.id) AS comment_count,
    (SELECT COUNT(1) FROM feedback_reactions r WHERE r.post_id = p.id AND r.reaction_type = 'like') AS like_count,
    EXISTS(
      SELECT 1
      FROM feedback_reactions r2
      WHERE r2.post_id = p.id
        AND r2.username = @viewer
        AND r2.reaction_type = 'like'
    ) AS liked_by_me,
    COALESCE(
      (SELECT MAX(c2.created_at) FROM feedback_comments c2 WHERE c2.post_id = p.id),
      p.updated_at
    ) AS last_activity_at
  FROM feedback_posts p
  LEFT JOIN users u ON u.username = p.created_by
`;

const getPostById = (db, postId, viewer) => {
  const row = db.prepare(`
    ${getPostBaseSql()}
    WHERE p.id = @postId
    LIMIT 1
  `).get({
    viewer: viewer || '',
    postId
  });

  if (!row) {
    return null;
  }

  const comments = db.prepare(`
    SELECT
      c.id,
      c.post_id,
      c.content,
      c.created_by,
      c.is_admin_reply,
      c.created_at,
      c.updated_at,
      COALESCE(u.display_name, c.created_by) AS created_by_name,
      COALESCE(u.role, '') AS created_by_role
    FROM feedback_comments c
    LEFT JOIN users u ON u.username = c.created_by
    WHERE c.post_id = ?
    ORDER BY datetime(c.created_at) ASC, c.id ASC
  `).all(postId).map(mapComment);

  return {
    ...mapPost(row),
    comments
  };
};

const requireAdmin = (req, res) => {
  const currentUser = resolveUserRecord(req);
  if (!currentUser || currentUser.role !== 'admin') {
    res.status(403).json({ error: '仅管理员可执行此操作' });
    return null;
  }
  return currentUser;
};

router.get('/', (req, res) => {
  const currentUser = resolveUserRecord(req);
  const status = toText(req.query?.status, 32).toLowerCase();
  const moduleKey = toText(req.query?.moduleKey || req.query?.module, 32).toLowerCase();
  const keyword = toText(req.query?.q || req.query?.keyword, 80);

  if (status && status !== 'all' && !STATUS_OPTIONS.has(status)) {
    return res.status(400).json({ error: '无效状态筛选' });
  }
  if (moduleKey && moduleKey !== 'all' && !MODULE_OPTIONS.has(moduleKey)) {
    return res.status(400).json({ error: '无效模块筛选' });
  }

  const where = [];
  const params = {
    viewer: currentUser?.username || ''
  };

  if (status && status !== 'all') {
    where.push('p.status = @status');
    params.status = status;
  }
  if (moduleKey && moduleKey !== 'all') {
    where.push('p.module_key = @moduleKey');
    params.moduleKey = moduleKey;
  }
  if (keyword) {
    where.push('(p.title LIKE @keyword OR p.content LIKE @keyword)');
    params.keyword = `%${keyword}%`;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = req.db.prepare(`
    ${getPostBaseSql()}
    ${whereSql}
    ORDER BY p.is_pinned DESC, datetime(last_activity_at) DESC, p.id DESC
    LIMIT 200
  `).all(params);

  res.json(rows.map(mapPost));
});

router.get('/:id', (req, res) => {
  const currentUser = resolveUserRecord(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: '无效反馈ID' });
  }

  const detail = getPostById(req.db, id, currentUser?.username);
  if (!detail) {
    return res.status(404).json({ error: '反馈不存在' });
  }
  res.json(detail);
});

router.post('/', (req, res) => {
  const currentUser = resolveUserRecord(req);
  if (!currentUser) {
    return res.status(401).json({ error: '未登录' });
  }

  const title = toText(req.body?.title, MAX_TITLE_LENGTH);
  const content = toText(req.body?.content, MAX_CONTENT_LENGTH);
  const moduleKey = toText(req.body?.moduleKey || req.body?.module, 32).toLowerCase() || 'other';

  if (!title) {
    return res.status(400).json({ error: '标题不能为空' });
  }
  if (!content) {
    return res.status(400).json({ error: '内容不能为空' });
  }
  if (!MODULE_OPTIONS.has(moduleKey)) {
    return res.status(400).json({ error: '模块无效' });
  }

  const created = req.db.prepare(`
    INSERT INTO feedback_posts (
      title,
      content,
      module_key,
      status,
      is_pinned,
      created_by
    ) VALUES (?, ?, ?, 'open', 0, ?)
  `).run(title, content, moduleKey, currentUser.username);

  const detail = getPostById(req.db, Number(created.lastInsertRowid), currentUser.username);
  res.status(201).json(detail);
});

router.post('/:id/comments', (req, res) => {
  const currentUser = resolveUserRecord(req);
  if (!currentUser) {
    return res.status(401).json({ error: '未登录' });
  }

  const postId = Number(req.params.id);
  if (!Number.isFinite(postId)) {
    return res.status(400).json({ error: '无效反馈ID' });
  }

  const exists = req.db.prepare('SELECT id FROM feedback_posts WHERE id = ?').get(postId);
  if (!exists) {
    return res.status(404).json({ error: '反馈不存在' });
  }

  const content = toText(req.body?.content, MAX_CONTENT_LENGTH);
  if (!content) {
    return res.status(400).json({ error: '回复内容不能为空' });
  }

  req.db.prepare(`
    INSERT INTO feedback_comments (
      post_id,
      content,
      created_by,
      is_admin_reply
    ) VALUES (?, ?, ?, ?)
  `).run(postId, content, currentUser.username, currentUser.role === 'admin' ? 1 : 0);

  req.db.prepare(`
    UPDATE feedback_posts
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(postId);

  const detail = getPostById(req.db, postId, currentUser.username);
  res.json(detail);
});

router.patch('/:id/status', (req, res) => {
  const currentUser = requireAdmin(req, res);
  if (!currentUser) {
    return;
  }

  const postId = Number(req.params.id);
  if (!Number.isFinite(postId)) {
    return res.status(400).json({ error: '无效反馈ID' });
  }

  const status = toText(req.body?.status, 32).toLowerCase();
  if (!STATUS_OPTIONS.has(status)) {
    return res.status(400).json({ error: '状态无效' });
  }

  const result = req.db.prepare(`
    UPDATE feedback_posts
    SET
      status = ?,
      updated_at = CURRENT_TIMESTAMP,
      resolved_at = CASE WHEN ? = 'resolved' THEN CURRENT_TIMESTAMP ELSE NULL END
    WHERE id = ?
  `).run(status, status, postId);

  if (!result.changes) {
    return res.status(404).json({ error: '反馈不存在' });
  }

  const detail = getPostById(req.db, postId, currentUser.username);
  res.json(detail);
});

router.patch('/:id/pin', (req, res) => {
  const currentUser = requireAdmin(req, res);
  if (!currentUser) {
    return;
  }

  const postId = Number(req.params.id);
  if (!Number.isFinite(postId)) {
    return res.status(400).json({ error: '无效反馈ID' });
  }

  const isPinned = toBoolean(req.body?.isPinned) ? 1 : 0;
  const result = req.db.prepare(`
    UPDATE feedback_posts
    SET
      is_pinned = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(isPinned, postId);

  if (!result.changes) {
    return res.status(404).json({ error: '反馈不存在' });
  }

  const detail = getPostById(req.db, postId, currentUser.username);
  res.json(detail);
});

router.post('/:id/reactions/like', (req, res) => {
  const currentUser = resolveUserRecord(req);
  if (!currentUser) {
    return res.status(401).json({ error: '未登录' });
  }

  const postId = Number(req.params.id);
  if (!Number.isFinite(postId)) {
    return res.status(400).json({ error: '无效反馈ID' });
  }

  const exists = req.db.prepare('SELECT id FROM feedback_posts WHERE id = ?').get(postId);
  if (!exists) {
    return res.status(404).json({ error: '反馈不存在' });
  }

  const alreadyLiked = req.db.prepare(`
    SELECT id
    FROM feedback_reactions
    WHERE post_id = ? AND username = ? AND reaction_type = 'like'
    LIMIT 1
  `).get(postId, currentUser.username);

  if (alreadyLiked) {
    req.db.prepare('DELETE FROM feedback_reactions WHERE id = ?').run(alreadyLiked.id);
  } else {
    req.db.prepare(`
      INSERT INTO feedback_reactions (post_id, username, reaction_type)
      VALUES (?, ?, 'like')
    `).run(postId, currentUser.username);
  }

  const detail = getPostById(req.db, postId, currentUser.username);
  res.json({
    liked: !alreadyLiked,
    likeCount: detail?.likeCount || 0
  });
});

router.delete('/:id', (req, res) => {
  const currentUser = resolveUserRecord(req);
  if (!currentUser) {
    return res.status(401).json({ error: '未登录' });
  }

  const postId = Number(req.params.id);
  if (!Number.isFinite(postId)) {
    return res.status(400).json({ error: '无效反馈ID' });
  }

  const post = req.db.prepare('SELECT id, created_by FROM feedback_posts WHERE id = ?').get(postId);
  if (!post) {
    return res.status(404).json({ error: '反馈不存在' });
  }

  const canDelete = currentUser.role === 'admin' || post.created_by === currentUser.username;
  if (!canDelete) {
    return res.status(403).json({ error: '只能删除自己创建的反馈' });
  }

  req.db.prepare('DELETE FROM feedback_posts WHERE id = ?').run(postId);
  res.json({ success: true });
});

module.exports = router;
