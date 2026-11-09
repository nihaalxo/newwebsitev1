import { Fragment, type ReactNode } from 'react';
import type { CvSection, Settings } from '@/lib/cms/types';

/** The parts with " | " between them, adjacent words joined into one text, as the mockup writes "London | <a>". */
function joined(parts: ReactNode[]): ReactNode[] {
  const out: ReactNode[] = [];
  const push = (node: ReactNode) => {
    const last = out.length - 1;
    if (typeof node === 'string' && typeof out[last] === 'string') out[last] = `${out[last]}${node}`;
    else out.push(node);
  };
  parts.forEach((part, i) => {
    if (i > 0) push(' | ');
    push(part);
  });
  return out;
}

/** Positions and dates only: the PDF, one click away, has the full details. */
export default function Cv({ settings }: { settings: Settings }) {
  const { cvTitle, cvHeadline, cvPlace, cvUrl, cvSections, email, linkedin, labels } = settings;
  const headline = cvHeadline
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
  const contact = [
    cvPlace,
    email && (
      <a key="email" href={`mailto:${email}`}>
        {email}
      </a>
    ),
    linkedin && (
      <a key="linkedin" href={linkedin} target="_blank" rel="noopener">
        {labels.linkedin}
        <span className="vh"> (opens in a new tab)</span>
      </a>
    ),
  ].filter(Boolean);
  const columns: CvSection[][] = [cvSections.filter((s) => s.column !== 2), cvSections.filter((s) => s.column === 2)];

  return (
    <section className="cv" id="cv" aria-labelledby="cv-title">
      <div className="wrap">
        <div className="cv-head">
          <div>
            <h2 className="title-s" id="cv-title">
              {cvTitle}
            </h2>
            {headline.length > 0 && (
              <p className="cv-role">
                {headline.map((part, i) => (
                  <Fragment key={i}>
                    {i > 0 && ' | '}
                    <span>{part}</span>
                  </Fragment>
                ))}
              </p>
            )}
            {contact.length > 0 && (
              <p className="cv-contact">{joined(contact)}</p>
            )}
          </div>
          {cvUrl && (
            <a className="btn btn-seam" href={cvUrl} download>
              {labels.cvDownload}
              <svg className="icon" aria-hidden="true">
                <use href="#dl" />
              </svg>
            </a>
          )}
        </div>

        {cvSections.length > 0 && (
          <div className="cv-cols">
            {columns
              .filter((column) => column.length > 0)
              .map((column, c) => (
                <div className="cv-col" key={c}>
                  {column.map((section) => (
                    <section className="cv-block" key={section.id}>
                      <h3 id={`cv-${section.id}`}>{section.title}</h3>
                      <ul className="cv-list">
                        {section.entries.map((entry, i) => (
                          <li key={i}>
                            <p className="cv-pos">
                              <span>{entry.role}</span>
                              {entry.when && <span className="cv-when">{entry.when}</span>}
                            </p>
                            {entry.at && <p className="cv-at">{entry.at}</p>}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
