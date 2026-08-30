import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom'
import { api, type Status } from './api'
import { sessao } from './sessao'
import Home from './pages/Home'
import Highscores from './pages/Highscores'
import Online from './pages/Online'
import Download from './pages/Download'
import CriarConta from './pages/CriarConta'
import Entrar from './pages/Entrar'
import MinhaConta from './pages/MinhaConta'

function Topo() {
  const [status, setStatus] = useState<Status | null>(null)

  useEffect(() => {
    let vivo = true
    const carregar = () => api.status().then(s => { if (vivo) setStatus(s) }).catch(() => {})
    carregar()
    // O contador de online envelhece rápido; 30s mantém sem martelar o banco.
    const t = setInterval(carregar, 30_000)
    return () => { vivo = false; clearInterval(t) }
  }, [])

  const classe = ({ isActive }: { isActive: boolean }) => (isActive ? 'ativo' : '')

  return (
    <header className="topo">
      <div className="topo-interno">
        <Link to="/" className="marca">Vethara</Link>
        <nav className="menu">
          <NavLink to="/" end className={classe}>Início</NavLink>
          <NavLink to="/highscores" className={classe}>Ranking</NavLink>
          <NavLink to="/online" className={classe}>Online</NavLink>
          <NavLink to="/download" className={classe}>Download</NavLink>
          <NavLink to="/criar-conta" className={classe}>Criar conta</NavLink>
          {sessao.ativa()
            ? <NavLink to="/minha-conta" className={classe}>Minha conta</NavLink>
            : <NavLink to="/entrar" className={classe}>Entrar</NavLink>}
        </nav>
        {status && (
          <div className="pulso">
            <span className="ponto" aria-hidden="true" />
            {status.online} {status.online === 1 ? 'jogador online' : 'jogadores online'}
          </div>
        )}
      </div>
    </header>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Topo />
      <main className="casca">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/highscores" element={<Highscores />} />
          <Route path="/online" element={<Online />} />
          <Route path="/download" element={<Download />} />
          <Route path="/criar-conta" element={<CriarConta />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/minha-conta" element={<MinhaConta />} />
          <Route path="*" element={
            <div className="aviso">
              Página não encontrada. <Link to="/">Voltar ao início</Link>.
            </div>
          } />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
