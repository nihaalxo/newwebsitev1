'use client';

import type { ReactNode } from 'react';
import { Warning } from './icons';

// Form primitives. Each one wires its label, helper text and error message to the control
// (htmlFor, aria-describedby, aria-invalid), so screen readers hear all three.

export function describedBy(id: string, ...parts: (false | null | undefined | string)[]): string | undefined {
  const ids = parts.filter((part): part is string => Boolean(part)).map((suffix) => `${id}-${suffix}`);
  return ids.length ? ids.join(' ') : undefined;
}

export function FieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p className="adm-error" id={id}>
      <Warning />
      <span>{message}</span>
    </p>
  );
}

export function RequiredMark() {
  return <span className="adm-req">Required</span>;
}

interface BaseFieldProps {
  id: string;
  label: ReactNode;
  help?: ReactNode;
  error?: string;
  required?: boolean;
}

function FieldHead({ id, label, required, aside }: { id: string; label: ReactNode; required?: boolean; aside?: ReactNode }) {
  return (
    <div className="adm-label-row">
      <label className="adm-label" htmlFor={id}>
        {label}
        {required && <RequiredMark />}
      </label>
      {aside}
    </div>
  );
}

interface TextFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: 'text' | 'email' | 'url';
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'url';
  maxLength?: number;
  placeholder?: string;
  autoComplete?: string;
  spellCheck?: boolean;
  className?: string;
}

export function TextField({ id, label, help, error, required, value, onChange, onBlur, type = 'text', ...rest }: TextFieldProps) {
  const { inputMode, maxLength, placeholder, autoComplete, spellCheck, className } = rest;
  return (
    <div className={className ? `adm-field ${className}` : 'adm-field'}>
      <FieldHead id={id} label={label} required={required} />
      {help && (
        <p className="adm-help" id={`${id}-help`}>
          {help}
        </p>
      )}
      <input
        id={id}
        className="adm-input"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete ?? 'off'}
        spellCheck={spellCheck}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        data-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help ? 'help' : null, error && 'error')}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

interface TextAreaFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
  /** Shows a counter; past `target` the counter turns to a gentle warning. */
  target?: number;
  placeholder?: string;
}

export function TextAreaField({ id, label, help, error, required, value, onChange, rows = 5, maxLength, target, placeholder }: TextAreaFieldProps) {
  const over = target !== undefined && value.length > target;
  const counter =
    target === undefined ? null : (
      <span className="adm-count" id={`${id}-count`} data-over={over || undefined}>
        {over ? `${value.length} characters, ${value.length - target} over ${target}` : `${value.length} of ${target}`}
      </span>
    );
  return (
    <div className="adm-field">
      <FieldHead id={id} label={label} required={required} aside={counter} />
      {help && (
        <p className="adm-help" id={`${id}-help`}>
          {help}
        </p>
      )}
      <textarea
        id={id}
        className="adm-input"
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        data-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help ? 'help' : null, target !== undefined && 'count', error && 'error')}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

interface SelectFieldProps<T extends string> extends BaseFieldProps {
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
}

export function SelectField<T extends string>({ id, label, help, error, required, value, onChange, options }: SelectFieldProps<T>) {
  return (
    <div className="adm-field">
      <FieldHead id={id} label={label} required={required} />
      {help && (
        <p className="adm-help" id={`${id}-help`}>
          {help}
        </p>
      )}
      <select
        id={id}
        className="adm-input adm-select"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        aria-invalid={error ? true : undefined}
        data-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help ? 'help' : null, error && 'error')}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

interface SwitchFieldProps {
  id: string;
  label: ReactNode;
  help?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** A checkbox presented as an on/off switch; screen readers announce it as a switch. */
export function SwitchField({ id, label, help, checked, onChange, disabled }: SwitchFieldProps) {
  return (
    <div className="adm-switch">
      <span className="adm-switch-control">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={help ? `${id}-help` : undefined}
        />
        <span className="adm-switch-track" aria-hidden="true" />
      </span>
      <span className="adm-switch-text">
        <label className="adm-label" htmlFor={id}>
          {label}
        </label>
        {help && (
          <span className="adm-help" id={`${id}-help`}>
            {help}
          </span>
        )}
      </span>
    </div>
  );
}

interface ChoiceFieldProps<T extends string | number> {
  name: string;
  legend: ReactNode;
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string; help?: string }[];
}

/** A radio group drawn as a row of options. */
export function ChoiceField<T extends string | number>({ name, legend, value, onChange, options }: ChoiceFieldProps<T>) {
  return (
    <fieldset className="adm-choice">
      <legend className="adm-label">{legend}</legend>
      <div className="adm-choice-options">
        {options.map((option) => {
          const optionId = `${name}-${option.id}`;
          return (
            <label key={option.id} className="adm-chip" htmlFor={optionId}>
              <input
                id={optionId}
                type="radio"
                name={name}
                checked={value === option.id}
                onChange={() => onChange(option.id)}
              />
              <span className="adm-chip-label">{option.label}</span>
              {option.help && <span className="adm-chip-help">{option.help}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
