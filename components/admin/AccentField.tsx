'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { Media } from '@/lib/cms/types';
import { sampleAccent } from './color';
import { FieldError, describedBy } from './fields';
import { HEX_PATTERN } from './rules';

interface AccentFieldProps {
  id: string;
  value: string;
  onChange: (hex: string) => void;
  cover: Media | null;
  error?: string;
}

/** Colour picker, hex input and "Pick from cover", with a swatch of how the colour lights a case study. */
export default function AccentField({ id, value, onChange, cover, error }: AccentFieldProps) {
  // The hex box keeps what's being typed; the stored value only changes once it's a complete colour.
  const [typed, setTyped] = useState(value);
  const [sampling, setSampling] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    setTyped(value);
  }, [value]);

  function typeHex(text: string) {
    const next = text.trim().startsWith('#') ? text.trim() : `#${text.trim()}`;
    setTyped(text);
    if (HEX_PATTERN.test(next)) onChange(next.toUpperCase());
  }

  async function pickFromCover() {
    if (!cover?.src || sampling) return;
    setSampling(true);
    setNote('Sampling the cover…');
    try {
      const hex = await sampleAccent(cover.srcSmall || cover.src);
      onChange(hex);
      setNote(`Accent set to ${hex}, picked from the cover.`);
    } catch {
      setNote("Couldn't read the cover's colours. Pick a colour by hand instead.");
    } finally {
      setSampling(false);
    }
  }

  const valid = HEX_PATTERN.test(value);
  const swatch = { '--adm-accent': valid ? value : '#6FF3FF' } as CSSProperties;

  return (
    <fieldset className="adm-field adm-accent" aria-describedby={describedBy(id, 'help', error && 'error')}>
      <legend className="adm-label">Accent colour</legend>
      <p className="adm-help" id={`${id}-help`}>
        The light the case study is lit with. Pick from cover finds the cover&apos;s strongest colour and brightens it so it
        glows on the dark page.
      </p>
      <div className="adm-accent-row">
        <label className="adm-vh" htmlFor={`${id}-picker`}>
          Colour picker
        </label>
        <input
          id={`${id}-picker`}
          className="adm-color"
          type="color"
          value={valid ? value.toLowerCase() : '#6ff3ff'}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
        <div className="adm-accent-hex">
          <label className="adm-vh" htmlFor={id}>
            Hex value
          </label>
          <input
            id={id}
            className="adm-input"
            value={typed}
            onChange={(event) => typeHex(event.target.value)}
            onBlur={() => setTyped(value)}
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            data-invalid={error ? true : undefined}
          />
        </div>
        <button
          type="button"
          className="adm-btn"
          onClick={pickFromCover}
          aria-disabled={!cover?.src || sampling ? true : undefined}
          aria-describedby={!cover?.src ? `${id}-nocover` : undefined}
        >
          {sampling ? 'Picking…' : 'Pick from cover'}
        </button>
      </div>
      {!cover?.src && (
        <p className="adm-help" id={`${id}-nocover`}>
          Add a cover image first to pick from it.
        </p>
      )}
      <div className="adm-accent-preview" style={swatch} aria-hidden="true">
        <span>Case study</span>
      </div>
      <FieldError id={`${id}-error`} message={error} />
      <p className="adm-vh" role="status">
        {note}
      </p>
    </fieldset>
  );
}
