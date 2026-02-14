import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import PropertyGrid from './PropertyGrid';
import MustVisitSection from './profile/MustVisitSection';
import ProfileNotesSection from './profile/ProfileNotesSection';
import {
  MAX_NOTE_IMAGE_COUNT,
  MAX_NOTE_IMAGE_SIZE,
  MAX_NOTE_IMAGE_TOTAL_CHARS,
  buildBaseProperties,
  buildDateValue,
  isDraftValid,
  mergeCustomProperties,
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

  return (
    <div className="profile-layout profile-doc">
      <div className="profile-center doc-container">
        <div className="doc-content">
          <div className="profile-headline">
            <input
              className="doc-title"
              value={String(draft.name || '').trim() === UNNAMED_GROUP_NAME ? '' : (draft.name || '')}
              placeholder={'输入团组名称'}
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

          <MustVisitSection
            draft={draft}
            itineraryPlans={itineraryPlans}
            locations={locations}
            setDraft={setDraft}
          />

          <ProfileNotesSection
            draft={draft}
            setDraft={setDraft}
            noteImages={noteImages}
            uploadError={uploadError}
            maxImageCount={MAX_NOTE_IMAGE_COUNT}
            imageInputRef={imageInputRef}
            onOpenImagePicker={handleOpenImagePicker}
            onUploadImages={handleUploadImages}
            onPreviewImage={handlePreviewImage}
            onRemoveImage={handleRemoveImage}
          />
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
