import React from 'react';

const ProfileNotesSection = ({
  draft,
  setDraft,
  noteImages = [],
  uploadError = '',
  maxImageCount = 0,
  imageInputRef,
  onOpenImagePicker,
  onUploadImages,
  onPreviewImage,
  onRemoveImage
}) => {
  return (
    <div className="doc-body">
      <div className="doc-section-title">{'备注说明'}</div>
      <textarea
        className="doc-textarea"
        rows={5}
        placeholder={'点击输入详细备注...'}
        value={draft?.notes || ''}
        onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
      />
      <div className="notes-image-tools">
        <button
          type="button"
          className="notes-image-upload-btn"
          onClick={onOpenImagePicker}
        >
          Upload Image
        </button>
        <span className="notes-image-counter">{noteImages.length}/{maxImageCount}</span>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="notes-image-input"
          onChange={onUploadImages}
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
                onClick={() => onPreviewImage(imageUrl)}
                title="Preview"
              >
                <img src={imageUrl} alt={'note-' + (index + 1)} />
              </button>
              <button
                type="button"
                className="notes-image-remove"
                onClick={() => onRemoveImage(index)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default ProfileNotesSection;
