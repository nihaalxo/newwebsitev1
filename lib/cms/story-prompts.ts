import { SITE } from '@/components/site/copy';
import type { StoryPrompts } from './types';

/**
 * What a strong case file covers, by category. The project editor lists them above the story, and a published case
 * file with no text yet shows them as "To add" notes, so the shape of the story is visible from the start. The words
 * are in components/site/copy.ts.
 */
export const STORY_PROMPTS: StoryPrompts = SITE.storyPrompts;
