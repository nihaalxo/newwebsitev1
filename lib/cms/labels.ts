// The short words on the public site: the menu, buttons, the contact form's messages and the case file's labels.
// Safe to import from client components. Their words are in components/site/copy.ts under "labels".

export const LABEL_KEYS = [
  // Menu and footer
  'skip',
  'navWork',
  'navLair',
  'navAbout',
  'navCv',
  'navContact',
  'sound',
  'footerEmail',
  'linkedin',
  'mailPill',
  // Work and All projects
  'viewAll',
  'back',
  'filterAll',
  'catBrand',
  'catSpatial',
  'catInterface',
  'catPrint',
  // The Lair, About and CV
  'enterLair',
  'howBuilt',
  'factStudied',
  'factTools',
  'factBasedIn',
  'factAvailable',
  'dossierFile',
  'dossierStamp',
  'dossierHint',
  'cvDownload',
  // Contact form
  'copyEmail',
  'copied',
  'copySelected',
  'formName',
  'formEmail',
  'formMessage',
  'formSend',
  'formSendingButton',
  'formMissing',
  'formBadEmail',
  'formSending',
  'formSent',
  'formFailed',
  // Case files
  'caseClose',
  'caseAllWork',
  'casePrev',
  'caseNext',
  'specYear',
  'specDiscipline',
  'specShown',
  'specRole',
  'specType',
  'specTools',
  'specBuiltWith',
  'specDeliverables',
  'specLink',
  'fillDiscipline',
  'fillRole',
  'fillType',
  'fillTools',
  'fillCapture',
  // Page not found
  'lostTitle',
  'lostLead',
  'lostWork',
  'lostHome',
] as const;

export type LabelKey = (typeof LABEL_KEYS)[number];

export type Labels = Record<LabelKey, string>;

/** Fills in "{name}" placeholders, e.g. fill('Fill in "{field}", then send.', { field: 'Your name' }). */
export function fill(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole);
}
