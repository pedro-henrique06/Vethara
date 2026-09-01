import { sessao } from './sessao'

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

export type Morte = {
  data: string
  level: number
  por: string
  porJogador: boolean
  maiorDano: string | null
}

export type Ficha = {
  nome: string
  level: number
  vocacao: string
  sexo: string
  experiencia: number
  online: boolean
  ultimoLogin: string | null
  horasJogadas: number
  guilda: string | null
  cargo: string | null
  habilidades: {
    magia: number
    punho: number
    clava: number
    espada: number
    machado: number
    distancia: number
    escudo: number
    pesca: number
  }
  mortes: Morte[]
}

export type Personagem = {
  nome: string
  level: number
  vocacao: number
  ultimoLogin: string | null
}

export type MinhaConta = {
  email: string
  personagens: Personagem[]
}

// O token vai no cabeçalho Authorization. Se a API recusar, a sessão morreu:
// quem chamou decide se manda para o login.
async function autenticado<T>(caminho: string, metodo = 'GET', corpo?: unknown): Promise<T> {
  const token = sessao.token()
  const r = await fetch(`/api${caminho}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: corpo ? JSON.stringify(corpo) : undefined
  })
  const dados = await r.json().catch(() => null)
  if (!r.ok) throw new Error(dados?.erro ?? 'Sua sessão expirou. Entre novamente.')
  return dados as T
}

export const api = {
  entrar: (email: string, senha: string) =>
    enviar<{ token: string; email: string }>('/sessao', { email, senha }),
  minhaConta: () => autenticado<MinhaConta>('/minha-conta'),
  criarPersonagem: (nome: string, sexo: number) =>
    autenticado<{ nome: string }>('/minha-conta/personagens', 'POST', { nome, sexo }),
  trocarSenha: (senhaAtual: string, senhaNova: string) =>
    autenticado<{ mensagem: string }>('/minha-conta/senha', 'POST', { senhaAtual, senhaNova }),
  criarConta: (c: NovaConta) => enviar<{ mensagem: string }>('/contas', c),
  status: () => buscar<Status>('/status'),
  // encodeURIComponent porque nome de personagem tem espaco, e sem isso a barra
  // de um nome mal formado viraria outro segmento de rota.
  personagem: (nome: string) => buscar<Ficha>(`/personagens/${encodeURIComponent(nome)}`),
  online: () => buscar<Jogador[]>('/online'),
  // vocacao null e "todas": a API trata o parametro ausente assim, entao ele so
  // entra na URL quando ha filtro.
  highscores: (pagina = 1, vocacao: number | null = null) =>
    buscar<Posicao[]>(`/highscores?pagina=${pagina}${vocacao ? `&vocacao=${vocacao}` : ''}`),
  noticias: (limite = 5) => buscar<Noticia[]>(`/noticias?limite=${limite}`)
}
