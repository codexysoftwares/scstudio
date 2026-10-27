import type { CSSProperties } from 'react'

export type LandingThemeVariant = 'sofisticado' | 'moderno' | 'minimalista' | 'bold' | 'personalizado'

export type LandingThemePreset = {
  id: LandingThemeVariant
  label: string
  description: string
  preview: {
    background: string
    primary: string
    accent: string
  }
  styles: Record<string, string>
}

// ─── Hex color utilities ───────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').slice(0, 6).padEnd(6, '0')
  return [
    parseInt(clean.slice(0, 2), 16) || 0,
    parseInt(clean.slice(2, 4), 16) || 0,
    parseInt(clean.slice(4, 6), 16) || 0,
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function blendWithWhite(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount),
  )
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(
    Math.max(0, Math.round(r * (1 - amount))),
    Math.max(0, Math.round(g * (1 - amount))),
    Math.max(0, Math.round(b * (1 - amount))),
  )
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

function isLight(hex: string): boolean {
  return relativeLuminance(hex) > 0.22
}

// ─── Custom theme builder ──────────────────────────────────────────────────────

export function buildCustomThemeStyles(primary: string, accent: string): Record<string, string> {
  const safeAccent = accent && accent.startsWith('#') ? accent : primary

  const background  = blendWithWhite(primary, 0.93)
  const card        = blendWithWhite(primary, 0.97)
  const foreground  = darken(primary, 0.72)
  const secondary   = blendWithWhite(primary, 0.86)
  const muted       = blendWithWhite(primary, 0.90)
  const mutedFg     = darken(primary, 0.38)
  const border      = blendWithWhite(primary, 0.78)
  const input       = blendWithWhite(primary, 0.72)
  const primaryFg   = isLight(primary) ? darken(primary, 0.80) : '#ffffff'
  const accentFg    = isLight(safeAccent) ? darken(safeAccent, 0.80) : foreground
  const secondaryFg = darken(primary, 0.48)

  return {
    '--background': background,
    '--foreground': foreground,
    '--card': card,
    '--card-foreground': foreground,
    '--popover': card,
    '--popover-foreground': foreground,
    '--primary': primary,
    '--primary-foreground': primaryFg,
    '--secondary': secondary,
    '--secondary-foreground': secondaryFg,
    '--muted': muted,
    '--muted-foreground': mutedFg,
    '--accent': safeAccent,
    '--accent-foreground': accentFg,
    '--border': border,
    '--input': input,
    '--ring': primary,
    '--chart-1': primary,
    '--chart-2': safeAccent,
    '--chart-3': darken(primary, 0.15),
    '--chart-4': blendWithWhite(safeAccent, 0.40),
    '--chart-5': darken(primary, 0.30),
    '--scrollbar-thumb': primary,
  }
}

export function buildCustomThemePreview(primary: string, accent: string) {
  return {
    background: blendWithWhite(primary || '#b15d64', 0.93),
    primary: primary || '#b15d64',
    accent: accent || primary || '#b15d64',
  }
}

// ─── Presets ───────────────────────────────────────────────────────────────────

