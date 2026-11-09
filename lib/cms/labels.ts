// The short words on the public site: the menu, buttons, the contact form's messages and the case file's labels.
// Safe to import from client components. Their starting words are in default-settings.json under "labels"; the admin
// edits them in Site settings, and an empty box goes back to the starting words.

export interface LabelField {
  key: string;
  /** What the admin calls it. */
  label: string;
  help?: string;
  /** Longer texts get a bigger box and limit. */
  long?: boolean;
}

export interface LabelGroup {
  id: string;
  title: string;
  fields: readonly LabelField[];
}

export const LABEL_GROUPS = [
  {
    id: 'labels-menu',
    title: 'Menu and footer',
    fields: [
      { key: 'skip', label: 'Skip link', help: 'The first thing keyboard users reach, at the top left.' },
      { key: 'navWork', label: 'Menu: Work' },
      { key: 'navLair', label: 'Menu: The Lair', help: 'On narrow screens the first word is dropped, so “The Lair” shows as “Lair”.' },
      { key: 'navAbout', label: 'Menu: About' },
      { key: 'navCv', label: 'Menu: CV' },
      { key: 'navContact', label: 'Menu: Contact' },
      { key: 'sound', label: 'Sound button' },
      { key: 'footerEmail', label: 'Footer: email link' },
      { key: 'linkedin', label: 'LinkedIn link', help: 'In the CV, under Contact and in the footer.' },
      { key: 'mailPill', label: 'Email button on phones', help: 'Floats at the bottom of the screen between the hero and Contact.' },
    ],
  },
  {
    id: 'labels-work',
    title: 'Work and All projects',
    fields: [
      { key: 'viewAll', label: 'Button under the work' },
      { key: 'back', label: 'Back link on All projects' },
      { key: 'filterAll', label: 'Filter: all projects' },
      { key: 'catBrand', label: 'Filter: Brand' },
      { key: 'catSpatial', label: 'Filter: Spatial' },
      { key: 'catInterface', label: 'Filter: Interface' },
      { key: 'catPrint', label: 'Filter: Print and motion' },
    ],
  },
  {
    id: 'labels-lair',
    title: 'The Lair, About and CV',
    fields: [
      { key: 'enterLair', label: 'Button into the Lair' },
      { key: 'howBuilt', label: 'Button to its case file' },
      { key: 'factStudied', label: 'About: Studied' },
      { key: 'factTools', label: 'About: Tools' },
      { key: 'factBasedIn', label: 'About: Based in' },
      { key: 'factAvailable', label: 'About: Available for' },
      { key: 'dossierFile', label: 'Photo doors: file number' },
      { key: 'dossierStamp', label: 'Photo doors: stamp' },
      { key: 'dossierHint', label: 'Photo doors: hint' },
      { key: 'cvDownload', label: 'CV download button' },
    ],
  },
  {
    id: 'labels-contact',
    title: 'Contact form',
    fields: [
      { key: 'copyEmail', label: 'Copy button' },
      { key: 'copied', label: 'Copy button, once copied' },
      { key: 'copySelected', label: 'Copy button, when the browser refuses to copy', help: 'The email is selected instead.' },
      { key: 'formName', label: 'Name field' },
      { key: 'formEmail', label: 'Email field' },
      { key: 'formMessage', label: 'Message field' },
      { key: 'formSend', label: 'Send button' },
      { key: 'formSendingButton', label: 'Send button, while sending' },
      { key: 'formMissing', label: 'When a field is empty', help: '{field} becomes the name of the field.', long: true },
      { key: 'formBadEmail', label: 'When the email address is wrong', long: true },
      { key: 'formSending', label: 'While sending', long: true },
      { key: 'formSent', label: 'Once sent', long: true },
      { key: 'formFailed', label: 'When it fails', help: '{email} becomes your email address, as a link.', long: true },
    ],
  },
  {
    id: 'labels-case',
    title: 'Case files',
    fields: [
      { key: 'caseClose', label: 'Close button' },
      { key: 'caseAllWork', label: 'Link to All projects' },
      { key: 'casePrev', label: 'Previous project' },
      { key: 'caseNext', label: 'Next project' },
      { key: 'specYear', label: 'Label: year' },
      { key: 'specDiscipline', label: 'Label: discipline' },
      { key: 'specShown', label: 'Label: what the images show' },
      { key: 'specRole', label: 'Label: role' },
      { key: 'specType', label: 'Label: project type' },
      { key: 'specTools', label: 'Label: tools' },
      { key: 'specBuiltWith', label: 'Label: tools, for spatial projects' },
      { key: 'specDeliverables', label: 'Label: deliverables' },
      { key: 'specLink', label: 'Label: link' },
      { key: 'fillDiscipline', label: 'Until the discipline is filled in', long: true },
      { key: 'fillRole', label: 'Until the role is filled in', long: true },
      { key: 'fillType', label: 'Until the project type is set', long: true },
      { key: 'fillTools', label: 'Until the tools are filled in', long: true },
      { key: 'fillCapture', label: 'Until a spatial project has a film', long: true },
    ],
  },
  {
    id: 'labels-lost',
    title: 'Page not found',
    fields: [
      { key: 'lostTitle', label: 'Heading' },
      { key: 'lostLead', label: 'Text', long: true },
      { key: 'lostWork', label: 'Button to the work' },
      { key: 'lostHome', label: 'Button to the home page' },
    ],
  },
] as const satisfies readonly LabelGroup[];

export type LabelKey = (typeof LABEL_GROUPS)[number]['fields'][number]['key'];

export type Labels = Record<LabelKey, string>;

export const LABEL_KEYS: LabelKey[] = LABEL_GROUPS.flatMap((group) => group.fields.map((field) => field.key));

export const LABEL_LIMITS = { short: 120, long: 300 } as const;

/** The longest a label may be. */
export function labelLimit(key: LabelKey): number {
  const field = LABEL_GROUPS.flatMap((group): readonly LabelField[] => group.fields).find((f) => f.key === key);
  return field?.long ? LABEL_LIMITS.long : LABEL_LIMITS.short;
}

/** Fills in "{name}" placeholders, e.g. fill('Fill in "{field}", then send.', { field: 'Your name' }). */
export function fill(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole);
}
