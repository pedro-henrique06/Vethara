import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api'
import { sessao } from '../sessao'

export default function Entrar() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const ir = useNavigate()

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const r = await api.entrar(email, senha)
      sessao.entrar(r.token)
      ir('/minha-conta')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="secao">
      <h1>Entrar</h1>
      <p style={{ color: 'var(--ink-2)', marginBottom: '1.5rem' }}>
        Use o mesmo e-mail e senha do jogo.
      </p>

      <form className="formulario" onSubmit={enviar}>
        <label>
          <span>E-mail</span>
          <input type="email" value={email} required autoComplete="email"
                 onChange={e => setEmail(e.target.value)} />
        </label>

        <label>
          <span>Senha</span>
          <input type="password" value={senha} required autoComplete="current-password"
                 onChange={e => setSenha(e.target.value)} />
        </label>

        {erro && <div className="aviso erro">{erro}</div>}

        <button className="botao" type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p style={{ marginTop: '1.5rem', color: 'var(--ink-2)' }}>
        Ainda não tem conta? <Link to="/criar-conta">Criar agora</Link>.
      </p>
    </section>
  )
}
