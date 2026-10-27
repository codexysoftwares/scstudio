export const revalidate = 0

import { Header } from '@/components/header'
import { Hero } from '@/components/hero'
import { Services } from '@/components/services'
import { About } from '@/components/about'
import { Testimonials } from '@/components/testimonials'
import { Schedule } from '@/components/schedule'
import { Contact } from '@/components/contact'
import { Footer } from '@/components/footer'
import { WhatsAppButton } from '@/components/whatsapp-button'
import { IntroWrapper } from '@/components/intro-wrapper'
import { Team } from '@/components/team'
import { getPublicServices, getPublicBusinessHours, getPublicSiteContent, getPublicTeamMembers } from '@/lib/public-data'
import { getLandingThemeStyles } from '@/lib/landing-palettes'

export default async function HomePage() {
  const [services, businessHours, siteContent, teamMembers] = await Promise.all([
    getPublicServices(),
    getPublicBusinessHours(),
    getPublicSiteContent(),
    getPublicTeamMembers(),
  ])
  const themeStyles = getLandingThemeStyles(siteContent?.themeVariant, siteContent?.customPrimary, siteContent?.customAccent)

  return (
    <IntroWrapper>
      <main className="min-h-screen" style={themeStyles}>
        <Header />
        <Hero content={siteContent?.hero} />
        <Services services={services} businessHours={businessHours} />
        <Team members={teamMembers} />
        <About content={siteContent?.about} />
        <Schedule hours={businessHours} />
        <Testimonials testimonials={siteContent?.testimonials} />
        <Contact content={siteContent?.contact} />
        <Footer contact={siteContent?.contact} />
        <WhatsAppButton />
      </main>
    </IntroWrapper>
  )
}
