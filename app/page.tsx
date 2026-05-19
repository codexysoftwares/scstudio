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

export default function HomePage() {
  return (
    <IntroWrapper>
      <main className="min-h-screen">
        <Header />
        <Hero />
        <Services />
        <Schedule />
        <About />
        <Testimonials />
        <Contact />
        <Footer />
        <WhatsAppButton />
      </main>
    </IntroWrapper>
  )
}
