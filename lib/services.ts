export type ServiceCategory = 'unhas' | 'cilios'

export interface Service {
  name: string
  duration: string
  durationMin: number
  price: string
  category: ServiceCategory
  photo: string
  description: string
}

export const SERVICES: Service[] = [
  {
    name: 'Alongamento (novo)',
    duration: '1h 15min',
    durationMin: 75,
    price: 'R$ 140,00',
    category: 'unhas',
    photo: '/a.png',
    description: 'Alongamento de unhas em gel com acabamento perfeito.',
  },
  {
    name: 'Manutenção + Mão',
    duration: '1h 15min',
    durationMin: 75,
    price: 'R$ 120,00',
    category: 'unhas',
    photo: 'gb6gtiTZKB8',
    description: 'Manutenção de alongamento com esmaltação e cutilagem.',
  },
  {
    name: 'Esmaltação em Gel',
    duration: '1h',
    durationMin: 60,
    price: 'R$ 60,00',
    category: 'unhas',
    photo: 'IYa5Dnj9qWE',
    description: 'Esmaltação em gel em unhas naturais com maior durabilidade.',
  },
  {
    name: 'Spa dos Pés',
    duration: '1h 30min',
    durationMin: 90,
    price: 'R$ 90,00',
    category: 'unhas',
    photo: '/spadospes.png',
    description: 'Relaxamento, esfoliação e hidratação com esmaltação impecável.',
  },
  {
    name: 'Pé e Mão',
    duration: '1h 10min',
    durationMin: 70,
    price: 'R$ 60,00',
    category: 'unhas',
    photo: '/peemao.png',
    description: 'Combo manicure + pedicure com cutilagem e esmaltação.',
  },
  {
    name: 'Manicure',
    duration: '50min',
    durationMin: 50,
    price: 'R$ 35,00',
    category: 'unhas',
    photo: '/mao.png',
    description: 'Remoção de cutículas, corte e esmaltação das mãos.',
  },
  {
    name: 'Pedicure',
    duration: '50min',
    durationMin: 50,
    price: 'R$ 35,00',
    category: 'unhas',
    photo: 'yiyzz1PedMs',
    description: 'Remoção de cutículas, corte e esmaltação dos pés.',
  },
  {
    name: 'Remoção de Alongamento',
    duration: '30min',
    durationMin: 30,
    price: 'R$ 40,00',
    category: 'unhas',
    photo: 'EX1uC6ZVu7w',
    description: 'Remoção segura por profissional especializado.',
  },
  {
    name: 'Decoração',
    duration: '30min',
    durationMin: 30,
    price: 'R$ 10,00',
    category: 'unhas',
    photo: '/decoracao.png',
    description: 'Decoração adicional em alongamentos de unhas.',
  },
  {
    name: 'Francesa Definitiva',
    duration: '20min',
    durationMin: 20,
    price: 'R$ 20,00',
    category: 'unhas',
    photo: '/francesa.png',
    description: 'Francesinha em alongamentos com acabamento prático.',
  },
  {
    name: 'Cílios Brasileiro',
    duration: '1h 50min',
    durationMin: 110,
    price: 'R$ 110,00',
    category: 'cilios',
    photo: 'VWvTbDUwbUM',
    description: 'Aplicação de cílios com aparência leve e natural.',
  },
  {
    name: 'Manutenção de Cílios',
    duration: '1h',
    durationMin: 60,
    price: 'R$ 90,00',
    category: 'cilios',
    photo: 'v8c7G8i1nZc',
    description: 'Manutenção de alongamentos de cílios.',
  },
  {
    name: 'Designer Comum',
    duration: '30min',
    durationMin: 30,
    price: 'R$ 40,00',
    category: 'cilios',
    photo: 'BC1Jr0tPkTw',
    description: 'Design profissional de sobrancelhas com simetria perfeita.',
  },
  {
    name: 'Designer com Henna',
    duration: '45min',
    durationMin: 45,
    price: 'R$ 50,00',
    category: 'cilios',
    photo: 'heaQs3-HTSw',
    description: 'Design de sobrancelhas com aplicação de henna.',
  },
]

export const DAY_HOURS: Record<number, { open: number; close: number } | null> = {
  0: null,
  1: null,
  2: { open: 9 * 60, close: 16 * 60 },
  3: { open: 8 * 60, close: 16 * 60 },
  4: { open: 8 * 60, close: 16 * 60 },
  5: { open: 8 * 60, close: 18 * 60 },
  6: { open: 8 * 60, close: 16 * 60 },
}

export function getTimeSlots(date: Date, durationMin: number): string[] {
  const cfg = DAY_HOURS[date.getDay()]
  if (!cfg) return []

  const slots: string[] = []
  for (let m = cfg.open; m + durationMin <= cfg.close; m += 30) {
    const h = Math.floor(m / 60)
    const min = m % 60
    slots.push(`${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`)
  }

  return slots
}

export function photoUrl(photo: string, w = 600, h = 450): string {
  if (photo.startsWith('/')) return photo
  return `https://images.unsplash.com/photo-${photo}?w=${w}&h=${h}&fit=crop&q=80&auto=format`
}
