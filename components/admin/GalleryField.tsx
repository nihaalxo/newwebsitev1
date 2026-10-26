'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import type { Media } from '@/lib/cms/types';
import { IMAGE_ACCEPT, uploadErrorMessage, uploadImage } from '@/lib/upload-client';
import { FieldError, TextField, describedBy } from './fields';
import { ChevronLeft, ChevronRight, Upload } from './icons';
import { UploadProgress } from './MediaField';
import { LIMITS, fieldId, type FieldErrors } from './rules';
import { useUploadTracker } from './upload-tracker';

interface GalleryFieldProps {
  /** Error key of the list, e.g. "blocks.<id>.items"; each image's description is "<key>.<index>.alt". */
  errorKey: string;
  items: Media[];
  onChange: (change: (items: Media[]) => Media[]) => void;
  folderHint: string;
  errors: FieldErrors;
}

type Busy = { label: string; progress: number | null };

/** Several images at once: drop or choose many files, describe each, put them in order. */
export default function GalleryField({ errorKey, items, onChange, folderHint, errors }: GalleryFieldProps) {
  const id = fieldId(errorKey);
  const track = useUploadTracker();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [dragging, setDragging] = useState(false);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFocus) return;
    document.getElementById(pendingFocus)?.focus();
    setPendingFocus(null);
  }, [pendingFocus, items]);

  const message = problem ?? errors[errorKey];
  // The most a gallery holds; past it the save is refused, so files beyond it aren't uploaded at all.
  const full = items.length >= LIMITS.galleryItems;

  async function addFiles(chosen: File[]) {
    if (busy || chosen.length === 0) return;
    const room = LIMITS.galleryItems - items.length;
    if (room <= 0) {
      const text = `This gallery already has ${LIMITS.galleryItems} images, the most it can hold. Remove one, or add a second gallery block.`;
      setProblem(text);
      setAnnouncement(text);
      return;
    }
    const files = chosen.slice(0, room);
    const left =
      chosen.length > room
        ? `A gallery holds at most ${LIMITS.galleryItems} images, so the last ${chosen.length - room} of the ${chosen.length} you chose weren't added.`
        : null;
    setProblem(null);
    const failures: string[] = [];
    await track(
      (async () => {
        for (const [index, file] of files.entries()) {
          const label = files.length > 1 ? `Uploading ${index + 1} of ${files.length}: ${file.name}` : `Uploading ${file.name}`;
          setBusy({ label, progress: null });
          if (index === 0) setAnnouncement(`${label}.`);
          try {
            const media = await uploadImage(file, folderHint, (progress) => setBusy({ label, progress }));
            onChange((current) => [...current, media]);
          } catch (failure) {
            failures.push(`${file.name}: ${uploadErrorMessage(failure)}`);
          }
        }
      })(),
    );
    setBusy(null);
    const added = files.length - failures.length;
    const problems = [left, ...failures].filter((text): text is string => Boolean(text));
    if (problems.length) setProblem(problems.join(' '));
    setAnnouncement(
      [
        failures.length
          ? `${added} of ${files.length} images added.`
          : `${added === 1 ? 'Image' : `${added} images`} added to the gallery.`,
        ...problems,
      ].join(' '),
    );
  }

  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    onChange((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    const atEdge = target === 0 || target === items.length - 1;
    const direction = offset < 0 ? 'earlier' : 'later';
    const fallback = offset < 0 ? 'later' : 'earlier';
    setPendingFocus(`${id}-${target}-${atEdge ? fallback : direction}`);
    setAnnouncement(`Image moved to position ${target + 1} of ${items.length}.`);
  }

  function remove(index: number) {
    onChange((current) => current.filter((_, i) => i !== index));
    const remaining = items.length - 1;
    setPendingFocus(remaining === 0 ? id : `${id}-${Math.min(index, remaining - 1)}-remove`);
    setAnnouncement(`Image ${index + 1} removed.`);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    setDragging(true);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void addFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div className="adm-field adm-media" role="group" aria-labelledby={`${id}-label`}>
      <div className="adm-label-row">
        <span className="adm-label" id={`${id}-label`}>
          Images
        </span>
        <span className="adm-count">{items.length === 1 ? '1 image' : `${items.length} images`}</span>
      </div>

      {items.length > 0 && (
        <ol className="adm-gallery">
          {items.map((item, index) => {
            const altKey = `${errorKey}.${index}.alt`;
            const itemId = `${id}-${index}`;
            return (
              <li key={item.src} className="adm-gallery-item">
                <img src={item.srcSmall || item.src} alt="" />
                <TextField
                  id={fieldId(altKey)}
                  label={`Describe image ${index + 1}`}
                  required
                  value={item.alt}
                  maxLength={LIMITS.alt}
                  onChange={(alt) => onChange((current) => current.map((m, i) => (i === index ? { ...m, alt } : m)))}
                  error={errors[altKey]}
                />
                <div className="adm-gallery-tools">
                  <button
                    id={`${itemId}-earlier`}
                    type="button"
                    className="adm-icon-btn"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                  >
                    <ChevronLeft />
                    <span className="adm-vh">Move image {index + 1} earlier</span>
                  </button>
                  <button
                    id={`${itemId}-later`}
                    type="button"
                    className="adm-icon-btn"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                  >
                    <ChevronRight />
                    <span className="adm-vh">Move image {index + 1} later</span>
                  </button>
                  <button
                    id={`${itemId}-remove`}
                    type="button"
                    className="adm-btn adm-btn-small adm-btn-quiet"
                    onClick={() => remove(index)}
                  >
                    Remove<span className="adm-vh"> image {index + 1}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div
        className="adm-drop adm-drop-compact"
        data-over={dragging || undefined}
        data-invalid={errors[errorKey] ? true : undefined}
        onDragOver={onDragOver}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
      >
        <div className="adm-drop-empty">
          <Upload />
          <p>Drag images here, or</p>
          <button
            id={id}
            type="button"
            className="adm-btn adm-btn-small"
            onClick={() => !busy && !full && fileInput.current?.click()}
            aria-disabled={busy || full ? true : undefined}
            data-invalid={errors[errorKey] ? true : undefined}
            aria-describedby={describedBy(id, 'formats', message && 'error')}
          >
            {items.length ? 'Add more images' : 'Choose images'}
          </button>
          <p className="adm-help" id={`${id}-formats`}>
            {full
              ? `This gallery holds the most images it can (${LIMITS.galleryItems}). Remove one to add another, or add a second gallery block.`
              : `You can choose several at once, up to ${LIMITS.galleryItems} in a gallery, then put them in order with the arrows.`}
          </p>
        </div>
      </div>

      {busy && <UploadProgress busy={busy} />}
      <FieldError id={`${id}-error`} message={message} />

      <input
        ref={fileInput}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        hidden
        tabIndex={-1}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          void addFiles(files);
        }}
      />
      <p className="adm-vh" role="status">
        {announcement}
      </p>
    </div>
  );
}
