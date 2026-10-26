'use client';

import { useEffect, useState } from 'react';
import type { Block, BlockType, Media } from '@/lib/cms/types';
import { ChoiceField, FieldError, SwitchField, TextAreaField, TextField, describedBy } from './fields';
import GalleryField from './GalleryField';
import { ChevronDown, ChevronUp } from './icons';
import MediaField from './MediaField';
import { LIMITS, PROSE_HELP, fieldId, type FieldErrors } from './rules';

const BLOCK_TYPES: BlockType[] = ['text', 'image', 'gallery', 'video', 'quote'];

const BLOCK_LABELS: Record<BlockType, string> = {
  text: 'Text',
  image: 'Image',
  gallery: 'Gallery',
  video: 'Video',
  quote: 'Quote',
};

// An image or video block waiting for its file. Saved drafts can hold one; publishing requires the file.
const NO_IMAGE: Media = { kind: 'image', src: '', alt: '' };
const NO_VIDEO: Media = { kind: 'video', src: '', alt: '' };

function newId(): string {
  // randomUUID needs a secure context; fall back when the admin is opened over plain http on a local network.
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function newBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case 'text':
      return { id, type, heading: '', body: '' };
    case 'image':
      return { id, type, media: NO_IMAGE, caption: '', size: 'wide' };
    case 'gallery':
      return { id, type, items: [], columns: 2, caption: '' };
    case 'video':
      return { id, type, media: NO_VIDEO, caption: '', loop: true };
    case 'quote':
      return { id, type, text: '', cite: '' };
  }
}

/** The control a newly added block should focus first. */
function firstFieldKey(block: Block): string {
  const key = `blocks.${block.id}`;
  switch (block.type) {
    case 'text':
      return `${key}.heading`;
    case 'quote':
      return `${key}.text`;
    case 'gallery':
      return `${key}.items`;
    default:
      return `${key}.media`;
  }
}

const blockDomId = (id: string) => fieldId(`blocks.${id}`);

interface BlockEditorProps {
  blocks: Block[];
  onChange: (change: (blocks: Block[]) => Block[]) => void;
  errors: FieldErrors;
  /** e.g. "projects/my-chaii"; each block files its uploads under it. */
  folderHint: string;
}

