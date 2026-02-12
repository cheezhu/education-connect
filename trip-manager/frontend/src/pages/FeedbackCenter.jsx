import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Empty,
  Form,
  Input,
  List,
  Popconfirm,
  Select,
  Typography,
  message
} from 'antd';
import {
  DeleteOutlined,
  LikeFilled,
  LikeOutlined,
  MessageOutlined,
  PushpinFilled,
  PushpinOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import './FeedbackCenter.css';

const { Text, Title } = Typography;
const { TextArea } = Input;

const STATUS_OPTIONS = [
  { value: 'open', label: '待处理' },
  { value: 'in_review', label: '处理中' },
  { value: 'planned', label: '已计划' },
  { value: 'resolved', label: '已解决' },
  { value: 'rejected', label: '已拒绝' }
];

const STATUS_META = {
  open: { label: '待处理', color: 'default' },
  in_review: { label: '处理中', color: 'processing' },
  planned: { label: '已计划', color: 'purple' },
  resolved: { label: '已解决', color: 'success' },
  rejected: { label: '已拒绝', color: 'warning' }
};

const MENTION_TOKEN_RE = /(@[\u4e00-\u9fa5A-Za-z0-9_]{1,32})/g;
const MENTION_EXACT_RE = /^@[\u4e00-\u9fa5A-Za-z0-9_]{1,32}$/;

const formatTime = (value) => {
  if (!value) return '-';
  const dt = dayjs(value);
  if (!dt.isValid()) return String(value);
  return dt.format('MM-DD HH:mm');
};

const buildAutoTitle = (content) => {
  const lines = String(content || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines[0] || '';
  return (firstLine || '意见反馈').slice(0, 60);
};

const renderMentionText = (text) => {
  const source = String(text || '');
  if (!source) {
    return null;
  }

  return source.split(/\r?\n/).map((line, lineIndex, lines) => (
    <React.Fragment key={`line-${lineIndex}`}>
      {line.split(MENTION_TOKEN_RE).map((part, partIndex) => {
        if (!part) return null;
        if (MENTION_EXACT_RE.test(part)) {
          return (
            <span key={`part-${lineIndex}-${partIndex}`} className="mention-token">
              {part}
            </span>
          );
        }
        return <React.Fragment key={`part-${lineIndex}-${partIndex}`}>{part}</React.Fragment>;
      })}
      {lineIndex < lines.length - 1 && <br />}
    </React.Fragment>
  ));
};

const getInitial = (name) => {
  const text = String(name || '').trim();
  return text ? text.slice(0, 1).toUpperCase() : '?';
};

const FeedbackCenter = () => {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [creating, setCreating] = useState(false);
  const [replying, setReplying] = useState(false);

  const [expandedPostId, setExpandedPostId] = useState(null);
  const [expandedPost, setExpandedPost] = useState(null);

  const [createForm] = Form.useForm();
  const [replyForm] = Form.useForm();

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const response = await api.get('/feedback');
      const nextPosts = Array.isArray(response.data) ? response.data : [];
      setPosts(nextPosts);

      if (expandedPostId && !nextPosts.some((item) => item.id === expandedPostId)) {
        setExpandedPostId(null);
        setExpandedPost(null);
      }
    } catch (error) {
      message.error('加载反馈列表失败');
    } finally {
      setLoadingPosts(false);
    }
  }, [expandedPostId]);

  const loadThread = useCallback(async (postId) => {
    if (!postId) {
      setExpandedPost(null);
      return;
    }
    setLoadingThread(true);
    try {
      const response = await api.get(`/feedback/${postId}`);
      setExpandedPost(response.data || null);
    } catch (error) {
      message.error('加载讨论失败');
      setExpandedPost(null);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (expandedPostId) {
      loadThread(expandedPostId);
    }
  }, [expandedPostId, loadThread]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      const content = String(values.content || '').trim();
      const title = buildAutoTitle(content);

      setCreating(true);
      const response = await api.post('/feedback', {
        title,
        content,
        moduleKey: 'other'
      });
      message.success('已发布');
      createForm.resetFields();
      await loadPosts();

      const createdId = response?.data?.id;
      if (createdId) {
        setExpandedPostId(createdId);
      }
    } catch (error) {
      if (!error?.errorFields) {
        message.error('发布失败');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleToggleExpand = async (postId) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      setExpandedPost(null);
      return;
    }
    setExpandedPostId(postId);
  };

  const handleReply = async () => {
    if (!expandedPostId) return;
    try {
      const values = await replyForm.validateFields();
      setReplying(true);
      await api.post(`/feedback/${expandedPostId}/comments`, { content: values.content });
      replyForm.resetFields();
      await loadPosts();
      await loadThread(expandedPostId);
      message.success('回复已发送');
    } catch (error) {
      if (!error?.errorFields) {
        message.error('发送失败');
      }
    } finally {
      setReplying(false);
    }
  };

  const handleLikeToggle = async (postId) => {
    try {
      await api.post(`/feedback/${postId}/reactions/like`);
      await loadPosts();
      if (expandedPostId === postId) {
        await loadThread(postId);
      }
    } catch (error) {
      message.error('点赞失败');
    }
  };

  const handleStatusChange = async (status) => {
    if (!isAdmin || !expandedPostId) return;
    try {
      await api.patch(`/feedback/${expandedPostId}/status`, { status });
      await loadPosts();
      await loadThread(expandedPostId);
      message.success('状态已更新');
    } catch (error) {
      message.error('更新状态失败');
    }
  };

  const handlePinToggle = async () => {
    if (!isAdmin || !expandedPostId || !expandedPost) return;
    try {
      await api.patch(`/feedback/${expandedPostId}/pin`, {
        isPinned: !expandedPost.isPinned
      });
      await loadPosts();
      await loadThread(expandedPostId);
    } catch (error) {
      message.error('更新置顶失败');
    }
  };

  const handleDelete = async (postId) => {
    try {
      await api.delete(`/feedback/${postId}`);
      message.success('已删除');
      if (expandedPostId === postId) {
        setExpandedPostId(null);
        setExpandedPost(null);
      }
      await loadPosts();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const totalCountText = useMemo(() => `共 ${posts.length} 条`, [posts.length]);

  return (
    <div className="feedback-stream-page">
      <div className="feedback-stream">
        <div className="feedback-stream-header">
          <Title level={4} style={{ margin: 0 }}>意见反馈</Title>
          <Text type="secondary">内部留言流 · {totalCountText}</Text>
        </div>

        <div className="compose-box">
          <Form form={createForm} layout="vertical">
            <Form.Item
              name="content"
              style={{ marginBottom: 8 }}
              rules={[{ required: true, message: '请输入内容' }]}
            >
              <TextArea
                rows={3}
                maxLength={5000}
                placeholder="像发动态一样写你的问题或建议。"
              />
            </Form.Item>
            <div className="compose-actions">
              <Button type="primary" icon={<MessageOutlined />} loading={creating} onClick={handleCreate}>
                发布
              </Button>
            </div>
          </Form>
        </div>

        <List
          loading={loadingPosts}
          dataSource={posts}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无反馈" /> }}
          renderItem={(post) => {
            const expanded = expandedPostId === post.id;
            const thread = expanded ? expandedPost : null;
            const canDelete = isAdmin || post.createdBy === user?.username;
            const statusMeta = STATUS_META[post.status] || STATUS_META.open;

            return (
              <List.Item className={`feed-item ${expanded ? 'expanded' : ''}`}>
                <div className="feed-item-avatar">{getInitial(post.createdByName || post.createdBy)}</div>
                <div className="feed-item-main">
                  <div className="feed-item-head">
                    <Text strong>{post.createdByName || post.createdBy}</Text>
                    <span className="feed-sep">·</span>
                    <Text type="secondary">{formatTime(post.createdAt)}</Text>
                    {post.isPinned ? (
                      <>
                        <span className="feed-sep">·</span>
                        <span className="feed-meta-label">置顶</span>
                      </>
                    ) : null}
                  </div>

                  <div className="feed-item-submeta">
                    <span className={`status-dot status-${post.status}`} />
                    <span>{statusMeta.label}</span>
                  </div>

                  <div className="feed-item-topic">{post.title}</div>
                  <div className={`feed-item-content ${expanded ? '' : 'collapsed'}`}>
                    {renderMentionText(expanded && thread?.content ? thread.content : post.content)}
                  </div>

                  <div className="feed-item-actions">
                    <Badge count={post.likeCount} size="small" offset={[-2, 2]} className="icon-badge">
                      <Button
                        type="text"
                        className="icon-action-btn"
                        icon={post.likedByMe ? <LikeFilled /> : <LikeOutlined />}
                        onClick={() => handleLikeToggle(post.id)}
                        title="点赞"
                      />
                    </Badge>
                    <Badge count={post.commentCount} size="small" offset={[-2, 2]} className="icon-badge">
                      <Button
                        type="text"
                        className="icon-action-btn"
                        icon={<MessageOutlined />}
                        onClick={() => handleToggleExpand(post.id)}
                        title={expanded ? '收起回复' : '展开回复'}
                      />
                    </Badge>
                    {canDelete && (
                      <Popconfirm
                        title="确认删除这条反馈？"
                        okText="删除"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => handleDelete(post.id)}
                      >
                        <Button type="text" className="icon-action-btn" icon={<DeleteOutlined />} danger title="删除" />
                      </Popconfirm>
                    )}
                    {isAdmin && expanded && (
                      <Select
                        value={thread?.status || post.status}
                        options={STATUS_OPTIONS.filter((item) => item.value !== 'all')}
                        onChange={handleStatusChange}
                        size="small"
                        style={{ width: 115 }}
                      />
                    )}
                    {isAdmin && expanded && (
                      <Button
                        type="text"
                        className="icon-action-btn"
                        icon={(thread?.isPinned || post.isPinned) ? <PushpinFilled /> : <PushpinOutlined />}
                        onClick={handlePinToggle}
                        title={(thread?.isPinned || post.isPinned) ? '取消置顶' : '置顶'}
                      />
                    )}
                  </div>

                  {expanded && (
                    <div className="thread-panel">
                      <List
                        loading={loadingThread}
                        dataSource={thread?.comments || []}
                        locale={{ emptyText: '暂无回复' }}
                        renderItem={(comment) => (
                          <List.Item className="thread-comment">
                            <div className="thread-comment-layout">
                              <div className="thread-comment-rail">
                                <span className="thread-comment-dot" />
                                <span className="thread-comment-line" />
                              </div>
                              <div className="thread-comment-inner">
                                <div className="thread-comment-head">
                                  <Text strong>{comment.createdByName || comment.createdBy}</Text>
                                  {comment.isAdminReply ? <span className="admin-badge">管理员</span> : null}
                                  <span className="feed-sep">·</span>
                                  <Text type="secondary">{formatTime(comment.createdAt)}</Text>
                                </div>
                                <div className="thread-comment-content">
                                  {renderMentionText(comment.content)}
                                </div>
                              </div>
                            </div>
                          </List.Item>
                        )}
                      />

                      <Form form={replyForm} layout="vertical" className="thread-reply-form">
                        <Form.Item
                          name="content"
                          style={{ marginBottom: 8 }}
                          rules={[{ required: true, message: '请输入回复内容' }]}
                        >
                          <TextArea rows={2} maxLength={5000} placeholder="写下你的回复..." />
                        </Form.Item>
                        <Button type="primary" loading={replying} onClick={handleReply}>
                          发送回复
                        </Button>
                      </Form>
                    </div>
                  )}
                </div>
              </List.Item>
            );
          }}
        />
      </div>
    </div>
  );
};

export default FeedbackCenter;