const PRESETS: Record<LandingThemeVariant, LandingThemePreset> = {
  sofisticado: {
    id: 'sofisticado',
    label: 'Sofisticado',
    description: 'Rose + dourado, elegante e quente.',
    preview: { background: '#fcf8f1', primary: '#b15d64', accent: '#c9a87c' },
    styles: {
      '--background': '#fcf8f1',
      '--foreground': '#342623',
      '--card': '#fffaf4',
      '--card-foreground': '#342623',
      '--popover': '#fffaf4',
      '--popover-foreground': '#342623',
      '--primary': '#b15d64',
      '--primary-foreground': '#fffaf5',
      '--secondary': '#f1e8dc',
      '--secondary-foreground': '#473733',
      '--muted': '#f4eee6',
      '--muted-foreground': '#6a5a54',
      '--accent': '#c9a87c',
      '--accent-foreground': '#342623',
      '--border': '#eadfce',
      '--input': '#e6d9c6',
      '--ring': '#b15d64',
      '--chart-1': '#b15d64',
      '--chart-2': '#c9a87c',
      '--chart-3': '#9f6b57',
      '--chart-4': '#d5b58a',
      '--chart-5': '#7e6558',
      '--scrollbar-thumb': '#b15d64',
    },
  },
  moderno: {
    id: 'moderno',
    label: 'Moderno',
    description: 'Azul e ciano, limpo e atual.',
    preview: { background: '#f3f7fb', primary: '#2563eb', accent: '#14b8a6' },
    styles: {
      '--background': '#f3f7fb',
      '--foreground': '#182235',
      '--card': '#ffffff',
      '--card-foreground': '#182235',
      '--popover': '#ffffff',
      '--popover-foreground': '#182235',
      '--primary': '#2563eb',
      '--primary-foreground': '#f8fbff',
      '--secondary': '#e7eefc',
      '--secondary-foreground': '#20314f',
      '--muted': '#edf3fb',
      '--muted-foreground': '#58708e',
      '--accent': '#14b8a6',
      '--accent-foreground': '#082f2a',
      '--border': '#d7e2f2',
      '--input': '#cfdaf0',
      '--ring': '#2563eb',
      '--chart-1': '#2563eb',
      '--chart-2': '#14b8a6',
      '--chart-3': '#5b7cfa',
      '--chart-4': '#78d1d0',
      '--chart-5': '#1d4ed8',
      '--scrollbar-thumb': '#2563eb',
    },
  },
  minimalista: {
    id: 'minimalista',
    label: 'Minimalista',
    description: 'Neutro, leve e discreto.',
    preview: { background: '#faf7f4', primary: '#6b5b52', accent: '#a7a29c' },
    styles: {
      '--background': '#faf7f4',
      '--foreground': '#2b2622',
      '--card': '#fffdfb',
      '--card-foreground': '#2b2622',
      '--popover': '#fffdfb',
      '--popover-foreground': '#2b2622',
      '--primary': '#6b5b52',
      '--primary-foreground': '#fffdfb',
      '--secondary': '#f1ece8',
      '--secondary-foreground': '#3d352f',
      '--muted': '#f5f1ed',
      '--muted-foreground': '#6b615a',
      '--accent': '#a7a29c',
      '--accent-foreground': '#2b2622',
      '--border': '#e5ddd7',
      '--input': '#ddd4cd',
      '--ring': '#6b5b52',
      '--chart-1': '#6b5b52',
      '--chart-2': '#a7a29c',
      '--chart-3': '#8d7d72',
      '--chart-4': '#c4beb9',
      '--chart-5': '#534842',
      '--scrollbar-thumb': '#6b5b52',
    },
  },
  bold: {
    id: 'bold',
    label: 'Bold',
    description: 'Vinho + ouro, mais marcante.',
    preview: { background: '#fff6f1', primary: '#8b1e3f', accent: '#d4a373' },
    styles: {
      '--background': '#fff6f1',
      '--foreground': '#311b20',
      '--card': '#fffaf6',
      '--card-foreground': '#311b20',
      '--popover': '#fffaf6',
      '--popover-foreground': '#311b20',
      '--primary': '#8b1e3f',
      '--primary-foreground': '#fff9f6',
      '--secondary': '#f7e6df',
      '--secondary-foreground': '#4b2d34',
      '--muted': '#f6ede8',
      '--muted-foreground': '#7a5d64',
      '--accent': '#d4a373',
      '--accent-foreground': '#311b20',
      '--border': '#e9d4cd',
      '--input': '#e2c8c2',
      '--ring': '#8b1e3f',
      '--chart-1': '#8b1e3f',
      '--chart-2': '#d4a373',
      '--chart-3': '#b76a7f',
      '--chart-4': '#e8bfa1',
      '--chart-5': '#5c2b37',
      '--scrollbar-thumb': '#8b1e3f',
    },
  },
  personalizado: {
    id: 'personalizado',
    label: 'Personalizado',
    description: 'Cores escolhidas por você.',
    preview: { background: '#f5f0ff', primary: '#7c3aed', accent: '#a78bfa' },
    styles: buildCustomThemeStyles('#7c3aed', '#a78bfa'),
  },
}

export function getLandingThemePreset(variant?: string | null): LandingThemePreset {
  return PRESETS[(variant as LandingThemeVariant) || 'sofisticado'] ?? PRESETS.sofisticado
}

export function getLandingThemeStyles(
  variant?: string | null,
  customPrimary?: string | null,
  customAccent?: string | null,
): CSSProperties {
  if (variant === 'personalizado' && customPrimary && customPrimary.startsWith('#')) {
    return buildCustomThemeStyles(customPrimary, customAccent ?? customPrimary) as CSSProperties
  }
  return getLandingThemePreset(variant).styles as CSSProperties
}

export const LANDING_THEME_PRESETS = Object.values(PRESETS)
