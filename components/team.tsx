'use client'

import { useRef, useState, useCallback } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { fadeUp, staggerContainer } from '@/lib/animations'
import type { PublicTeamMember } from '@/lib/public-data'

function Initials({ name }: { name: string }) {
  return (
    <span className="text-7xl font-bold text-primary/30">
      {name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
    </span>
  )
}

export function Team({ members }: { members?: PublicTeamMember[] | null }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const hasMembers = Boolean(members && members.length > 0)
  const count = members?.length ?? 0
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState(1)

  const go = useCallback((next: number) => {
    setDirection(next > current ? 1 : -1)
    setCurrent(next)
  }, [current])

  const prev = useCallback(() => go((current - 1 + count) % count), [current, count, go])
  const next = useCallback(() => go((current + 1) % count), [current, count, go])

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? '60%' : '-60%', opacity: 0, scale: 0.92 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-60%' : '60%', opacity: 0, scale: 0.92 }),
  }

  return (
    <section id="time" className="py-20 md:py-28 bg-background overflow-hidden">
      <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <motion.div
          ref={ref}
          variants={staggerContainer}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          {/* heading */}
          <motion.div variants={fadeUp} className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium tracking-wide">Nossa Equipe</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground">
              Nosso <span className="text-primary italic">Time</span>
            </h2>
            <p className="text-muted-foreground mt-3 text-lg max-w-xl mx-auto">
              Conheça as profissionais que fazem a experiência acontecer.
            </p>
          </motion.div>

          {hasMembers ? (
            <motion.div variants={fadeUp} className="flex flex-col items-center gap-10">
              {/* slide */}
              <div className="relative w-full flex items-center justify-center gap-4 md:gap-8">
                {/* prev arrow */}
                {count > 1 && (
                  <button
                    onClick={prev}
                    aria-label="Anterior"
                    className="shrink-0 w-12 h-12 rounded-full border border-primary/20 bg-background hover:bg-primary/8 hover:border-primary/40 flex items-center justify-center transition-colors shadow-sm z-10"
                  >
                    <ChevronLeft className="h-6 w-6 text-primary/70" />
                  </button>
                )}

                {/* card viewport */}
                <div className="relative overflow-hidden" style={{ width: 'min(360px, 78vw)', height: 'min(480px, 104vw)' }}>
                  <AnimatePresence initial={false} custom={direction} mode="popLayout">
                    <motion.div
                      key={current}
                      custom={direction}
                      variants={variants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                      className="absolute inset-0 flex flex-col items-center"
                    >
                      <div className="w-full h-full rounded-3xl overflow-hidden border border-primary/15 shadow-[0_32px_80px_rgba(0,0,0,0.13)] ring-1 ring-primary/5 bg-muted">
                        {members![current].photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={members![current].photoUrl}
                            alt={members![current].name}
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                            <Initials name={members![current].name} />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* next arrow */}
                {count > 1 && (
                  <button
                    onClick={next}
                    aria-label="Próximo"
                    className="shrink-0 w-12 h-12 rounded-full border border-primary/20 bg-background hover:bg-primary/8 hover:border-primary/40 flex items-center justify-center transition-colors shadow-sm z-10"
                  >
                    <ChevronRight className="h-6 w-6 text-primary/70" />
                  </button>
                )}
              </div>

              {/* name + role */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={current}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="text-center"
                >
                  <p className="font-semibold text-foreground text-xl">{members![current].name}</p>
                  {members![current].role && (
                    <span className="mt-3 inline-flex items-center rounded-full border border-primary/15 bg-primary/8 px-5 py-1.5 text-sm font-medium tracking-wide text-primary/80">
                      {members![current].role}
                    </span>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* dots */}
              {count > 1 && (
                <div className="flex gap-2">
                  {members!.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => go(i)}
                      aria-label={`Ir para membro ${i + 1}`}
                      className={`rounded-full transition-all duration-300 ${
                        i === current
                          ? 'w-7 h-2.5 bg-primary'
                          : 'w-2.5 h-2.5 bg-primary/25 hover:bg-primary/50'
                      }`}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              variants={fadeUp}
              className="max-w-3xl mx-auto rounded-[2rem] border border-primary/10 bg-primary/5 px-8 py-10 text-center"
            >
              <p className="text-foreground text-lg font-medium">Seu time vai aparecer aqui.</p>
              <p className="text-muted-foreground mt-3 text-sm md:text-base">
                Cadastre nome, categoria e foto de cada profissional no painel de gestão para preencher esta seção.
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  )
}
