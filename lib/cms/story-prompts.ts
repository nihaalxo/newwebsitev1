import type { Category } from './types';

/**
 * What a strong case file covers, by category. The admin lists them above the story, and a published case file with
 * no text yet shows them as "To add" placeholders, so the shape of the story is visible from the start.
 */
export const STORY_PROMPTS: Record<Category, { heading: string; hint: string }[]> = {
  brand: [
    { heading: 'The brief', hint: 'Who it was for and what had to change, in two or three sentences.' },
    { heading: 'Three decisions', hint: 'The moves that shaped the identity, each with one image: the mark, the type, the pattern.' },
    { heading: 'The system', hint: 'Mark construction, typeface, palette and one page of guidelines.' },
    { heading: 'In use', hint: 'Photos of the identity out in the world, if they exist. Mockups second.' },
  ],
  spatial: [
    { heading: 'The brief', hint: "What's wrong with watching or browsing this today, in two sentences." },
    { heading: 'Interaction model', hint: 'Windows or volumes, gaze and pinch, and what someone does in the first ten seconds.' },
    { heading: 'Toolchain', hint: 'What it was built in, which parts were prototype and which were real-time.' },
    { heading: "What I'd do next", hint: 'One short paragraph of honest self-critique.' },
  ],
  interface: [
    { heading: 'The brief', hint: 'Who uses it and what they need to get done.' },
    { heading: 'Key flows', hint: 'The two or three journeys the product is built around.' },
    { heading: 'Screens', hint: 'Final screens at device size, with the states that matter.' },
    { heading: "What I'd change", hint: 'One short paragraph of honest self-critique.' },
  ],
  print: [
    { heading: 'The brief', hint: 'What the piece had to say, and to whom.' },
    { heading: 'Process', hint: 'Sketches, tests and the routes you dropped.' },
    { heading: 'The finished piece', hint: 'Spreads, posters or the film itself, at full size.' },
    { heading: 'Credits and tools', hint: 'Who else was involved and what it was made with.' },
  ],
};
