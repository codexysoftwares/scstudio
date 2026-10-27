'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, Quote, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fadeUp, staggerContainer } from '@/lib/animations'
import type { PublicTestimonial } from '@/lib/public-data'

const STATIC_TESTIMONIALS: PublicTestimonial[] = [
  { id: '1', authorName: 'Mariana S.', body: 'Melhor estúdio de unhas de BH! Atendimento impecável e resultado sempre perfeito. Minhas unhas nunca estiveram tão lindas!', serviceName: 'Alongamento em Gel' },
  { id: '2', authorName: 'Juliana P.', body: 'Ambiente super acolhedor e profissionais maravilhosas. O alongamento dura muito e fica natural. Super recomendo!', serviceName: 'Manutenção' },
  { id: '3', authorName: 'Fernanda L.', body: 'Fiz o spa dos pés e foi uma experiência incrível! Saí de lá renovada. O cuidado com cada detalhe faz toda diferença.', serviceName: 'Spa dos Pés' },
  { id: '4', authorName: 'Carolina M.', body: 'Adoro o atendimento personalizado! A equipe sempre entende exatamente o que eu quero. Virei cliente fiel.', serviceName: 'Esmaltação em Gel' },
  { id: '5', authorName: 'Beatriz R.', body: 'Os cílios ficaram perfeitos! Muito naturais e a aplicação foi super confortável. Voltarei com certeza!', serviceName: 'Cílios Brasileiro' },
]

export function Testimonials({ testimonials }: { testimonials?: PublicTestimonial[] | null }) {
  const list = testimonials && testimonials.length > 0 ? testimonials : STATIC_TESTIMONIALS

  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  useEffect(() => {
    setCurrentIndex(0)
  }, [testimonials])

  useEffect(() => {
    if (!isAutoPlaying) return
    const interval = setInterval(() => {
      setDirection(1)
      setCurrentIndex((prev) => (prev + 1) % list.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [isAutoPlaying, list.length])

  const goToPrevious = () => {
    setIsAutoPlaying(false)
    setDirection(-1)
    setCurrentIndex((prev) => (prev - 1 + list.length) % list.length)
  }

  const goToNext = () => {
    setIsAutoPlaying(false)
    setDirection(1)
    setCurrentIndex((prev) => (prev + 1) % list.length)
  }

  const slideVariants = {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? 60 : -60 }),
    center: { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? -60 : 60, transition: { duration: 0.3 } }),
  }

  const current = list[currentIndex] ?? list[0]

  return (
    <section id="depoimentos" className="py-20 md:py-28 bg-secondary/30">
      <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">

        <motion.div
          ref={ref}
          variants={staggerContainer}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium tracking-wide">Depoimentos</span>
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4 text-balance">
            O que nossas clientes dizem
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground text-lg">
            A satisfação de nossas clientes é nossa maior recompensa
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.35, duration: 0.7 }}
          className="max-w-3xl mx-auto relative"
        >
          <Card className="bg-card border-border/50 shadow-xl overflow-hidden">
            <CardContent className="p-8 md:p-12">
              <motion.div
                animate={{ rotate: [0, 5, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Quote className="h-12 w-12 text-primary/20 mb-6" />
              </motion.div>

              <div className="min-h-[160px] relative overflow-hidden">
                <AnimatePresence custom={direction} mode="wait">
                  <motion.div
                    key={current.id}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                  >
                    <p className="text-lg md:text-xl text-foreground leading-relaxed mb-6 italic">
                      {`"${current.body}"`}
                    </p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{current.authorName}</p>
                        {current.serviceName && (
                          <p className="text-sm text-primary">{current.serviceName}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <motion.svg
                            key={i}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.08, type: 'spring', stiffness: 400 }}
                            className="w-5 h-5 text-accent fill-accent"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </motion.svg>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button variant="outline" size="icon" onClick={goToPrevious} aria-label="Depoimento anterior">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </motion.div>

            <div className="flex gap-2 items-center">
              {list.map((_, index) => (
                <motion.button
                  key={index}
                  onClick={() => { setIsAutoPlaying(false); setCurrentIndex(index) }}
                  animate={{ width: index === currentIndex ? 24 : 8 }}
                  className={cn(
                    'h-2 rounded-full transition-colors duration-300',
                    index === currentIndex ? 'bg-primary' : 'bg-primary/30 hover:bg-primary/50'
                  )}
                  aria-label={`Ir para depoimento ${index + 1}`}
                />
              ))}
            </div>

            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button variant="outline" size="icon" onClick={goToNext} aria-label="Próximo depoimento">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </motion.div>
          </div>
        </motion.div>

      </div>
    </section>
  )
}
