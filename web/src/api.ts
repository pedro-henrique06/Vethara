// Front e API ficam na mesma origem — o Caddy roteia /api para o container .NET.
// Por isso os caminhos são relativos: não há URL de servidor embutida no build.

export type Status = {
  servidor: string
  online: number
  personagens: number
  contas: number
}

export type Jogador = {
  nome: string
  level: number
  vocacao: string
}

export type Posicao = Jogador & {
  posicao: number
  experiencia: number
}

export type Noticia = {
  id: number
  titulo: string
  corpo: string
  data: string
}

async function buscar<T>(caminho: string): Promise<T> {
  const r = await fetch(`/api${caminho}`)
  if (!r.ok) {
    throw new Error(`A API respondeu ${r.status}. Tente novamente em instantes.`)
  }
  return r.json() as Promise<T>
}

export const api = {
  status: () => buscar<Status>('/status'),
  online: () => buscar<Jogador[]>('/online'),
  highscores: (pagina = 1) => buscar<Posicao[]>(`/highscores?pagina=${pagina}`),
  noticias: (limite = 5) => buscar<Noticia[]>(`/noticias?limite=${limite}`)
}
