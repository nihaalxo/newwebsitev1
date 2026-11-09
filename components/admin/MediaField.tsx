'use client';

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import type { Media } from '@/lib/cms/types';
import {
  IMAGE_ACCEPT,
  VIDEO_ACCEPT,
  uploadErrorMessage,
  uploadImage,
  uploadStill,
  uploadVideo,
  uploadVideoFrame,
  type ProgressHandler,
} from '@/lib/upload-client';
import { FieldError, RequiredMark, TextField, describedBy } from './fields';
import { Upload } from './icons';
import { LIMITS } from './rules';
import { useUploadTracker } from './upload-tracker';

export interface MediaFieldProps {
  /** Id of the field's main button; the description input is `${id}-alt`. Matches fieldId() of its error key. */
  id: string;
  label: string;
  help?: ReactNode;
  kind: 'image' | 'video';
  value: Media | null;
  onChange: (media: Media | null) => void;
  /** Where uploads are filed, e.g. "projects/my-chaii/cover" or "site/avatar". */
  folderHint: string;
  required?: boolean;
  error?: string;
  altError?: string;
  /** Videos: seconds to cue the preview to, so "Use the frame on screen" starts on that frame. */
  previewStart?: number;
  /** Videos: offer a second, portrait cut that plays instead on screens taller than they are wide. */
  tallCut?: boolean;
}

type Busy = { label: string; progress: number | null };

const FORMATS = {
  image: 'JPG, PNG, WebP or GIF. Large images are resized to 2400 pixels wide and saved as WebP.',
  video: 'MP4, WebM or MOV, up to 50 MB. MP4 (H.264) plays in every browser.',
};

