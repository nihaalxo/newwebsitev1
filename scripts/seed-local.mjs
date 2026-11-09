#!/usr/bin/env node
// Builds the local-mode content store from scripts/catalogue.json and the project images in /public.
//
//   node scripts/seed-local.mjs           # refuses to replace an existing .cms/content.json
//   node scripts/seed-local.mjs --force   # rebuilds it (and the images) from scratch
//
// For each project it writes public/uploads/seed/<slug>.webp (original size) and <slug>-sm.webp (960px wide at most),
// then writes .cms/content.json with every project published and the default site settings.

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOGUE_FILE = path.join(ROOT, 'scripts', 'catalogue.json');
const CONTENT_FILE = path.join(ROOT, '.cms', 'content.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SEED_DIR = path.join(PUBLIC_DIR, 'uploads', 'seed');

const WEBP_QUALITY = 82;
const SMALL_WIDTH = 960;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CATEGORIES = ['brand', 'spatial', 'interface', 'print'];

// An exact copy of DEFAULT_SETTINGS in lib/cms/defaults.ts (without updatedAt). Change both together.
const DEFAULT_SETTINGS = {
  heroLead: 'Product | UI/UX | Multidisciplinary',
  aboutStatement:
    "I'm Nihaal, a multidisciplinary designer trained in Graphic and Media Design at UAL in London. I work in three places: on the shelf, with identities like My Chaii London and RGFC; on screen, with apps like Green Print; and in space, with Apple Vision Pro concepts reimagining Netflix and live football.",
  basedIn: '',
  availability: '',
  cvUrl: '',
  avatar: {
    kind: 'image',
    src: '/uploads/seed/avatar.jpg',
    alt: "Nihaal's 3D avatar in a black suit with glowing cyan seams and an X across the chest",
    width: 800,
    height: 600,
  },
  portrait: null,
  email: 'nihaalnazeerxo@gmail.com',
  linkedin: 'https://www.linkedin.com/in/nihaal-nazeer-b6187117a/',
  instagram: '',
  tools: 'Blender, After Effects, Premiere Pro, Illustrator, Photoshop, InDesign, Lightroom, Audition and XD',
  education: ['BA (Hons) Graphic and Media Design, UAL', 'CertHE Design, Screen and Media, UAL'],
  lairUrl: 'https://interactive.nihaalnazeer.com/',
  lairBlurb:
    'I rebuilt my portfolio as a world you can walk through: a hall of light, a shooting range and a wall of screens. Bring a keyboard and a mouse.',
  lairBuiltWith: '',
  heroFilm: { kind: 'video', src: '/finalheroshot.compressed.mp4', poster: '/uploads/seed/hero-poster.jpg', alt: '' },
  heroFilmStart: 9,
  heroFilmLoopStart: 1.2,
  heroFilmLoopEnd: 24.5,
  lairFilm: {
    kind: 'video',
    src: '/tutorialfullanimation0000-3500_2.compressed.mp4',
    poster: '/uploads/seed/immersive-portfolio-website.webp',
    alt: 'Walkthrough: a desk with a curved monitor showing the Lair, with the controls lit on the keyboard',
  },
  contactFilm: { kind: 'video', src: '/comp_1.compressed.mp4', alt: '' },
};

/** Files the settings point at that this script doesn't generate. */
const SETTINGS_FILES = [
  'uploads/seed/avatar.jpg',
  'uploads/seed/hero-poster.jpg',
  'finalheroshot.compressed.mp4',
  'tutorialfullanimation0000-3500_2.compressed.mp4',
  'comp_1.compressed.mp4',
];

/**
 * A UUID derived from a name (RFC 4122 version 5, URL namespace), so re-seeding gives every project the same id
 * and admin links keep working.
 */
function uuidFromName(name) {
  const URL_NAMESPACE = Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex');
  const bytes = createHash('sha1').update(URL_NAMESPACE).update(name).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function fail(message) {
  console.error(`seed-local: ${message}`);
  process.exit(1);
}

function validateCatalogue(projects) {
  const problems = [];
  const slugs = new Set();
  for (const p of projects) {
    const label = p.slug || p.title || '(untitled)';
    if (!SLUG_PATTERN.test(p.slug ?? '')) problems.push(`${label}: slug must be lowercase words joined by hyphens`);
    if (slugs.has(p.slug)) problems.push(`${label}: slug is used twice`);
    slugs.add(p.slug);
    if (!CATEGORIES.includes(p.category)) problems.push(`${label}: unknown category "${p.category}"`);
    if (!Number.isInteger(p.year)) problems.push(`${label}: year must be a whole number`);
    if (!Number.isInteger(p.position)) problems.push(`${label}: position must be a whole number`);
    if (!/^#[0-9A-F]{6}$/i.test(p.accent ?? '')) problems.push(`${label}: accent must be a hex colour like #6FF3FF`);
    for (const field of ['title', 'discipline', 'summary', 'alt']) {
      if (!p[field]) problems.push(`${label}: ${field} is empty`);
    }
    if (!existsSync(path.join(PUBLIC_DIR, p.image ?? ''))) problems.push(`${label}: public/${p.image} not found`);
  }
  if (problems.length > 0) fail(`scripts/catalogue.json has problems:\n  ${problems.join('\n  ')}`);
}

/** Converts one source image to the full-size and small WebP files and returns its cover Media. */
/** If the image's corners are transparent, returns an inset crop that removes the rounded corners; otherwise null. */
async function cornerCrop(source) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const alphaAt = (x, y) => data[(y * width + x) * channels + 3];
  if (alphaAt(0, 0) === 255) return null;
  // Along the top edge the transparent run is as long as the corner radius. The edge row itself is slightly
  // translucent (alpha ~244) in some exports, so anything from 200 up counts as opaque.
  let radius = 0;
  while (radius < width / 4 && alphaAt(radius, 0) < 200) radius++;
  const inset = Math.min(radius + 2, Math.floor(Math.min(width, height) * 0.08));
  return { left: inset, top: inset, width: width - inset * 2, height: height - inset * 2 };
}

async function buildCover(project) {
  const source = path.join(PUBLIC_DIR, project.image);
  // The source PNGs have rounded corners baked in as transparency; trim them so the site's own corner treatment shows.
  const crop = await cornerCrop(source);
  const base = () => (crop ? sharp(source).extract(crop) : sharp(source));
  const full = await base().webp({ quality: WEBP_QUALITY }).toFile(path.join(SEED_DIR, `${project.slug}.webp`));
  const small = await base()
    .resize({ width: SMALL_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(path.join(SEED_DIR, `${project.slug}-sm.webp`));
  return {
    media: {
      kind: 'image',
      src: `/uploads/seed/${project.slug}.webp`,
      srcSmall: `/uploads/seed/${project.slug}-sm.webp`,
      alt: project.alt,
      width: full.width,
      height: full.height,
    },
    bytes: full.size + small.size,
  };
}

function toProject(entry, cover, now) {
  return {
    id: uuidFromName(`https://nihaalnazeer.com/work/${entry.slug}`),
    slug: entry.slug,
    title: entry.title,
    category: entry.category,
    year: entry.year,
    discipline: entry.discipline,
    summary: entry.summary,
    cover,
    accent: entry.accent,
    role: '',
    projectType: '',
    tools: '',
    deliverables: '',
    link: '',
    featured: entry.featured === true,
    position: entry.position,
    status: 'published',
    // One wide image so the case study isn't empty until it is written.
    blocks: [{ id: uuidFromName(`https://nihaalnazeer.com/work/${entry.slug}#cover`), type: 'image', media: cover, size: 'wide' }],
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  };
}

async function main() {
  const force = process.argv.includes('--force');
  if (existsSync(CONTENT_FILE) && !force) {
    fail('.cms/content.json already exists, and seeding would replace every edit in it. Run with --force to rebuild it.');
  }

  const { projects: entries } = JSON.parse(await readFile(CATALOGUE_FILE, 'utf8'));
  validateCatalogue(entries);

  const missing = SETTINGS_FILES.filter((file) => !existsSync(path.join(PUBLIC_DIR, file)));
  if (missing.length > 0) console.warn(`seed-local: the default settings point at files that are missing:\n  public/${missing.join('\n  public/')}`);

  await mkdir(SEED_DIR, { recursive: true });
  const now = new Date().toISOString();
  const projects = [];
  let imageBytes = 0;
  for (const entry of [...entries].sort((a, b) => a.position - b.position)) {
    const { media, bytes } = await buildCover(entry);
    imageBytes += bytes;
    projects.push(toProject(entry, media, now));
    console.log(`  ${entry.slug.padEnd(34)} ${media.width}x${media.height}  ${(bytes / 1024).toFixed(0)} KB`);
  }

  const content = { projects, settings: { ...DEFAULT_SETTINGS, updatedAt: now } };
  await mkdir(path.dirname(CONTENT_FILE), { recursive: true });
  const temp = `${CONTENT_FILE}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
  await rename(temp, CONTENT_FILE);

  const highlighted = projects.filter((p) => p.featured).length;
  console.log(
    `\nSeeded ${projects.length} projects (${highlighted} highlighted) into .cms/content.json, ` +
      `with ${(imageBytes / 1024 / 1024).toFixed(1)} MB of WebP images in public/uploads/seed.`,
  );
}

main().catch((error) => fail(error instanceof Error ? error.stack ?? error.message : String(error)));