export default function BlockEditor({ blocks, onChange, errors, folderHint }: BlockEditorProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  // Moving or removing a block re-renders the list; put keyboard focus back where the owner expects it.
  useEffect(() => {
    if (!pendingFocus) return;
    document.getElementById(pendingFocus)?.focus();
    setPendingFocus(null);
  }, [pendingFocus, blocks, confirmingId]);

  function patch<B extends Block>(id: string, change: (block: B) => B) {
    onChange((current) => current.map((block) => (block.id === id ? change(block as B) : block)));
  }

  // The most a story holds; past it the save is refused, so stop adding here instead.
  const full = blocks.length >= LIMITS.blocks;

  function add(type: BlockType) {
    if (full) return;
    const block = newBlock(type);
    onChange((current) => [...current, block]);
    setPendingFocus(fieldId(firstFieldKey(block)));
    setAnnouncement(`${BLOCK_LABELS[type]} block added at the end of the story.`);
  }

  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= blocks.length) return;
    const id = blocks[index].id;
    onChange((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    const atEdge = target === 0 || target === blocks.length - 1;
    const sameButton = offset < 0 ? 'up' : 'down';
    const otherButton = offset < 0 ? 'down' : 'up';
    setPendingFocus(`${blockDomId(id)}-${atEdge ? otherButton : sameButton}`);
    setAnnouncement(`${BLOCK_LABELS[blocks[index].type]} block moved to position ${target + 1} of ${blocks.length}.`);
  }

  function remove(index: number) {
    const removed = blocks[index];
    onChange((current) => current.filter((block) => block.id !== removed.id));
    setConfirmingId(null);
    const neighbour = blocks[index + 1] ?? blocks[index - 1];
    setPendingFocus(neighbour ? `${blockDomId(neighbour.id)}-title` : 'adm-add-block');
    setAnnouncement(`${BLOCK_LABELS[removed.type]} block removed.`);
  }

  function askToRemove(id: string) {
    setConfirmingId(id);
    setPendingFocus(`${blockDomId(id)}-keep`);
  }

  function keep(id: string) {
    setConfirmingId(null);
    setPendingFocus(`${blockDomId(id)}-remove`);
  }

  return (
    <div className="adm-story">
      {blocks.length === 0 ? (
        <p className="adm-story-empty">
          The story is empty. Add text, images, galleries, videos and quotes below, in the order they should appear.
        </p>
      ) : (
        <ol className="adm-blocks">
          {blocks.map((block, index) => {
            const domId = blockDomId(block.id);
            const label = BLOCK_LABELS[block.type];
            const confirming = confirmingId === block.id;
            return (
              <li key={block.id} className="adm-block">
                <div className="adm-block-head">
                  <h3 className="adm-block-title" id={`${domId}-title`} tabIndex={-1}>
                    {label}
                    <span className="adm-block-pos">
                      {index + 1} of {blocks.length}
                    </span>
                  </h3>
                  {confirming ? (
                    <div className="adm-confirm" role="group" aria-label={`Remove this ${label.toLowerCase()} block?`}>
                      <p>Remove this {label.toLowerCase()} block? Its content goes too.</p>
                      <button type="button" className="adm-btn adm-btn-small adm-btn-danger" onClick={() => remove(index)}>
                        Remove
                      </button>
                      <button id={`${domId}-keep`} type="button" className="adm-btn adm-btn-small" onClick={() => keep(block.id)}>
                        Keep it
                      </button>
                    </div>
                  ) : (
                    <div className="adm-block-tools">
                      <button
                        id={`${domId}-up`}
                        type="button"
                        className="adm-icon-btn"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                      >
                        <ChevronUp />
                        <span className="adm-vh">
                          Move {label.toLowerCase()} block {index + 1} up
                        </span>
                      </button>
                      <button
                        id={`${domId}-down`}
                        type="button"
                        className="adm-icon-btn"
                        onClick={() => move(index, 1)}
                        disabled={index === blocks.length - 1}
                      >
                        <ChevronDown />
                        <span className="adm-vh">
                          Move {label.toLowerCase()} block {index + 1} down
                        </span>
                      </button>
                      <button
                        id={`${domId}-remove`}
                        type="button"
                        className="adm-btn adm-btn-small adm-btn-quiet"
                        onClick={() => askToRemove(block.id)}
                      >
                        Remove<span className="adm-vh"> {label.toLowerCase()} block {index + 1}</span>
                      </button>
                    </div>
                  )}
                </div>
                <div className="adm-block-body">
                  <BlockForm block={block} patch={patch} errors={errors} folderHint={folderHint} />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="adm-add" role="group" aria-labelledby="adm-add-block">
        <p className="adm-label" id="adm-add-block" tabIndex={-1}>
          Add to the story
        </p>
        {full && (
          <p className="adm-help" id="adm-add-block-help">
            The story holds at most {LIMITS.blocks} blocks. Remove one to add another.
          </p>
        )}
        {/* With too many blocks, the first button is marked invalid so focusFirstInvalid lands beside the message. */}
        <div className="adm-add-buttons">
          {BLOCK_TYPES.map((type, index) => (
            <button
              key={type}
              type="button"
              className="adm-btn adm-btn-small"
              onClick={() => add(type)}
              aria-disabled={full || undefined}
              data-invalid={errors.blocks && index === 0 ? true : undefined}
              aria-describedby={describedBy('adm-add-block', full && 'help', errors.blocks && 'error')}
            >
              {BLOCK_LABELS[type]}
              <span className="adm-vh"> block</span>
            </button>
          ))}
        </div>
        <FieldError id="adm-add-block-error" message={errors.blocks} />
      </div>

      <p className="adm-vh" role="status">
        {announcement}
      </p>
    </div>
  );
}

type Patch = <B extends Block>(id: string, change: (block: B) => B) => void;

interface BlockFormProps {
  block: Block;
  patch: Patch;
  errors: FieldErrors;
  folderHint: string;
}

function BlockForm({ block, patch, errors, folderHint }: BlockFormProps) {
  const key = `blocks.${block.id}`;

  switch (block.type) {
    case 'text':
      return (
        <>
          <TextField
            id={fieldId(`${key}.heading`)}
            label="Heading"
            help="Optional. A short title for this part of the story, like “The brief”."
            value={block.heading ?? ''}
            maxLength={LIMITS.heading}
            onChange={(heading) => patch<typeof block>(block.id, (b) => ({ ...b, heading }))}
          />
          <TextAreaField
            id={fieldId(`${key}.body`)}
            label="Text"
            help={PROSE_HELP}
            rows={8}
            value={block.body}
            maxLength={LIMITS.body}
            onChange={(body) => patch<typeof block>(block.id, (b) => ({ ...b, body }))}
            error={errors[`${key}.body`]}
          />
        </>
      );

    case 'image':
      return (
        <>
          <MediaField
            id={fieldId(`${key}.media`)}
            label="Image"
            kind="image"
            value={block.media.src ? block.media : null}
            onChange={(media) => patch<typeof block>(block.id, (b) => ({ ...b, media: media ?? NO_IMAGE }))}
            folderHint={`${folderHint}/image`}
            error={errors[`${key}.media`]}
            altError={errors[`${key}.media.alt`]}
          />
          <ChoiceField
            name={fieldId(`${key}.size`)}
            legend="Width on the page"
            value={block.size}
            onChange={(size) => patch<typeof block>(block.id, (b) => ({ ...b, size }))}
            options={[
              { id: 'full', label: 'Full', help: 'Edge to edge' },
              { id: 'wide', label: 'Wide', help: 'Wider than the text' },
              { id: 'inset', label: 'Inset', help: 'Same width as the text' },
            ]}
          />
          <TextField
            id={fieldId(`${key}.caption`)}
            label="Caption"
            help="Optional. Shown under the image."
            value={block.caption ?? ''}
            maxLength={LIMITS.caption}
            onChange={(caption) => patch<typeof block>(block.id, (b) => ({ ...b, caption }))}
          />
        </>
      );

    case 'gallery':
      return (
        <>
          <GalleryField
            errorKey={`${key}.items`}
            items={block.items}
            onChange={(change) => patch<typeof block>(block.id, (b) => ({ ...b, items: change(b.items) }))}
            folderHint={`${folderHint}/gallery`}
            errors={errors}
          />
          <ChoiceField
            name={fieldId(`${key}.columns`)}
            legend="Images per row"
            value={block.columns}
            onChange={(columns) => patch<typeof block>(block.id, (b) => ({ ...b, columns }))}
            options={[
              { id: 2, label: 'Two' },
              { id: 3, label: 'Three' },
            ]}
          />
          <TextField
            id={fieldId(`${key}.caption`)}
            label="Caption"
            help="Optional. Shown under the gallery."
            value={block.caption ?? ''}
            maxLength={LIMITS.caption}
            onChange={(caption) => patch<typeof block>(block.id, (b) => ({ ...b, caption }))}
          />
        </>
      );

    case 'video':
      return (
        <>
          <MediaField
            id={fieldId(`${key}.media`)}
            label="Video"
            kind="video"
            value={block.media.src ? block.media : null}
            onChange={(media) => patch<typeof block>(block.id, (b) => ({ ...b, media: media ?? NO_VIDEO }))}
            folderHint={`${folderHint}/video`}
            error={errors[`${key}.media`]}
          />
          <SwitchField
            id={fieldId(`${key}.loop`)}
            label="Play on a loop"
            help="Starts again from the beginning when it ends. Turn off for a film with a beginning and an end."
            checked={block.loop}
            onChange={(loop) => patch<typeof block>(block.id, (b) => ({ ...b, loop }))}
          />
          <TextField
            id={fieldId(`${key}.caption`)}
            label="Caption"
            help="Optional. Shown under the video."
            value={block.caption ?? ''}
            maxLength={LIMITS.caption}
            onChange={(caption) => patch<typeof block>(block.id, (b) => ({ ...b, caption }))}
          />
        </>
      );

    case 'quote':
      return (
        <>
          <TextAreaField
            id={fieldId(`${key}.text`)}
            label="Quote"
            rows={3}
            value={block.text}
            maxLength={LIMITS.quote}
            onChange={(text) => patch<typeof block>(block.id, (b) => ({ ...b, text }))}
            error={errors[`${key}.text`]}
          />
          <TextField
            id={fieldId(`${key}.cite`)}
            label="Who said it"
            help="Optional, like “Founder, My Chaii London”."
            value={block.cite ?? ''}
            maxLength={LIMITS.cite}
            onChange={(cite) => patch<typeof block>(block.id, (b) => ({ ...b, cite }))}
          />
        </>
      );
  }
}
