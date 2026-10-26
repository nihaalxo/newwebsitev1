'use client';

import { useId, useState, type FormEvent } from 'react';
import { mailto } from './config';

// The owner's EmailJS account. Public by design: EmailJS public keys are meant to ship to the browser.
const EMAILJS_SERVICE = 'gmail_service';
const EMAILJS_TEMPLATE = 'template_vzgo2ro';
const EMAILJS_PUBLIC_KEY = 'EOLDK6C9reE-FFuGX';

type FieldName = 'name' | 'email' | 'message';

type Status =
  | { kind: 'idle' }
  | { kind: 'invalid'; field: FieldName; message: string }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'failed' };

/** The first problem in the form, in reading order, or null when it can be sent. */
function findProblem(form: HTMLFormElement): { field: FieldName; message: string } | null {
  const value = (name: FieldName) => String(new FormData(form).get(name) ?? '').trim();
  if (!value('name')) return { field: 'name', message: 'Add your name, then send.' };
  if (!value('email')) return { field: 'email', message: 'Add your email so I can reply.' };
  const emailInput = form.elements.namedItem('email');
  if (emailInput instanceof HTMLInputElement && emailInput.validity.typeMismatch) {
    return { field: 'email', message: 'Check the email address: it needs an @ and a domain.' };
  }
  if (!value('message')) return { field: 'message', message: 'Tell me what you need help with, then send.' };
  return null;
}

export default function ContactForm({ email }: { email: string }) {
  // Ids come from useId, so they can never collide with ids elsewhere on the page (Contact's email link, say).
  const uid = useId();
  const idOf = (part: FieldName | 'status') => `${uid}-${part}`;
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const sending = status.kind === 'sending';
  const invalidField = status.kind === 'invalid' ? status.field : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;

    const problem = findProblem(form);
    if (problem) {
      setStatus({ kind: 'invalid', ...problem });
      const field = form.elements.namedItem(problem.field);
      if (field instanceof HTMLElement) field.focus();
      return;
    }

    const data = new FormData(form);
    setStatus({ kind: 'sending' });
    try {
      const emailjs = await import('@emailjs/browser');
      await emailjs.send(
        EMAILJS_SERVICE,
        EMAILJS_TEMPLATE,
        {
          from_name: String(data.get('name')).trim(),
          from_email: String(data.get('email')).trim(),
          message: String(data.get('message')).trim(),
        },
        { publicKey: EMAILJS_PUBLIC_KEY },
      );
      form.reset();
      setStatus({ kind: 'sent' });
    } catch {
      setStatus({ kind: 'failed' });
    }
  }

  function fieldProps(name: FieldName) {
    const invalid = invalidField === name;
    return {
      id: idOf(name),
      name,
      'aria-invalid': invalid || undefined,
      'aria-describedby': invalid ? idOf('status') : undefined,
      onInput: () => {
        if (invalid) setStatus({ kind: 'idle' });
      },
    };
  }

  return (
    <form className="contact-form" noValidate onSubmit={submit}>
      <div className="field">
        <label htmlFor={idOf('name')}>Your name</label>
        <input {...fieldProps('name')} autoComplete="name" required />
      </div>
      <div className="field">
        <label htmlFor={idOf('email')}>Your email</label>
        <input {...fieldProps('email')} type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor={idOf('message')}>What do you need help with?</label>
        <textarea {...fieldProps('message')} required />
      </div>
      <div>
        <span className="lit">
          <button className="btn btn-seam" type="submit" aria-disabled={sending || undefined}>
            {sending ? 'Sending' : 'Send message'}
          </button>
        </span>
      </div>
      <p className={status.kind === 'failed' || status.kind === 'invalid' ? 'status is-problem' : 'status'} id={idOf('status')} role="status">
        {status.kind === 'invalid' && status.message}
        {status.kind === 'sending' && 'Sending your message.'}
        {status.kind === 'sent' && "Got it. I'll reply as soon as I'm done saving the world."}
        {status.kind === 'failed' &&
          (email ? (
            <>
              That didn&apos;t send. Email me at <a href={mailto(email)}>{email}</a> instead.
            </>
          ) : (
            "That didn't send. Please try again in a moment."
          ))}
      </p>
    </form>
  );
}
