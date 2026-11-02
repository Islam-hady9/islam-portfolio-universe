import {
  content,
  getAssistantKnowledge,
  getCapabilities,
  getCareer,
  getFeaturedProjects,
  getHomeCopy,
  getMedia,
  getPrinciples,
  getSite,
  getSocialLinks,
  getUniverseNodes,
} from '@/content';
import { buildSourceIndex } from '@/lib/assistant/source-index';
import { formatDuration, reelAsset, reelView, spokenDuration } from '@/lib/media';
import { resumeDocument } from '@/lib/resume';
// Shared media components first, in the same order as on /about (one CSS order for both routes).
import { IntroReelHost } from '@/components/media/IntroReelHost';
import { IntroReelTrigger } from '@/components/media/IntroReelTrigger';
import { PersonalPortrait } from '@/components/media/PersonalPortrait';
import { Prelude } from '@/components/scenes/Prelude';
import { HeroSection } from '@/components/scenes/HeroSection';
import { IdentitySection } from '@/components/scenes/IdentitySection';
import { UniverseSection } from '@/components/scenes/UniverseSection';
import { ProjectsSection } from '@/components/scenes/ProjectsSection';
import { PhilosophySection } from '@/components/scenes/PhilosophySection';
import { CapabilitiesSection } from '@/components/scenes/CapabilitiesSection';
import { JourneySection } from '@/components/scenes/JourneySection';
import { AskAISection } from '@/components/scenes/AskAISection';
import { ContactSection } from '@/components/scenes/ContactSection';
import { HomeMotion } from '@/components/motion/HomeMotion';

/** The cinematic home: S0–S9 in the approved narrative order (spec §5). */
export default function HomePage() {
  const site = getSite();
  const home = getHomeCopy();
  const media = getMedia();
  const reel = reelAsset();
  const resume = resumeDocument();
  const reelLabels = {
    label: media.introReel.ctaLabel,
    duration: formatDuration(reel.duration),
    spokenDuration: spokenDuration(reel.duration),
  };
  return (
    <>
      <Prelude name={site.displayName} />
      <HeroSection
        site={site}
        copy={home.hero}
        resume={resume}
        reel={
          <IntroReelTrigger
            {...reelLabels}
            variant="chip"
            meta={media.introReel.eyebrow}
            thumbnail={{ src: reel.thumbnail.src, sources: reel.thumbnail.sources }}
            dataAction="hero-reel"
          />
        }
      />
      <IdentitySection
        site={site}
        portrait={
          <PersonalPortrait
            variant="band"
            alt={media.portrait.alt}
            eyebrow={media.portrait.eyebrow}
            sizes="(max-width: 767px) 92vw, (max-width: 1099px) 34vw, 32vw"
            action={<IntroReelTrigger {...reelLabels} variant="overlay" dataAction="identity-reel" />}
          />
        }
      />
      <UniverseSection copy={home.universe} nodes={getUniverseNodes()} />
      <ProjectsSection copy={home.projects} projects={getFeaturedProjects()} />
      <PhilosophySection copy={home.philosophy} principles={getPrinciples()} />
      <CapabilitiesSection copy={home.capabilities} groups={getCapabilities()} />
      <JourneySection copy={home.experience} career={getCareer()} />
      <AskAISection
        copy={home.assistant}
        knowledge={getAssistantKnowledge()}
        sourceIndex={buildSourceIndex(content)}
      />
      <ContactSection copy={home.contact} social={getSocialLinks()} resume={resume} />
      <HomeMotion />
      <IntroReelHost reel={reelView(media.introReel)} />
    </>
  );
}
