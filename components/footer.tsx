'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Sparkles, Instagram, MapPin, Phone } from 'lucide-react'
import Link from 'next/link'
import { staggerContainer, fadeUp } from '@/lib/animations'

const navLinks = [
  { href: '#inicio', label: 'Início' },
  { href: '#servicos', label: 'Serviços' },
  { href: '#sobre', label: 'Sobre' },
  { href: '#depoimentos', label: 'Depoimentos' },
  { href: '#contato', label: 'Contato' },
]

export function Footer() {
  const currentYear = new Date().getFullYear()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })

  return (
    <footer className="bg-foreground text-background py-16 overflow-hidden">
      <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">

        <motion.div
          ref={ref}
          variants={staggerContainer}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12"
        >
          {/* Brand */}
          <motion.div variants={fadeUp} className="lg:col-span-2">
            <Link href="#inicio" className="inline-flex items-center gap-2 mb-4 group">
              <motion.div whileHover={{ rotate: 20 }} transition={{ type: 'spring', stiffness: 400 }}>
                <Sparkles className="h-6 w-6 text-accent" />
              </motion.div>
              <span className="text-xl font-semibold text-background">SC Studio & Esmalteria</span>
            </Link>
            <p className="text-background/70 leading-relaxed max-w-md">
              Especialistas em Unhas & Alongamento. Beleza que valoriza você.
              Muito mais do que uma esmalteria, nasceu um sonho e um propósito.
            </p>
          </motion.div>

          {/* Quick Links */}
          <motion.div variants={fadeUp}>
            <h4 className="font-semibold text-background mb-4">Links Rápidos</h4>
            <nav className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <motion.div key={link.href} whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 400 }}>
                  <Link href={link.href} className="text-background/70 hover:text-accent transition-colors">
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
          </motion.div>

          {/* Contact Info */}
          <motion.div variants={fadeUp}>
            <h4 className="font-semibold text-background mb-4">Contato</h4>
            <div className="space-y-3">
              <motion.a
                href="https://wa.me/5531990725053"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ x: 4 }}
                className="flex items-center gap-2 text-background/70 hover:text-accent transition-colors"
              >
                <Phone className="h-4 w-4" />
                <span>(31) 99072-5053</span>
              </motion.a>
              <motion.a
                href="https://instagram.com/scstudioeesmalteria"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ x: 4 }}
                className="flex items-center gap-2 text-background/70 hover:text-accent transition-colors"
              >
                <Instagram className="h-4 w-4" />
                <span>@scstudioeesmalteria</span>
              </motion.a>
              <div className="flex items-start gap-2 text-background/70">
                <MapPin className="h-4 w-4 mt-1 flex-shrink-0" />
                <span>Rua Padre Correia de Almeida, 38<br />Santa Efigênia, BH - MG</span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6 }}
          className="border-t border-background/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <p className="text-background/50 text-sm">
            © {currentYear} SC Studio & Esmalteria. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            {[
              { href: 'https://instagram.com/scstudioeesmalteria', icon: Instagram, label: 'Instagram' },
              { href: 'https://wa.me/5531990725053', icon: Phone, label: 'WhatsApp' },
            ].map(({ href, icon: Icon, label }) => (
              <motion.a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                whileHover={{ scale: 1.15, backgroundColor: 'oklch(0.75 0.08 80)' }}
                whileTap={{ scale: 0.9 }}
                className="w-10 h-10 rounded-full bg-background/10 flex items-center justify-center transition-colors"
              >
                <Icon className="h-5 w-5" />
              </motion.a>
            ))}
          </div>
        </motion.div>

      </div>
    </footer>
  )
}
