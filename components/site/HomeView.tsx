import type { Project, Settings } from '@/lib/cms/types';
import About from './About';
import CaseDialog from './CaseDialog';
import { toCaseProject } from './case-project';
import Contact from './Contact';
import Cv from './Cv';
import Hero from './Hero';
import Lair from './Lair';
import Work from './Work';
import WorkPeek from './WorkPeek';
import { toWorkItem } from './work-item';

interface HomeViewProps {
  settings: Settings;
  /** Every published project, in site order: the case file steps through them. */
  projects: Project[];
  highlights: Project[];
  rest: Project[];
  /** The case file on how the Lair was built, linked from the Lair section. */
  lairStorySlug: string | null;
}

/** The home page's content, inside SiteChrome. Built into index.html, and drawn by the admin's preview. */
export default function HomeView({ settings, projects, highlights, rest, lairStorySlug }: HomeViewProps) {
  return (
    <>
      <main id="top">
        <Hero settings={settings} />
        <Work settings={settings} highlights={highlights.map(toWorkItem)} rest={rest.map(toWorkItem)} />
        <Lair settings={settings} storySlug={lairStorySlug} />
        <About settings={settings} />
        <Cv settings={settings} />
        <Contact settings={settings} />
      </main>
      <WorkPeek />
      <CaseDialog
        projects={projects.map(toCaseProject)}
        fiveLine={settings.fiveLine}
        labels={settings.labels}
        storyPrompts={settings.storyPrompts}
      />
    </>
  );
}
