import type { Metadata, Viewport } from 'next'
import { Bodoni_Moda, Manrope } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const bodoni = Bodoni_Moda({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-ui',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SC Studio & Esmalteria | Especialistas em Unhas & Alongamento em BH',
  description:
    'Especialistas em alongamento de unhas e esmalteria em Belo Horizonte. Beleza que valoriza você. Agende online seu horário no SC Studio & Esmalteria.',
  keywords: [
    'alongamento de unhas BH',
    'esmalteria Belo Horizonte',
    'nail salon',
    'manicure BH',
    'pedicure',
    'unhas em gel',
    'Santa Efigênia',
  ],
  authors: [{ name: 'SC Studio & Esmalteria' }],
  openGraph: {
    title: 'SC Studio & Esmalteria | Especialistas em Unhas & Alongamento',
    description:
      'Beleza que valoriza você. Agende online seu horário no melhor estúdio de unhas de BH.',
    locale: 'pt_BR',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#c9a87c',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="bg-background">
      <body
        className={`${bodoni.variable} ${manrope.variable} font-sans antialiased`}
      >
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
