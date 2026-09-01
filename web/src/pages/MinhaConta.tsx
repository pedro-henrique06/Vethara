import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type MinhaConta as Conta } from '../api'
import { sessao } from '../sessao'
import { Brasao, Seta } from '../componentes/Icones'
import { baseDaVocacao, nomeDaVocacao } from '../vocacoes'
import { Carregando, Erro } from '../componentes/Estados'

export default function MinhaConta() {
  const [conta, setConta] = useState<Conta | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const ir = useNavigate()

  // formulário de personagem
  const [nome, setNome] = useState('')
  const [sexo, setSexo] = useState(1)
  const [erroPersonagem, setErroPersonagem] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)

  // formulário de senha
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [avisoSenha, setAvisoSenha] = useState<string | null>(null)
  const [erroSenha, setErroSenha] = useState<string | null>(null)

  async function carregar() {
    try {
      setConta(await api.minhaConta())
    } catch (e) {
      // Token expirado ou inválido: melhor mandar para o login do que mostrar erro.
      sessao.sair()
      ir('/entrar')
      setErro(e instanceof Error ? e.message : null)
    }
  }

  useEffect(() => {
    if (!sessao.ativa()) { ir('/entrar'); return }
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function criarPersonagem(e: React.FormEvent) {
    e.preventDefault()
    setErroPersonagem(null)
    setCriando(true)
    try {
      await api.criarPersonagem(nome, sexo)
      setNome('')
      await carregar()
    } catch (e) {
      setErroPersonagem(e instanceof Error ? e.message : 'Não foi possível criar.')
    } finally {
      setCriando(false)
    }
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault()
    setErroSenha(null)
    setAvisoSenha(null)
    try {
      const r = await api.trocarSenha(atual, nova)
      setAtual(''); setNova('')
      setAvisoSenha(r.mensagem)
    } catch (e) {
      setErroSenha(e instanceof Error ? e.message : 'Não foi possível trocar.')
    }
  }

  function sair() {
    sessao.sair()
    ir('/')
  }

  if (!conta) {
    return erro ? <Erro>{erro}</Erro> : <Carregando linhas={4} altura="4rem" />
  }

  const maiorLevel = conta.personagens.reduce((m, p) => Math.max(m, p.level), 0)

  return (
    <>
      <section className="ficha-topo">
        <div>
          <h1>Minha conta</h1>
          <p className="guia" style={{ margin: 0 }}>{conta.email}</p>
        </div>
        <button className="botao vazado p" style={{ marginLeft: 'auto' }} onClick={sair}>
          Sair
        </button>
      </section>

      <dl className="numeros" style={{ marginBottom: '2.5rem' }}>
        <div className="numero">
          <dt>Personagens</dt>
          <dd>{conta.personagens.length}</dd>
        </div>
        <div className="numero">
          <dt>Maior level</dt>
          <dd>{maiorLevel || '—'}</dd>
        </div>
        <div className="numero">
          <dt>Mundo</dt>
          <dd style={{ fontSize: '1.2rem' }}>Vethara</dd>
        </div>
      </dl>

      <section className="secao">
        <div className="secao-topo">
          <h2>Personagens</h2>
          {conta.personagens.length > 0 && <Link to="/download">Baixar o client →</Link>}
        </div>

        {conta.personagens.length === 0 ? (
          <div className="vazio">
            <strong>Nenhum personagem ainda</strong>
            Crie o primeiro abaixo — ele nasce em Rookgaard e entra no mundo na hora.
          </div>
        ) : (
          <div className="grade g2">
            {conta.personagens.map(p => (
              <Link
                className="personagem"
                key={p.nome}
                to={`/personagem/${encodeURIComponent(p.nome)}`}
              >
                <span className={`brasao voc-${baseDaVocacao(p.vocacao)}`}>
                  <Brasao vocacao={p.vocacao} tamanho={22} />
                </span>
                <span className="dados">
                  <strong>{p.nome}</strong>
                  <small>
                    {nomeDaVocacao(p.vocacao)}
                    {' · '}
                    {p.ultimoLogin
                      ? `entrou em ${new Date(p.ultimoLogin).toLocaleDateString('pt-BR')}`
                      : 'nunca entrou'}
                  </small>
                </span>
                <span className="nivel">
                  <b>{p.level}</b>
                  <small>level</small>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="colunas">
        <section className="secao">
          <div className="secao-topo"><h2>Criar personagem</h2></div>
          <div className="painel">
            <form className="formulario" onSubmit={criarPersonagem}>
              <label>
                <span>Nome</span>
                <input
                  type="text" value={nome} required minLength={3} maxLength={20}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex.: Arwen Solaris"
                />
                <small>Apenas letras e espaços. Não pode ser mudado depois.</small>
              </label>
              <fieldset>
                <legend>Sexo</legend>
                <div className="opcoes">
                  <label className="opcao">
                    <input type="radio" name="sexoNovo" checked={sexo === 1} onChange={() => setSexo(1)} />
                    <span>Masculino</span>
                  </label>
                  <label className="opcao">
                    <input type="radio" name="sexoNovo" checked={sexo === 0} onChange={() => setSexo(0)} />
                    <span>Feminino</span>
                  </label>
                </div>
              </fieldset>
              {erroPersonagem && <Erro>{erroPersonagem}</Erro>}
              <button className="botao" type="submit" disabled={criando}>
                {criando ? 'Criando…' : 'Criar personagem'} <Seta />
              </button>
            </form>
          </div>
        </section>

        <aside className="secao">
          <div className="secao-topo"><h2>Trocar senha</h2></div>
          <div className="painel">
            <form className="formulario" onSubmit={trocarSenha}>
              <label>
                <span>Senha atual</span>
                <input
                  type="password" value={atual} required autoComplete="current-password"
                  onChange={e => setAtual(e.target.value)}
                />
              </label>
              <label>
                <span>Nova senha</span>
                <input
                  type="password" value={nova} required minLength={8} autoComplete="new-password"
                  onChange={e => setNova(e.target.value)}
                />
                <small>Ao menos 8 caracteres. Vale também para entrar no jogo.</small>
              </label>
              {erroSenha && <Erro>{erroSenha}</Erro>}
              {avisoSenha && <div className="aviso">{avisoSenha}</div>}
              <button className="botao discreto" type="submit">Trocar senha</button>
            </form>
          </div>
        </aside>
      </div>
    </>
  )
}