export default function MediaField({
  id,
  label,
  help,
  kind,
  value,
  onChange,
  folderHint,
  required,
  error,
  altError,
  previewStart,
  tallCut,
}: MediaFieldProps) {
  const track = useUploadTracker();
  const root = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const posterInput = useRef<HTMLInputElement>(null);
  const tallInput = useRef<HTMLInputElement>(null);
  const previewVideo = useRef<HTMLVideoElement>(null);
  // Uploads finish after a delay; merge into whatever the value is by then, not what it was when they started.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const [busy, setBusy] = useState<Busy | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [dragging, setDragging] = useState(false);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  // Uploading the first file, Remove and Remove poster each unmount the focused button. Put keyboard focus on the
  // control that replaced it, rather than letting it fall back to the top of the page.
  useEffect(() => {
    if (!pendingFocus) return;
    document.getElementById(pendingFocus)?.focus();
    setPendingFocus(null);
  }, [pendingFocus, value]);

  const article = kind === 'image' ? 'an image' : 'a video';
  const message = problem ?? error;

  async function run(busyLabel: string, done: string, work: (onProgress: ProgressHandler) => Promise<void>) {
    setProblem(null);
    setBusy({ label: busyLabel, progress: null });
    setAnnouncement(`${busyLabel}.`);
    try {
      await track(work((progress) => setBusy({ label: busyLabel, progress })));
      setAnnouncement(done);
    } catch (failure) {
      const text = uploadErrorMessage(failure);
      setProblem(text);
      setAnnouncement(text);
    } finally {
      setBusy(null);
    }
  }

  function upload(file: File) {
    if (busy) return;
    void run(`Uploading ${file.name}`, `${kind === 'image' ? 'Image' : 'Video'} uploaded.`, async (onProgress) => {
      const uploaded =
        kind === 'image' ? await uploadImage(file, folderHint, onProgress) : await uploadVideo(file, folderHint, onProgress);
      // The first file swaps "Choose" for Replace and the description field. Follow it there, unless the owner has
      // moved on to another field while it uploaded.
      const active = document.activeElement;
      const focusHere = active === document.body || Boolean(root.current?.contains(active));
      if (!latest.current && focusHere) setPendingFocus(kind === 'image' ? `${id}-alt` : id);
      // Keep the description when replacing a file; a new film needs a new poster and tall cut, which `uploaded`
      // doesn't carry.
      onChange({ ...uploaded, alt: latest.current?.alt ?? '' });
    });
  }

  function captureFrameOnScreen() {
    const video = previewVideo.current;
    const current = latest.current;
    if (busy || !video || !current) return;
    const time = video.currentTime;
    void run('Saving this frame as the poster', 'Poster saved.', async (onProgress) => {
      const poster = await uploadVideoFrame(current.src, time, `${folderHint}-poster`, onProgress);
      if (latest.current) onChange({ ...latest.current, poster });
    });
  }

  function uploadPoster(file: File) {
    if (busy) return;
    void run(`Uploading ${file.name}`, 'Poster uploaded.', async (onProgress) => {
      const poster = await uploadStill(file, `${folderHint}-poster`, onProgress);
      if (latest.current) onChange({ ...latest.current, poster });
    });
  }

  function uploadTall(file: File) {
    if (busy) return;
    void run(`Uploading ${file.name}`, 'Tall cut uploaded.', async (onProgress) => {
      const tall = await uploadVideo(file, `${folderHint}-tall`, onProgress);
      if (latest.current) onChange({ ...latest.current, srcTall: tall.src });
    });
  }

  function removeTall() {
    if (!value) return;
    const { srcTall: _removed, ...rest } = value;
    onChange(rest);
    setPendingFocus(`${id}-tall-upload`);
  }

  function remove() {
    if (busy) return;
    onChange(null);
    setPendingFocus(id);
  }

  function removePoster() {
    if (!value) return;
    const { poster: _removed, ...rest } = value;
    onChange(rest);
    setPendingFocus(`${id}-poster-upload`);
  }

  function chooseFile() {
    if (!busy) fileInput.current?.click();
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
    setDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) upload(file);
  }

  const mainButtonProps = {
    id,
    type: 'button' as const,
    onClick: chooseFile,
    // aria-disabled rather than disabled, so keyboard focus stays put while an upload runs.
    'aria-disabled': busy ? true : undefined,
    'data-invalid': error ? true : undefined,
    'aria-describedby': describedBy(id, help ? 'help' : null, !value && 'formats', message && 'error'),
  };

  return (
    <div ref={root} className="adm-field adm-media" role="group" aria-labelledby={`${id}-label`}>
      <div className="adm-label-row">
        <span className="adm-label" id={`${id}-label`}>
          {label}
          {required && <RequiredMark />}
        </span>
      </div>
      {help && (
        <p className="adm-help" id={`${id}-help`}>
          {help}
        </p>
      )}

      <div
        className="adm-drop"
        data-over={dragging || undefined}
        data-filled={value ? true : undefined}
        data-invalid={error ? true : undefined}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {value && kind === 'image' && <img className="adm-media-preview" src={value.srcSmall || value.src} alt="" />}
        {value && kind === 'video' && (
          <video
            ref={previewVideo}
            className="adm-media-preview"
            src={previewStart ? `${value.src}#t=${previewStart}` : value.src}
            poster={value.poster}
            controls
            muted
            playsInline
            preload="metadata"
          />
        )}
        {!value && (
          <div className="adm-drop-empty">
            <Upload />
            <p>Drag {article} here, or</p>
            <button className="adm-btn adm-btn-small" {...mainButtonProps}>
              Choose {article}
              <span className="adm-vh"> for {label}</span>
            </button>
            <p className="adm-help" id={`${id}-formats`}>
              {FORMATS[kind]}
            </p>
          </div>
        )}
      </div>

      {busy && <UploadProgress busy={busy} />}

      {value && (
        <div className="adm-media-actions">
          <button className="adm-btn adm-btn-small" {...mainButtonProps}>
            Replace<span className="adm-vh"> {label}</span>
          </button>
          <button
            type="button"
            className="adm-btn adm-btn-small adm-btn-quiet"
            onClick={remove}
            aria-disabled={busy ? true : undefined}
          >
            Remove<span className="adm-vh"> {label}</span>
          </button>
          {value.width && value.height ? (
            <span className="adm-media-size">
              {value.width} × {value.height} pixels
            </span>
          ) : null}
        </div>
      )}

      <FieldError id={`${id}-error`} message={message} />

      {value && (
        <TextField
          id={`${id}-alt`}
          label={kind === 'image' ? 'Describe the image' : 'Describe the video'}
          help={
            kind === 'image'
              ? 'Read out by screen readers and used by search engines. Say what it shows, like “Paper cups and bags printed with the My Chaii wordmark”.'
              : 'Optional. One sentence on what happens in it, read out by screen readers.'
          }
          required={kind === 'image'}
          value={value.alt}
          maxLength={LIMITS.alt}
          onChange={(alt) => latest.current && onChange({ ...latest.current, alt })}
          error={altError}
        />
      )}

      {value && kind === 'video' && (
        <div className="adm-poster">
          <div className="adm-poster-thumb">
            {value.poster ? <img src={value.poster} alt="" /> : <span>No poster yet</span>}
          </div>
          <div className="adm-poster-body">
            <p className="adm-label">Poster still</p>
            <p className="adm-help">
              Shown before the film starts playing. Pause the preview on the frame you want and use it, or upload a still.
            </p>
            <div className="adm-media-actions">
              <button type="button" className="adm-btn adm-btn-small" onClick={captureFrameOnScreen} aria-disabled={busy ? true : undefined}>
                Use the frame on screen<span className="adm-vh"> as the poster for {label}</span>
              </button>
              <button
                id={`${id}-poster-upload`}
                type="button"
                className="adm-btn adm-btn-small"
                onClick={() => !busy && posterInput.current?.click()}
                aria-disabled={busy ? true : undefined}
              >
                Upload a still<span className="adm-vh"> for {label}</span>
              </button>
              {value.poster && (
                <button type="button" className="adm-btn adm-btn-small adm-btn-quiet" onClick={removePoster}>
                  Remove poster<span className="adm-vh"> from {label}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {value && kind === 'video' && tallCut && (
        <div className="adm-poster">
          <div className="adm-poster-thumb">
            {value.srcTall ? <video src={value.srcTall} muted playsInline preload="metadata" /> : <span>No tall cut</span>}
          </div>
          <div className="adm-poster-body">
            <p className="adm-label">Tall cut (portrait screens)</p>
            <p className="adm-help">
              Optional. A portrait version of the same film, played instead on phones held upright and other screens
              taller than they are wide.
            </p>
            <div className="adm-media-actions">
              <button
                id={`${id}-tall-upload`}
                type="button"
                className="adm-btn adm-btn-small"
                onClick={() => !busy && tallInput.current?.click()}
                aria-disabled={busy ? true : undefined}
              >
                {value.srcTall ? 'Replace the tall cut' : 'Upload a tall cut'}
                <span className="adm-vh"> for {label}</span>
              </button>
              {value.srcTall && (
                <button type="button" className="adm-btn adm-btn-small adm-btn-quiet" onClick={removeTall}>
                  Remove the tall cut<span className="adm-vh"> from {label}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept={kind === 'image' ? IMAGE_ACCEPT : VIDEO_ACCEPT}
        hidden
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) upload(file);
        }}
      />
      {kind === 'video' && (
        <input
          ref={posterInput}
          type="file"
          accept={IMAGE_ACCEPT}
          hidden
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) uploadPoster(file);
          }}
        />
      )}
      {kind === 'video' && tallCut && (
        <input
          ref={tallInput}
          type="file"
          accept={VIDEO_ACCEPT}
          hidden
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) uploadTall(file);
          }}
        />
      )}
      <p className="adm-vh" role="status">
        {announcement}
      </p>
    </div>
  );
}

export function UploadProgress({ busy }: { busy: Busy }) {
  const percent = busy.progress === null ? null : Math.round(busy.progress * 100);
  return (
    <div className="adm-progress">
      <span aria-hidden="true">
        {busy.label}
        {percent === null ? '…' : `, ${percent}%`}
      </span>
      <progress max={100} value={percent ?? undefined} aria-label={busy.label} />
    </div>
  );
}
