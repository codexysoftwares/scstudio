export const revalidate = 60

import { notFound } from 'next/navigation'
import { CalendarDays, UserRound } from 'lucide-react'

import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { SequentialBookingForm } from '@/components/sequential-booking-form'
import { Card, CardContent } from '@/components/ui/card'
import { getLandingThemeStyles } from '@/lib/landing-palettes'
import {
  getPublicBusinessHours,
  getPublicProfessionalById,
  getPublicServices,
  getPublicSiteContent,
} from '@/lib/public-data'

export default async function ProfessionalBookingPage({
  params,
}: {
  params: Promise<{ professionalId: string }>
}) {
  const { professionalId } = await params

  const [professional, services, businessHours, siteContent] = await Promise.all([
    getPublicProfessionalById(professionalId),
    getPublicServices(),
    getPublicBusinessHours(),
    getPublicSiteContent(),
  ])

  if (!professional || !professional.acceptsOnlineBooking) notFound()

  const themeStyles = getLandingThemeStyles(
    siteContent?.themeVariant,
    siteContent?.customPrimary,
    siteContent?.customAccent,
  )

  return (
    <main className="min-h-screen bg-background" style={themeStyles}>
      <Header />

      <section className="py-20 md:py-28">
        <div className="mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-16">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
              <UserRound className="h-4 w-4" />
              <span className="text-sm font-medium tracking-wide">Agenda Exclusiva</span>
            </div>
            <h1 className="mb-2 text-3xl font-semibold text-foreground md:text-4xl lg:text-5xl">
              {professional.name}
            </h1>
            {professional.role && (
              <p className="text-lg text-muted-foreground">{professional.role}</p>
            )}
            <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Agende diretamente na agenda desta profissional
            </p>
          </div>

          <div className="mx-auto max-w-5xl">
            <Card className="border-border/50 shadow-xl">
              <CardContent className="p-6 md:p-8">
                <SequentialBookingForm
                  services={services}
                  businessHours={businessHours}
                  lockedProfessionalId={professional.id}
                  lockedProfessionalName={professional.name}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Footer contact={siteContent?.contact} />
    </main>
  )
}
