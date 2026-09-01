import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api'
import { sessao } from '../sessao'
import { Sigilo } from '../componentes/Icones'
import { Erro } from '../componentes/Estados'

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
    // Coluna estreita e centrada: numa tela de login não há nada para comparar
    // ao lado, e a linha inteira da página deixaria os campos gigantes.
    <div style={{ maxWidth: '25rem', margin: '2rem auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.75rem', color: 'var(--realce)' }}>
        <Sigilo tamanho={40} />
      </div>

      <div className="painel alto">
        <h1 style={{ fontSize: '1.7rem', textAlign: 'center' }}>Entrar</h1>
        <p className="guia" style={{ textAlign: 'center', fontSize: '0.92rem' }}>
          Use o mesmo e-mail e senha do jogo.
        </p>

        <form className="formulario" onSubmit={enviar} style={{ marginTop: '1.5rem' }}>
          <label>
            <span>E-mail</span>
            <input
              type="email" value={email} required autoComplete="email" autoFocus
              placeholder="voce@exemplo.com"
              onChange={e => setEmail(e.target.value)}
            />
          </label>

          <label>
            <span>Senha</span>
            <input
              type="password" value={senha} required autoComplete="current-password"
              onChange={e => setSenha(e.target.value)}
            />
          </label>

          {erro && <Erro>{erro}</Erro>}

          <button className="botao largo" type="submit" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>

      <p className="guia" style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.92rem' }}>
        Ainda não tem conta? <Link to="/criar-conta">Criar agora</Link>.
      </p>
    </div>
  )
}
