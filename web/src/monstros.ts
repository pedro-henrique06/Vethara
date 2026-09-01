// Acesso aos dois arquivos gerados por dev/gerar-monstros.mjs.
//
// Sao arquivos estaticos servidos pelo nginx, nao API: os dados vem do datapack
// do Canary e nao do banco, entao nao ha o que consultar em tempo real.
//
// A lista custa 24 kB comprimidos e o detalhe 157 kB. Por isso sao separados —
// quem so folheia a lista nunca baixa o loot de 1363 criaturas.

export type Monstro = {
  nome: string
  vida: number
  experiencia: number
  velocidade?: number
  armadura?: number
  classe?: string
  estrelas?: number
  chefe?: boolean
}

export type ItemLoot = { item: string; chance: number; maximo?: number }

export type Detalhe = {
  cargas?: number
  matarPara?: number
  locais?: string
  elementos?: Record<string, number>
  imunidades?: string[]
  loot?: ItemLoot[]
}

type Indice = { commit: string; gerado: string; monstros: Monstro[] }
type Detalhes = { detalhes: Record<string, Detalhe> }

// Uma promessa guardada, e nao os dados: se duas telas pedirem ao mesmo tempo,
// as duas esperam a mesma requisicao em vez de disparar duas.
let indice: Promise<Indice> | null = null
let detalhes: Promise<Detalhes> | null = null

async function baixar<T>(caminho: string): Promise<T> {
  const r = await fetch(caminho)
  if (!r.ok) throw new Error('Não consegui carregar os dados das criaturas.')
  return r.json() as Promise<T>
}

export function carregarIndice() {
  indice ??= baixar<Indice>('/monstros.json').catch((e) => { indice = null; throw e })
  return indice
}

export function carregarDetalhes() {
  detalhes ??= baixar<Detalhes>('/monstros-detalhes.json').catch((e) => { detalhes = null; throw e })
  return detalhes
}

/** A chance vem em partes por 100.000, como no datapack. */
export function chanceEmPorcento(chance: number): string {
  const pct = (chance / 1000)
  if (pct >= 10) return `${Math.round(pct)}%`
  if (pct >= 1) return `${pct.toFixed(1)}%`
  return `${pct.toFixed(2)}%`
}

export function raridade(chance: number): 'comum' | 'normal' | 'raro' {
  if (chance >= 10000) return 'comum'   // 10% ou mais
  if (chance < 1000) return 'raro'      // menos de 1%
  return 'normal'
}
