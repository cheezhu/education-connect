import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import PropertyGrid from './PropertyGrid';
import {
  MAX_NOTE_IMAGE_COUNT,
  MAX_NOTE_IMAGE_SIZE,
  MAX_NOTE_IMAGE_TOTAL_CHARS,
  buildBaseProperties,
  buildDateValue,
  extractPlanLocationIds,
  isDraftValid,
  mergeCustomProperties,
  normalizeManualMustVisitLocationIds,
  normalizeNotes,
  normalizeNotesImages,
  parseDateRangeInput,
  readFileAsDataUrl
} from './profileUtils';
import { PROFILE_TEXT, UNNAMED_GROUP_NAME } from '../../constants';

const ProfileView = ({
  group,
  itineraryPlans = [],
  locations = [],
  onUpdate,
  onDelete,
  hasMembers
}) => {
  const [draft, setDraft] = useState(group || null);
  const [properties, setProperties] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const imageInputRef = useRef(null);
  const hydrateRef = useRef(false);
  const debounceRef = useRef(null);
  const lastDraftRef = useRef(null);

  useEffect(() => {
    if (!group) {
      setDraft(null);
      setProperties([]);
      setUploadError('');
      setPreviewImage('');
      return;
    }
    hydrateRef.current = true;
    setDraft({
      ...group,
      notes: normalizeNotes(group.notes),
      notes_images: normalizeNotesImages(group.notes_images)
    });
    setUploadError('');
    setPreviewImage('');
    const base = buildBaseProperties(group, hasMembers);
    setProperties(mergeCustomProperties(base, group.properties));
  }, [group?.id, hasMembers]);

  useEffect(() => {
    if (!group?.id || !onUpdate) return;
    if (hydrateRef.current) {
      hydrateRef.current = false;
      lastDraftRef.current = draft;
      return;
    }
    if (lastDraftRef.current === draft) {
      return;
    }
    if (!isDraftValid(draft)) {
      return;
    }
    clearTimeout(debounceRef.current);
    lastDraftRef.current = draft;
    debounceRef.current = setTimeout(() => {
      onUpdate({ ...draft, properties });
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [draft, group?.id, onUpdate, properties]);

  const noteImages = useMemo(() => normalizeNotesImages(draft?.notes_images), [draft?.notes_images]);

  if (!group || !draft) {
    return (
      <div className="profile-layout profile-doc">
          <div className="profile-center">
          <div className="empty-state">{PROFILE_TEXT.emptyState}</div>
        </div>
      </div>
    );
  }

  const handleNameChange = (value) => {
    setDraft((prev) => ({ ...prev, name: value }));
  };

  const handleNameBlur = () => {
    const current = String(draft?.name || '').trim();
    if (current) return;
    setDraft((prev) => ({ ...prev, name: UNNAMED_GROUP_NAME }));
  };

  const handleStatusChange = (value) => {
    setDraft((prev) => ({ ...prev, status: value || null }));
  };

  const handleOpenImagePicker = () => {
    imageInputRef.current?.click();
  };

  const handleUploadImages = async (event) => {
    const files = Array.from(event.target?.files || []);
    // Allow selecting the same file again.
    event.target.value = '';
    if (!files.length) return;

    const currentImages = normalizeNotesImages(draft?.notes_images);
    const remain = Math.max(0, MAX_NOTE_IMAGE_COUNT - currentImages.length);
    if (remain <= 0) {
      setUploadError('Max ' + MAX_NOTE_IMAGE_COUNT + ' images.');
      return;
    }

    const selected = files.slice(0, remain);
    const hasNonImage = selected.some((file) => !String(file.type || '').startsWith('image/'));
    if (hasNonImage) {
      setUploadError('Only image files are supported.');
      return;
    }

    const tooLarge = selected.some((file) => Number(file.size || 0) > MAX_NOTE_IMAGE_SIZE);
    if (tooLarge) {
      setUploadError('Each image must be <= ' + Math.round(MAX_NOTE_IMAGE_SIZE / (1024 * 1024)) + 'MB.');
      return;
    }

    try {
      const uploaded = await Promise.all(selected.map((file) => readFileAsDataUrl(file)));
      const combined = [...currentImages, ...uploaded];
      const totalChars = combined.reduce((acc, item) => acc + String(item || '').length, 0);
      if (totalChars > MAX_NOTE_IMAGE_TOTAL_CHARS) {
        setUploadError('Total image size is too large. Please upload fewer/smaller images.');
        return;
      }
      setDraft((prev) => ({
        ...prev,
        notes_images: [...normalizeNotesImages(prev?.notes_images), ...uploaded]
      }));
      setUploadError('');
    } catch (error) {
      setUploadError('Failed to read image files.');
    }
  };

  const handleRemoveImage = (index) => {
    setDraft((prev) => {
      const nextImages = normalizeNotesImages(prev?.notes_images).filter((_, idx) => idx !== index);
      return { ...prev, notes_images: nextImages };
    });
  };

  const handlePreviewImage = (url) => {
    if (!url) return;
    setPreviewImage(url);
  };

  const handleDeleteGroup = () => {
    if (!group?.id || !onDelete) return;
    const name = draft?.name || group?.name || ('#' + group.id);
    const confirmed = window.confirm(PROFILE_TEXT.deleteGroupConfirm(name));
    if (!confirmed) return;
    onDelete();
  };

  const handlePropertyUpdate = (id, updates) => {
    setProperties((prev) => {
      let next = prev.map((prop) => (prop.id === id ? { ...prop, ...updates } : prop));
      const updated = next.find((prop) => prop.id === id);
      if (!updated) return next;

      if (updates.value !== undefined) {
        setDraft((prevDraft) => {
          if (!prevDraft) return prevDraft;
          const nextDraft = { ...prevDraft };
          if (updated.field === 'dates') {
            const parsed = parseDateRangeInput(updates.value, prevDraft.end_date);
            const hasRange = parsed.start && parsed.end;
            if (hasRange) {
              nextDraft.start_date = parsed.start;
              nextDraft.end_date = parsed.end;
              const duration = dayjs(parsed.end).diff(dayjs(parsed.start), 'day') + 1;
              nextDraft.duration = Number.isFinite(duration) && duration > 0 ? duration : nextDraft.duration;
            }
            return nextDraft;
          }
          if (updated.field === 'student_count' || updated.field === 'teacher_count') {
            const numeric = Number(updates.value);
            nextDraft[updated.field] = Number.isFinite(numeric) ? numeric : 0;
            return nextDraft;
          }
          if (updated.field === 'tags') {
            nextDraft.tags = updates.value;
            return nextDraft;
          }
          if (updated.field && updated.field !== 'total' && updated.field !== 'duration') {
            nextDraft[updated.field] = updates.value;
          }
          return nextDraft;
        });
      }

      if (updated.field === 'dates') {
        const parsed = parseDateRangeInput(updated.value, draft?.end_date);
        const hasRange = parsed.start && parsed.end;
        if (hasRange) {
          const normalized = buildDateValue(parsed.start, parsed.end);
          next = next.map((prop) => (prop.id === 'dates' ? { ...prop, value: normalized } : prop));
          const durationValue = dayjs(parsed.end).diff(dayjs(parsed.start), 'day') + 1;
          next = next.map((prop) => (prop.id === 'duration' ? { ...prop, value: durationValue } : prop));
        }
      }

      if (updated.field === 'student_count' || updated.field === 'teacher_count') {
        const studentProp = next.find((prop) => prop.id === 'students');
        const teacherProp = next.find((prop) => prop.id === 'teachers');
        const studentVal = Number(studentProp?.value) || 0;
        const teacherVal = Number(teacherProp?.value) || 0;
        next = next.map((prop) => (prop.id === 'total' ? { ...prop, value: studentVal + teacherVal } : prop));
      }

      return next;
    });
  };

  const statusOptions = PROFILE_TEXT.statusOptions;

  const locationMap = new Map(
    (locations || []).map((location) => [Number(location.id), location])
  );
  const manualMustVisitIds = normalizeManualMustVisitLocationIds(draft.manual_must_visit_location_ids);
  const activePlan = (itineraryPlans || []).find(
    (plan) => Number(plan.id) === Number(draft.itinerary_plan_id)
  ) || null;
  const planMustVisitIds = extractPlanLocationIds(activePlan?.items || []);
  const selectedMustVisitIds = manualMustVisitIds;
  const resolvedMustVisit = selectedMustVisitIds.map((locationId, index) => {
    const location = locationMap.get(locationId);
    return {
      location_id: locationId,
      location_name: location?.name || ('#' + locationId),
      sort_order: index,
      source: 'manual'
    };
  });
  const mustVisitConfigured = manualMustVisitIds.length > 0;

  const handleMustVisitPlanChange = (value) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const planId = value ? Number(value) : null;
      return {
        ...prev,
        itinerary_plan_id: Number.isFinite(planId) ? planId : null
      };
    });
  };

  const handleApplyCurrentPlan = () => {
    if (manualMustVisitIds.length > 0) {
      const confirmed = window.confirm(PROFILE_TEXT.replaceMustVisitConfirm);
      if (!confirmed) return;
    }
    setDraft((prev) => {
      if (!prev) return prev;
      const planId = Number(prev.itinerary_plan_id);
      if (!Number.isFinite(planId)) return prev;
      const plan = (itineraryPlans || []).find((item) => Number(item.id) === planId);
      const nextIds = extractPlanLocationIds(plan?.items || []);
      if (!nextIds.length) return prev;
      return {
        ...prev,
        manual_must_visit_location_ids: nextIds
      };
    });
  };

  const handleToggleManualMustVisit = (locationId) => {
    const normalizedLocationId = Number(locationId);
    if (!Number.isFinite(normalizedLocationId) || normalizedLocationId <= 0) {
      return;
    }
    setDraft((prev) => {
      if (!prev) return prev;
      const currentIds = normalizeManualMustVisitLocationIds(prev.manual_must_visit_location_ids);
      const nextSet = new Set(currentIds);
      if (nextSet.has(normalizedLocationId)) {
        nextSet.delete(normalizedLocationId);
      } else {
        nextSet.add(normalizedLocationId);
      }
      return {
        ...prev,
        manual_must_visit_location_ids: Array.from(nextSet)
      };
    });
  };

  const handleClearManualMustVisit = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        manual_must_visit_location_ids: []
      };
    });
  };

  return (
    <div className="profile-layout profile-doc">
      <div className="profile-center doc-container">
        <div className="doc-content">
          <div className="profile-headline">
            {/* Default name stays in data, but title input shows placeholder-style empty state. */}
            <input
              className="doc-title"
              value={String(draft.name || '').trim() === UNNAMED_GROUP_NAME ? '' : (draft.name || '')}
              placeholder="输入团组名称"
              onChange={(event) => handleNameChange(event.target.value)}
              onBlur={handleNameBlur}
            />
            <div className="status-tags">
              {statusOptions.map((option) => (
                <span
                  key={option.label}
                  className={'status-tag ' + (
                    draft.status === option.value || (!draft.status && option.value === null)
                      ? 'active'
                      : ''
                  )}
                  onClick={() => handleStatusChange(option.value)}
                >
                  {option.label}
                </span>
              ))}
            </div>
          </div>

          <PropertyGrid
            properties={properties}
            onChangeProperty={handlePropertyUpdate}
            showAdd={false}
            footer={(
              <button
                type="button"
                className="add-prop-btn profile-delete-btn"
                onClick={handleDeleteGroup}
                disabled={!group?.id || !onDelete}
              >
                {PROFILE_TEXT.deleteGroup}
              </button>
            )}
          />

          <div className="must-visit-module">
            <div className="must-visit-head">
              <div className="must-visit-title">必去行程点配置</div>
              <span className={'must-visit-badge ' + (mustVisitConfigured ? 'ok' : 'warn')}>
                {mustVisitConfigured ? ('已配置 ' + resolvedMustVisit.length + ' 项') : '未配置'}
              </span>
            </div>

            <div className="must-visit-edit-row">
              <label className="must-visit-label">快捷方案</label>
              <div className="must-visit-plan-row">
                <div className="must-visit-plan-actions">
                  <select
                    className="prop-input"
                    value={draft.itinerary_plan_id ? String(draft.itinerary_plan_id) : ''}
                    onChange={(event) => handleMustVisitPlanChange(event.target.value)}
                  >
                    <option value="">不使用方案（仅手动）</option>
                    {(itineraryPlans || []).map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="must-visit-link-btn"
                    onClick={handleApplyCurrentPlan}
                    disabled={!draft.itinerary_plan_id}
                  >
                    套用当前方案
                  </button>
                </div>
                <span className="must-visit-tip">
                  方案仅用于快捷点选；点击“套用当前方案”才会把方案地点填充到必去点，之后可继续手动微调。
                </span>
              </div>
            </div>

            <div className="must-visit-edit-row">
              <label className="must-visit-label">手动必去行程点</label>
              <div className="must-visit-manual-panel">
                <div className="must-visit-manual-tools">
                  <span className="must-visit-tip">点击卡片即可多选，无需按住 Ctrl</span>
                  <button
                    type="button"
                    className="must-visit-link-btn"
                    onClick={handleClearManualMustVisit}
                    disabled={selectedMustVisitIds.length === 0}
                  >
                    清空
                  </button>
                </div>
                <div className="must-visit-option-grid">
                  {(locations || []).length === 0 && (
                    <span className="muted">暂无可选地点</span>
                  )}
                  {(locations || []).map((location) => {
                    const locationId = Number(location.id);
                    const isSelected = selectedMustVisitIds.includes(locationId);
                    return (
                      <button
                        key={location.id}
                        type="button"
                        className={'must-visit-option ' + (isSelected ? 'active' : '')}
                        onClick={() => handleToggleManualMustVisit(locationId)}
                      >
                          <span className="must-visit-option-check">{isSelected ? '✓' : '+'}</span>
                          <span className="must-visit-option-name">{location.name || ('#' + location.id)}</span>
                        </button>
                      );
                  })}
                </div>
              </div>
            </div>

            <div className="must-visit-list">
              {resolvedMustVisit.length === 0 ? (
                <span className="muted">未配置必去行程点，行程设计器导出会被拦截。</span>
              ) : (
                resolvedMustVisit.map((item, index) => (
                  <span className="schedule-chip" key={item.location_id + '-' + index}>
                    {item.location_name}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="doc-body">
            <div className="doc-section-title">备注说明</div>
            <textarea
              className="doc-textarea"
              rows={5}
              placeholder="点击输入详细备注..."
              value={draft.notes || ''}
              onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
            />
            <div className="notes-image-tools">
              <button
                type="button"
                className="notes-image-upload-btn"
                onClick={handleOpenImagePicker}
              >
                Upload Image
              </button>
              <span className="notes-image-counter">{noteImages.length}/{MAX_NOTE_IMAGE_COUNT}</span>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="notes-image-input"
                onChange={handleUploadImages}
              />
            </div>
            {uploadError ? (
              <div className="notes-image-error">{uploadError}</div>
            ) : null}
            {noteImages.length > 0 ? (
              <div className="notes-image-grid">
                {noteImages.map((imageUrl, index) => (
                  <div className="notes-image-item" key={index + '-' + imageUrl.slice(0, 24)}>
                    <button
                      type="button"
                      className="notes-image-thumb"
                      onClick={() => handlePreviewImage(imageUrl)}
                      title="Preview"
                    >
                      <img src={imageUrl} alt={'note-' + (index + 1)} />
                    </button>
                    <button
                      type="button"
                      className="notes-image-remove"
                      onClick={() => handleRemoveImage(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {previewImage ? (
        <div className="notes-image-preview-mask" onClick={() => setPreviewImage('')}>
          <div className="notes-image-preview-dialog" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="notes-image-preview-close"
              onClick={() => setPreviewImage('')}
            >
              Close
            </button>
            <img src={previewImage} alt="preview" className="notes-image-preview-img" />
          </div>
        </div>
      ) : null}

    </div>
  );
};

export default ProfileView;


