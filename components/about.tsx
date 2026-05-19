'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Sparkles, Heart, Award, Users } from 'lucide-react'
import { fadeUp, slideInLeft, slideInRight, staggerContainer, scaleIn } from '@/lib/animations'

const features = [
  { icon: Heart, title: 'Atendimento Acolhedor', description: 'Cada cliente é única e merece um atendimento personalizado e carinhoso.' },
  { icon: Award, title: 'Qualidade Premium', description: 'Utilizamos apenas produtos de alta qualidade para garantir durabilidade e beleza.' },
  { icon: Users, title: 'Profissionais Especializados', description: 'Nossa equipe é constantemente atualizada nas últimas técnicas e tendências.' },
]

export function About() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="sobre" className="py-20 md:py-28 bg-background overflow-hidden">
      <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <motion.div
          ref={ref}
          className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center"
        >
          {/* Content */}
          <motion.div
            className="order-2 lg:order-1"
            variants={staggerContainer}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium tracking-wide">Sobre Nós</span>
            </motion.div>

            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-6 text-balance leading-tight">
              Muito mais do que uma esmalteria,{' '}
              <span className="text-primary italic">nasceu um sonho</span>
            </motion.h2>

            <motion.p variants={fadeUp} className="text-muted-foreground text-lg leading-relaxed mb-6">
              O SC Studio & Esmalteria nasceu do propósito de valorizar cada mulher que
              passa por aqui. Acreditamos que unhas bem cuidadas são uma extensão da
              personalidade e autoestima de cada cliente.
            </motion.p>

            <motion.p variants={fadeUp} className="text-muted-foreground text-lg leading-relaxed mb-8">
              Localizado no coração de Santa Efigênia, em Belo Horizonte, nosso espaço foi
              pensado para proporcionar conforto, relaxamento e uma experiência única de
              beleza. Cada detalhe é cuidadosamente planejado para que você se sinta especial.
            </motion.p>

            <motion.div variants={staggerContainer} className="space-y-6">
              {features.map((feature) => (
                <motion.div
                  key={feature.title}
                  variants={slideInLeft}
                  className="flex gap-4 group"
                >
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                    className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"
                  >
                    <feature.icon className="h-5 w-5 text-primary" />
                  </motion.div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Image Grid */}
          <motion.div
            className="order-1 lg:order-2 grid grid-cols-2 gap-4"
            variants={staggerContainer}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
          >
            <div className="space-y-4">
              <motion.div
                variants={scaleIn}
                whileHover={{ scale: 1.03, rotateZ: -1 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="aspect-[3/4] rounded-2xl bg-secondary flex items-center justify-center overflow-hidden cursor-default"
              >
                <div className="text-center p-6">
                  <Sparkles className="h-12 w-12 text-primary/40 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground italic">Ambiente acolhedor</p>
                </div>
              </motion.div>
              <motion.div
                variants={scaleIn}
                whileHover={{ scale: 1.03, rotateZ: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="aspect-square rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden cursor-default"
              >
                <div className="text-center p-6">
                  <Award className="h-10 w-10 text-primary/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground italic">Qualidade garantida</p>
                </div>
              </motion.div>
            </div>
            <div className="space-y-4 pt-8">
              <motion.div
                variants={scaleIn}
                whileHover={{ scale: 1.03, rotateZ: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="aspect-square rounded-2xl bg-accent/30 flex items-center justify-center overflow-hidden cursor-default"
              >
                <div className="text-center p-6">
                  <Heart className="h-10 w-10 text-primary/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground italic">Feito com amor</p>
                </div>
              </motion.div>
              <motion.div
                variants={scaleIn}
                whileHover={{ scale: 1.03, rotateZ: -1 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="aspect-[3/4] rounded-2xl bg-secondary flex items-center justify-center overflow-hidden cursor-default"
              >
                <div className="text-center p-6">
                  <Users className="h-12 w-12 text-primary/40 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground italic">Equipe especializada</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
