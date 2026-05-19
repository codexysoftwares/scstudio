'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import styles from './intro-screen.module.css'

const EASE = [0.25, 0.46, 0.45, 0.94] as const
const EASE_OUT = [0.0, 0.0, 0.2, 1] as const

// Sparkles posicionados ao redor da logo (ângulo, raio, delay)
const ORBITERS = [
  { angle: -38,  radius: 1.0, delay: 2.2 },
  { angle:  52,  radius: 1.05, delay: 2.5 },
  { angle: 165,  radius: 0.98, delay: 2.8 },
  { angle: -125, radius: 1.02, delay: 3.0 },
]

interface Props {
  onDone: () => void
}

export function IntroScreen({ onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)
  const [exiting, setExiting] = useState(false)

  // Raio da logo (metade do tamanho visual) — calculado após mount
  const logoRadius = typeof window !== 'undefined'
    ? Math.max(80, Math.min(115, window.innerWidth * 0.12))
    : 100

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Partículas ────────────────────────────────────────────────────────
    const N = Math.min(36, Math.floor(window.innerWidth / 32))
    type P = { x:number; y:number; vx:number; vy:number; r:number; base:number; ph:number; spd:number }
    const pts: P[] = Array.from({ length: N }, () => ({
      x:   Math.random() * canvas.width,
      y:   Math.random() * canvas.height,
      vx:  (Math.random() - 0.5) * 0.18,
      vy:  (Math.random() - 0.5) * 0.18,
      r:   Math.random() * 1.4 + 0.3,
      base: Math.random() * 0.055 + 0.01,
      ph:  Math.random() * Math.PI * 2,
      spd: 0.003 + Math.random() * 0.007,
    }))

    // ── Sparkles canvas ───────────────────────────────────────────────────
    type S = { x:number; y:number; sz:number; base:number; ph:number; spd:number; rot:number; rs:number }
    const sparks: S[] = Array.from({ length: 18 }, () => ({
      x:   Math.random() * canvas.width,
      y:   Math.random() * canvas.height,
      sz:  Math.random() * 5 + 1.8,
      base: Math.random() * 0.18 + 0.04,
      ph:  Math.random() * Math.PI * 2,
      spd: 0.006 + Math.random() * 0.01,
      rot: Math.random() * Math.PI * 2,
      rs:  (Math.random() - 0.5) * 0.007,
    }))

    // ── Linhas finas ──────────────────────────────────────────────────────
    let lineOff = 0
    const t0 = performance.now()

    const tick = (now: number) => {
      const el = now - t0
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Partículas
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy; p.ph += p.spd
        if (p.x < 0) p.x = canvas.width;  if (p.x > canvas.width)  p.x = 0
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(185,79,95,${(p.base + Math.sin(p.ph) * 0.02).toFixed(3)})`
        ctx.fill()
      }

      // Linhas diagonais (a partir de 600ms)
      if (el > 600) {
        lineOff += 0.05
        const la = Math.min((el - 600) / 1800, 1) * 0.028
        if (la > 0.001) {
          ctx.save()
          ctx.globalAlpha = la
          ctx.strokeStyle = '#c9a0a8'
          ctx.lineWidth = 0.4
          const sp = 175, dg = 0.16
          const cnt = Math.ceil((canvas.width + canvas.height) / sp) + 2
          const off = lineOff % sp
          for (let i = -1; i <= cnt; i++) {
            const sx = i * sp + off
            ctx.beginPath()
            ctx.moveTo(sx, 0)
            ctx.lineTo(sx - canvas.height * dg, canvas.height)
            ctx.stroke()
          }
          ctx.restore()
        }
      }

      // Sparkles (a partir de 400ms)
      if (el > 400) {
        const ga = Math.min((el - 400) / 1400, 1)
        for (const s of sparks) {
          s.ph += s.spd; s.rot += s.rs
          const a = (s.base + Math.sin(s.ph) * 0.07) * ga
          if (a < 0.01) continue
          ctx.save()
          ctx.translate(s.x, s.y)
          ctx.rotate(s.rot)
          ctx.lineCap = 'round'
          // Cruz principal
          ctx.globalAlpha = a
          ctx.strokeStyle = '#e0b5bc'
          ctx.lineWidth = 0.75
          ctx.beginPath(); ctx.moveTo(0, -s.sz); ctx.lineTo(0, s.sz); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(-s.sz, 0); ctx.lineTo(s.sz, 0); ctx.stroke()
          // Cruz diagonal (mais leve)
          ctx.globalAlpha = a * 0.38
          ctx.lineWidth = 0.45
          const d = s.sz * 0.64
          ctx.beginPath(); ctx.moveTo(-d,-d); ctx.lineTo(d,d); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(d,-d); ctx.lineTo(-d,d); ctx.stroke()
          ctx.restore()
        }
      }

      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)

    const t1 = setTimeout(() => setExiting(true), 5600)
    const t2 = setTimeout(onDone, 6900)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animRef.current)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [onDone])

  return (
    <motion.div
      className={styles.screen}
      animate={exiting ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: 1.2, ease: EASE_OUT }}
    >
      {/* Fundo */}
      <div className={styles.bg} />

      {/* Blobs orgânicos */}
      <motion.div
        className={styles.blob1}
        animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className={styles.blob2}
        animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.75, 0.4] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />
      <motion.div
        className={styles.blob3}
        animate={{ scale: [1, 1.22, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />

      {/* Canvas */}
      <canvas ref={canvasRef} className={styles.canvas} />

      {/* Brilho central */}
      <motion.div
        className={styles.centerGlow}
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2.2, ease: 'easeOut' }}
      />

      {/* Vinheta */}
      <div className={styles.vignette} />

      {/* ── Conteúdo central ─────────────────────────────────────────────── */}
      <div className={styles.content}>

        {/* Logo */}
        <motion.div
          className={styles.logoWrap}
          initial={{ opacity: 0, scale: 0.72, filter: 'blur(18px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.8, delay: 1.0, ease: EASE }}
        >
          {/* Brilho difuso */}
          <motion.div
            className={styles.logoGlow}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.65] }}
            transition={{ duration: 2, delay: 1.4, ease: 'easeOut' }}
          />

          {/* Anel 3 — externo, suavíssimo */}
          <motion.div
            className={styles.ring3}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: [0, 0.5, 0.25], scale: [0.9, 1, 1] }}
            transition={{ duration: 1.8, delay: 2.4, ease: EASE }}
          />

          {/* Anel 2 — médio */}
          <motion.div
            className={styles.ring2}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: [0, 0.8, 0.45], scale: [0.88, 1.05, 1] }}
            transition={{ duration: 1.6, delay: 2.0, ease: EASE }}
          />

          {/* Anel 1 — interno, mais visível */}
          <motion.div
            className={styles.ring}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: [0, 1, 0.6], scale: [0.85, 1.08, 1] }}
            transition={{ duration: 1.4, delay: 1.6, ease: EASE }}
          />

          {/* Logo */}
          <Image
            src="/logosc.jpg"
            alt="SC Studio"
            width={230}
            height={230}
            className={styles.logo}
            priority
          />

          {/* Shimmer sweep */}
          <div className={styles.logoShimmer} />

          {/* Sparkles orbitais */}
          {ORBITERS.map((o, i) => {
            const rad = (o.angle * Math.PI) / 180
            const r = logoRadius * o.radius + logoRadius + 20
            const x = Math.cos(rad) * r
            const y = Math.sin(rad) * r
            return (
              <motion.div
                key={i}
                className={styles.orbiter}
                style={{ left: '50%', top: '50%', marginLeft: x - 6, marginTop: y - 6 }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 0.9, 0.6, 0.9, 0.6],
                  scale:   [0, 1.2, 1, 1.1, 1],
                }}
                transition={{
                  duration: 3,
                  delay: o.delay,
                  repeat: Infinity,
                  repeatDelay: 2,
                  ease: 'easeInOut',
                }}
              >
                ✦
              </motion.div>
            )
          })}
        </motion.div>

        {/* Tagline */}
        <motion.p
          className={styles.tagline}
          initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.3, delay: 2.5, ease: EASE }}
        >
          Beleza que <em>valoriza</em> você
        </motion.p>

        {/* Divisor decorativo */}
        <motion.div
          className={styles.divider}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 1, delay: 3.2, ease: EASE }}
        >
          <div className={styles.divLine} />
          <div className={styles.divDot} />
          <div className={styles.divLine} />
        </motion.div>

      </div>
    </motion.div>
  )
}
