import {
  content,
  getAssistantKnowledge,
  getCapabilities,
  getCareer,
  getFeaturedProjects,
  getHomeCopy,
  getPrinciples,
  getSite,
  getSocialLinks,
  getUniverseNodes,
} from '@/content';
import { buildSourceIndex } from '@/lib/assistant/source-index';
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
  return (
    <>
      <Prelude name={site.displayName} />
      <HeroSection site={site} copy={home.hero} />
      <IdentitySection site={site} />
      <UniverseSection copy={home.universe} nodes={getUniverseNodes()} />
      <ProjectsSection copy={home.projects} projects={getFeaturedProjects()} />
      <PhilosophySection copy={home.philosophy} principles={getPrinciples()} />
      <CapabilitiesSection copy={home.capabilities} groups={getCapabilities()} />
      <JourneySection copy={home.experience} career={getCareer()} />
      <AskAISection copy={home.assistant} knowledge={getAssistantKnowledge()} sourceIndex={buildSourceIndex(content)} />
      <ContactSection copy={home.contact} social={getSocialLinks()} />
      <HomeMotion />
    </>
  );
}
