// Desenhos em SVG, sem arquivo de imagem e sem biblioteca de icones.
//
// Todos herdam a cor do texto (currentColor) e o tamanho vem por prop, entao o
// mesmo brasao serve na linha da tabela e no topo da ficha do personagem.

import type { ReactElement } from 'react'
import { baseDaVocacao, nomeDaVocacao } from '../vocacoes'

type Props = { tamanho?: number }

const base = (t: number) => ({
  width: t, height: t, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

/** Marca do site: um V dentro de um escudo. */
export function Sigilo({ tamanho = 26 }: Props) {
  return (
    <svg {...base(tamanho)} strokeWidth={1.4}>
      <path d="M12 2.5 20 5.5v6.2c0 4.4-3.2 8.3-8 9.8-4.8-1.5-8-5.4-8-9.8V5.5z" />
      <path d="M8.6 8.4 12 15.6l3.4-7.2" strokeWidth={2} />
    </svg>
  )
}

export function Lupa({ tamanho = 16 }: Props) {
  return (
    <svg {...base(tamanho)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  )
}

export function Menu({ tamanho = 18 }: Props) {
  return (
    <svg {...base(tamanho)} strokeWidth={2}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function Seta({ tamanho = 16 }: Props) {
  return (
    <svg {...base(tamanho)}>
      <path d="M5 12h13m-5-6 6 6-6 6" />
    </svg>
  )
}

/* ------------------------------------------------------------- brasoes --- */

/* Cada vocacao tem uma silhueta que se le em 16px: chama para sorcerer, folha
   para druid, flecha para paladin, espada para knight. Sem cor propria aqui —
   a cor vem da classe voc-* aplicada pelo pai. */

const BRASOES: Record<string, (t: number) => ReactElement> = {
  sorcerer: (t) => (
    <svg {...base(t)}>
      <path d="M12 3c2.5 3.4 4.6 6 4.6 9a4.6 4.6 0 1 1-9.2 0c0-3 2.1-5.6 4.6-9z" />
      <path d="M12 12.5c1 1.4 1.6 2.3 1.6 3.3a1.6 1.6 0 1 1-3.2 0c0-1 .6-1.9 1.6-3.3z" />
    </svg>
  ),
  druid: (t) => (
    <svg {...base(t)}>
      <path d="M20 4c0 8-4.6 12.5-10 12.5A5.5 5.5 0 0 1 6 7.2C9.5 4.4 14.5 4.6 20 4z" />
      <path d="M4 20c2.2-3.6 5-6.2 9-8" />
    </svg>
  ),
  paladin: (t) => (
    <svg {...base(t)}>
      <path d="M20 4 9.5 14.5" />
      <path d="M20 4v5m0-5h-5" />
      <path d="M4 20l5.5-5.5" />
      <path d="M4.2 12.5 4 20l7.5-.2" />
    </svg>
  ),
  knight: (t) => (
    <svg {...base(t)}>
      <path d="M18.5 3.5 9 13l2 2 9.5-9.5V3.5z" />
      <path d="m8 14-3.5 3.5 2 2L10 16" />
      <path d="M4.5 19.5 3 21" />
    </svg>
  ),
  nenhuma: (t) => (
    <svg {...base(t)}>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 8.5v4.2M12 15.6h.01" />
    </svg>
  ),
}

export function Brasao({ vocacao, tamanho = 16 }: { vocacao: number | string; tamanho?: number }) {
  return BRASOES[baseDaVocacao(vocacao)](tamanho)
}

/** Brasao + nome, na cor da vocacao. O que aparece em tabela e cartao. */
export function Vocacao({ valor, tamanho = 15 }: { valor: number | string; tamanho?: number }) {
  return (
    <span className={`voc voc-${baseDaVocacao(valor)}`}>
      <Brasao vocacao={valor} tamanho={tamanho} />
      <span className="nome-voc">{nomeDaVocacao(valor)}</span>
    </span>
  )
}
