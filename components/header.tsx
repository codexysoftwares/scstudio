'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

import { cn } from '@/lib/utils'

const navLinks = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#servicos', label: 'Servicos' },
  { href: '#sobre', label: 'Sobre' },
  { href: '#depoimentos', label: 'Depoimentos' },
  { href: '#contato', label: 'Contato' },
]

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled ? 'bg-background/95 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'
      )}
    >
      <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 flex items-center justify-between">
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors tracking-wide uppercase"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="#agendar"
            className="text-sm font-semibold px-5 py-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity tracking-wide uppercase"
          >
            Agendar
          </Link>
        </div>

        <button
          className="md:hidden p-2 text-foreground"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <div
        className={cn(
          'md:hidden absolute top-full left-0 right-0 bg-background/98 backdrop-blur-md shadow-lg transition-all duration-300 overflow-hidden',
          isMobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <nav className="flex flex-col items-center gap-4 py-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors tracking-wide uppercase"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="#agendar"
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-sm font-semibold px-6 py-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity tracking-wide uppercase"
          >
            Agendar
          </Link>
        </nav>
      </div>
    </header>
  )
}
