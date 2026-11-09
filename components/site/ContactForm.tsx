'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { fill } from '@/lib/cms/labels';
import type { Labels } from '@/lib/cms/types';
import { mailto } from './config';

// The owner's EmailJS account. Public by design: EmailJS public keys are meant to ship to the browser.
const EMAILJS_SERVICE = 'gmail_service';
const EMAILJS_TEMPLATE = 'template_vzgo2ro';
const EMAILJS_PUBLIC_KEY = 'EOLDK6C9reE-FFuGX';

type Status =
  | { kind: 'idle' }
  | { kind: 'invalid'; field: string; message: string }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'failed' };

/** "That didn't send. Email me at {email} instead.", with the address as a link. */
function failedMessage(text: string, email: string): ReactNode {
  const at = text.indexOf('{email}');
  if (at === -1) return text;
  return (
    <>
      {text.slice(0, at)}
      <a href={mailto(email)}>{email}</a>
      {text.slice(at + '{email}'.length)}
    </>
  );
}

export default function ContactForm({ email, labels }: { email: string; labels: Labels }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const sending = status.kind === 'sending';
  const invalid = status.kind === 'invalid' ? status.field : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    setStatus({ kind: 'idle' });

    // The first field that needs fixing, in reading order.
    const bad = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(':invalid');
    if (bad) {
      const label = bad.labels?.[0]?.textContent ?? 'this field';
      setStatus({
        kind: 'invalid',
        field: bad.id,
        message: bad.validity.valueMissing ? fill(labels.formMissing, { field: label }) : labels.formBadEmail,
      });
      bad.focus();
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

  const fieldProps = (id: string) => ({
    id,
    'aria-invalid': invalid === id || undefined,
    'aria-describedby': invalid === id ? 'form-status' : undefined,
    onInput: () => {
      if (invalid === id) setStatus({ kind: 'idle' });
    },
  });

  return (
    <form id="contact-form" noValidate onSubmit={submit}>
      <div className="field">
        <label htmlFor="f-name">{labels.formName}</label>
        <input {...fieldProps('f-name')} name="name" autoComplete="name" required />
      </div>
      <div className="field">
        <label htmlFor="f-email">{labels.formEmail}</label>
        <input {...fieldProps('f-email')} name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="f-msg">{labels.formMessage}</label>
        <textarea {...fieldProps('f-msg')} name="message" required />
      </div>
      <div>
        <button className="btn btn-seam" type="submit" aria-disabled={sending || undefined}>
          {sending ? labels.formSendingButton : labels.formSend}
        </button>
      </div>
      <p className="status" id="form-status" role="status" aria-live="polite">
        {status.kind === 'invalid' && status.message}
        {status.kind === 'sending' && labels.formSending}
        {status.kind === 'sent' && labels.formSent}
        {status.kind === 'failed' &&
          (email ? failedMessage(labels.formFailed, email) : "That didn't send. Please try again in a moment.")}
      </p>
    </form>
  );
}
