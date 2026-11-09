import AllWork from './AllWork';
import CaseDialog from './CaseDialog';
import { toCaseProject } from './case-project';
import { getSettings, listPublished } from './data';
import FiveLine from './FiveLine';
import { toWorkItem } from './work-item';

/** The All projects page; at /work/<slug> it opens with that project's case file. */
export default async function AllProjects({ openSlug }: { openSlug?: string }) {
  const [projects, settings] = await Promise.all([listPublished(), getSettings()]);
  return (
    <>
      <main id="top">
        <section className="all-page" aria-labelledby="all-title">
          <div className="wrap">
            <a className="back" href="/#work">
              <svg className="icon" aria-hidden="true">
                <use href="#back" />
              </svg>
              {settings.labels.back}
              <span className="vh"> to the home page</span>
            </a>
            <h1 className="title-xl" id="all-title">
              {settings.allProjectsTitle}
            </h1>
            <FiveLine text={settings.fiveLine} />
            <AllWork items={projects.map(toWorkItem)} labels={settings.labels} />
          </div>
        </section>
      </main>
      <CaseDialog
        projects={projects.map(toCaseProject)}
        fiveLine={settings.fiveLine}
        labels={settings.labels}
        storyPrompts={settings.storyPrompts}
        initialSlug={openSlug}
        overAllWork
      />
    </>
  );
}
