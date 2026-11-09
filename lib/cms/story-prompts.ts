import { DEFAULT_SETTINGS } from './defaults';
import type { StoryPrompts } from './types';

/**
 * What a strong case file covers, by category, before any are changed in Site settings > Case files. The project
 * editor lists them above the story, and a published case file with no text yet shows them as "To add" placeholders,
 * so the shape of the story is visible from the start. The words are in default-settings.json.
 */
export const STORY_PROMPTS: StoryPrompts = DEFAULT_SETTINGS.storyPrompts;
