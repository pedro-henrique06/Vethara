import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type MinhaConta as Conta } from '../api'
import { sessao } from '../sessao'

const VOCACOES = [
  'Sem vocação', 'Sorcerer', 'Druid', 'Paladin', 'Knight',
  'Master Sorcerer', 'Elder Druid', 'Royal Paladin', 'Elite Knight'
]

export default function MinhaConta() {
  const [conta, setConta] = useState<Conta | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const ir = useNavigate()

  // formulário de personagem
  const [nome, setNome] = useState('')
  const [sexo, setSexo] = useState(1)
  const [erroPersonagem, setErroPersonagem] = useState<string | null>(null)

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
    try {
      await api.criarPersonagem(nome, sexo)
      setNome('')
      await carregar()
    } catch (e) {
      setErroPersonagem(e instanceof Error ? e.message : 'Não foi possível criar.')
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
    return <div className="aviso">{erro ?? 'Carregando…'}</div>
  }

  return (
    <>
      <section className="secao">
        <div className="cabecalho-conta">
          <div>
            <h1>Minha conta</h1>
            <p style={{ color: 'var(--ink-2)' }}>{conta.email}</p>
          </div>
          <button className="botao vazado" onClick={sair}>Sair</button>
        </div>
      </section>

      <section className="secao">
        <h2>Personagens</h2>
        {conta.personagens.length === 0 ? (
          <div className="aviso">Você ainda não tem personagens.</div>
        ) : (
          <div className="rolagem">
            <table>
              <thead>
                <tr>
                  <th>Nome</th><th>Vocação</th>
                  <th className="num">Level</th><th>Último login</th>
                </tr>
              </thead>
              <tbody>
                {conta.personagens.map(p => (
                  <tr key={p.nome}>
                    <td>{p.nome}</td>
                    <td>{VOCACOES[p.vocacao] ?? `Vocação ${p.vocacao}`}</td>
                    <td className="num">{p.level}</td>
                    <td>
                      {p.ultimoLogin
                        ? new Date(p.ultimoLogin).toLocaleDateString('pt-BR')
                        : 'nunca entrou'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="secao">
        <h2>Criar personagem</h2>
        <form className="formulario" onSubmit={criarPersonagem}>
          <label>
            <span>Nome</span>
            <input type="text" value={nome} required minLength={3} maxLength={20}
                   onChange={e => setNome(e.target.value)} />
            <small>Apenas letras e espaços. Não pode ser mudado depois.</small>
          </label>
          <fieldset>
            <legend>Sexo</legend>
            <div className="opcoes">
              <label className="radio">
                <input type="radio" name="sexoNovo" checked={sexo === 1}
                       onChange={() => setSexo(1)} />
                <span>Masculino</span>
              </label>
              <label className="radio">
                <input type="radio" name="sexoNovo" checked={sexo === 0}
                       onChange={() => setSexo(0)} />
                <span>Feminino</span>
              </label>
            </div>
          </fieldset>
          {erroPersonagem && <div className="aviso erro">{erroPersonagem}</div>}
          <button className="botao" type="submit">Criar personagem</button>
        </form>
      </section>

      <section className="secao">
        <h2>Trocar senha</h2>
        <form className="formulario" onSubmit={trocarSenha}>
          <label>
            <span>Senha atual</span>
            <input type="password" value={atual} required autoComplete="current-password"
                   onChange={e => setAtual(e.target.value)} />
          </label>
          <label>
            <span>Nova senha</span>
            <input type="password" value={nova} required minLength={8}
                   autoComplete="new-password"
                   onChange={e => setNova(e.target.value)} />
            <small>Ao menos 8 caracteres. Vale também para entrar no jogo.</small>
          </label>
          {erroSenha && <div className="aviso erro">{erroSenha}</div>}
          {avisoSenha && <div className="aviso">{avisoSenha}</div>}
          <button className="botao" type="submit">Trocar senha</button>
        </form>
      </section>
    </>
  )
}
