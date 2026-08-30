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

export type NovaConta = {
  email: string
  senha: string
  personagem: string
  sexo: number
}

async function enviar<T>(caminho: string, corpo: unknown): Promise<T> {
  const r = await fetch(`/api${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  })
  const dados = await r.json().catch(() => null)
  if (!r.ok) {
    // A API devolve { erro } com texto pronto para o jogador ler.
    throw new Error(dados?.erro ?? 'Não foi possível concluir. Tente novamente.')
  }
  return dados as T
}

export const api = {
  criarConta: (c: NovaConta) => enviar<{ mensagem: string }>('/contas', c),
  status: () => buscar<Status>('/status'),
  online: () => buscar<Jogador[]>('/online'),
  highscores: (pagina = 1) => buscar<Posicao[]>(`/highscores?pagina=${pagina}`),
  noticias: (limite = 5) => buscar<Noticia[]>(`/noticias?limite=${limite}`)
}
