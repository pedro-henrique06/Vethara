import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

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
      <section className="secao">
        <h1>Conta criada</h1>
        <div className="aviso">
          <p>
            Sua conta está pronta e <strong>{personagem}</strong> já espera por você
            em Rookgaard.
          </p>
          <p style={{ marginTop: '0.75rem' }}>
            Para entrar no jogo, use <strong>{email}</strong> e a senha que você
            escolheu.
          </p>
        </div>
        <div className="acoes" style={{ marginTop: '1.5rem' }}>
          <Link className="botao" to="/download">Baixar o client</Link>
          <Link className="botao vazado" to="/">Ir para o início</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="secao">
      <h1>Criar conta</h1>
      <p style={{ color: 'var(--ink-2)', maxWidth: '32rem', marginBottom: '1.5rem' }}>
        Uma conta e um personagem, de uma vez. Você entra no jogo com o e-mail e a
        senha informados aqui.
      </p>

      <form className="formulario" onSubmit={enviar}>
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
            <label className="radio">
              <input type="radio" name="sexo" checked={sexo === 1}
                     onChange={() => setSexo(1)} />
              <span>Masculino</span>
            </label>
            <label className="radio">
              <input type="radio" name="sexo" checked={sexo === 0}
                     onChange={() => setSexo(0)} />
              <span>Feminino</span>
            </label>
          </div>
        </fieldset>

        {erro && <div className="aviso erro">{erro}</div>}

        <button className="botao" type="submit" disabled={enviando}>
          {enviando ? 'Criando…' : 'Criar conta'}
        </button>
      </form>
    </section>
  )
}
