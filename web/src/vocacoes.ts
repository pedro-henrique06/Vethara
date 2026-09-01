// Vocacao aparece de duas formas na API: numero em /api/minha-conta (o valor cru
// da coluna) e texto ja traduzido em /api/online, /api/highscores e na ficha do
// personagem. Em vez de acertar isso em cada tela, tudo passa por aqui.

export const VOCACOES = [
  'Sem vocação', 'Sorcerer', 'Druid', 'Paladin', 'Knight',
  'Master Sorcerer', 'Elder Druid', 'Royal Paladin', 'Elite Knight',
] as const

export type Base = 'nenhuma' | 'sorcerer' | 'druid' | 'paladin' | 'knight'

// As promovidas (5 a 8) usam o brasao e a cor da vocacao de origem: sao a mesma
// classe, e dar cor propria a cada uma faria oito cores para quatro papeis.
const POR_ID: Base[] = [
  'nenhuma', 'sorcerer', 'druid', 'paladin', 'knight',
  'sorcerer', 'druid', 'paladin', 'knight',
]

export function nomeDaVocacao(valor: number | string): string {
  if (typeof valor === 'number') return VOCACOES[valor] ?? `Vocação ${valor}`
  return valor
}

export function baseDaVocacao(valor: number | string): Base {
  if (typeof valor === 'number') return POR_ID[valor] ?? 'nenhuma'
  const t = valor.toLowerCase()
  if (t.includes('sorcerer')) return 'sorcerer'
  if (t.includes('druid')) return 'druid'
  if (t.includes('paladin')) return 'paladin'
  if (t.includes('knight')) return 'knight'
  return 'nenhuma'
}
