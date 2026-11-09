import type { Settings } from '@/lib/cms/types';
import BrandLink from './BrandLink';
import { mailto } from './config';
import FiveLine from './FiveLine';

export default function SiteFooter({ settings }: { settings: Settings }) {
  const { email, linkedin, fiveFooter, labels } = settings;
  return (
    <footer className="foot">
      <div className="wrap">
        <BrandLink />
        <FiveLine text={fiveFooter} className="" />
        {(email || linkedin) && (
          <p className="foot-links">
            {email && <a href={mailto(email)}>{labels.footerEmail}</a>}
            {linkedin && (
              <a href={linkedin} target="_blank" rel="noopener">
                {labels.linkedin}
                <span className="vh"> (opens in a new tab)</span>
              </a>
            )}
          </p>
        )}
      </div>
    </footer>
  );
}
