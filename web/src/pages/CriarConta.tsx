import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Sigilo } from '../componentes/Icones'
import { Erro } from '../componentes/Estados'

export default function CriarConta() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [personagem, setPersonagem] = useState('')
  const [sexo, setSexo] = useState(1)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await api.criarConta({ email, senha, personagem, sexo })
      setPronto(true)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar a conta.')
    } finally {
      setEnviando(false)
    }
  }

  if (pronto) {
    return (
      <div style={{ maxWidth: '30rem', margin: '2rem auto', textAlign: 'center' }}>
        <div style={{ color: 'var(--ouro)', marginBottom: '1.5rem' }}>
          <Sigilo tamanho={48} />
        </div>
        <h1>Conta criada</h1>
        <p className="guia" style={{ margin: '0 auto 1.5rem' }}>
          <strong>{personagem}</strong> já espera por você em Rookgaard. Para entrar no
          jogo, use <strong>{email}</strong> e a senha que você escolheu — a mesma vale
          para o site.
        </p>
        <div className="acoes" style={{ justifyContent: 'center' }}>
          <Link className="botao" to="/download">Baixar o client</Link>
          <Link className="botao vazado" to="/entrar">Entrar no painel</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '27rem', margin: '2rem auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.75rem', color: 'var(--ouro)' }}>
        <Sigilo tamanho={40} />
      </div>

      <div className="painel alto">
        <h1 style={{ fontSize: '1.7rem', textAlign: 'center' }}>Criar conta</h1>
        <p className="guia" style={{ textAlign: 'center', fontSize: '0.92rem' }}>
          Conta e primeiro personagem de uma vez só. Leva menos de um minuto.
        </p>

        <form className="formulario" onSubmit={enviar} style={{ marginTop: '1.5rem' }}>
          <label>
            <span>E-mail</span>
            <input
              type="email" value={email} required autoComplete="email"
              onChange={e => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
            <small>É com ele que você entra no jogo.</small>
          </label>

          <label>
            <span>Senha</span>
            <input
              type="password" value={senha} required minLength={8}
              autoComplete="new-password"
              onChange={e => setSenha(e.target.value)}
            />
            <small>Ao menos 8 caracteres.</small>
          </label>

          <label>
            <span>Nome do personagem</span>
            <input
              type="text" value={personagem} required minLength={3} maxLength={20}
              onChange={e => setPersonagem(e.target.value)}
              placeholder="Ex.: Arwen Solaris"
            />
            <small>Apenas letras e espaços. Não pode ser mudado depois.</small>
          </label>

          <fieldset>
            <legend>Sexo</legend>
            <div className="opcoes">
              <label className="opcao">
                <input type="radio" name="sexo" checked={sexo === 1} onChange={() => setSexo(1)} />
                <span>Masculino</span>
              </label>
              <label className="opcao">
                <input type="radio" name="sexo" checked={sexo === 0} onChange={() => setSexo(0)} />
                <span>Feminino</span>
              </label>
            </div>
          </fieldset>

          {erro && <Erro>{erro}</Erro>}

          <button className="botao largo" type="submit" disabled={enviando}>
            {enviando ? 'Criando…' : 'Criar conta'}
          </button>
        </form>
      </div>

      <p className="guia" style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.92rem' }}>
        Já tem conta? <Link to="/entrar">Entrar</Link>.
      </p>
    </div>
  )
}
