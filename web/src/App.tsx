import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom'
import { api, type Status } from './api'
import { sessao } from './sessao'
import { Sigilo, Menu } from './componentes/Icones'
import Home from './pages/Home'
import Highscores from './pages/Highscores'
import Online from './pages/Online'
import Download from './pages/Download'
import CriarConta from './pages/CriarConta'
import Entrar from './pages/Entrar'
import MinhaConta from './pages/MinhaConta'
import Mundo from './pages/Mundo'
import Monstros from './pages/Monstros'
import Personagem from './pages/Personagem'

function Topo() {
  const [status, setStatus] = useState<Status | null>(null)
  const [aberto, setAberto] = useState(false)
  const onde = useLocation()

  useEffect(() => {
    let vivo = true
    const carregar = () => api.status().then(s => { if (vivo) setStatus(s) }).catch(() => {})
    carregar()
    // O contador de online envelhece rápido; 30s mantém sem martelar o banco.
    const t = setInterval(carregar, 30_000)
    return () => { vivo = false; clearInterval(t) }
  }, [])

  // Trocar de página fecha a gaveta. Sem isto ela fica aberta por cima do
  // conteúdo novo, e no celular parece que o clique não funcionou.
  useEffect(() => { setAberto(false) }, [onde.pathname])

  const classe = ({ isActive }: { isActive: boolean }) => (isActive ? 'ativo' : '')

  return (
    <header className="topo">
      <div className="topo-interno">
        <Link to="/" className="marca">
          <Sigilo />
          Vethara
        </Link>

        <button
          className="sanduiche"
          onClick={() => setAberto(a => !a)}
          aria-expanded={aberto}
          aria-label="Menu"
        >
          <Menu />
        </button>

        <nav className={`menu${aberto ? ' aberto' : ''}`}>
          <NavLink to="/" end className={classe}>Início</NavLink>
          <NavLink to="/mundo" className={classe}>Mundo</NavLink>
          <NavLink to="/monstros" className={classe}>Criaturas</NavLink>
          <NavLink to="/highscores" className={classe}>Ranking</NavLink>
          <NavLink to="/online" className={classe}>Online</NavLink>
          <NavLink to="/download" className={classe}>Download</NavLink>
          {sessao.ativa()
            ? <NavLink to="/minha-conta" className={classe}>Minha conta</NavLink>
            : <NavLink to="/entrar" className={classe}>Entrar</NavLink>}
        </nav>

        {status && (
          <div className="pulso" title="Atualiza a cada 30 segundos">
            <span className="ponto" aria-hidden="true" />
            {status.online} {status.online === 1 ? 'jogador online' : 'jogadores online'}
          </div>
        )}
      </div>
    </header>
  )
}

function Rodape() {
  return (
    <footer className="rodape">
      <div className="rodape-interno">
        <div>
          <h3>Jogar</h3>
          <ul>
            <li><Link to="/download">Baixar o client</Link></li>
            <li><Link to="/criar-conta">Criar conta</Link></li>
            <li><Link to="/mundo">Taxas e regras</Link></li>
          </ul>
        </div>
        <div>
          <h3>Explorar</h3>
          <ul>
            <li><Link to="/monstros">Criaturas</Link></li>
            <li><Link to="/highscores">Ranking</Link></li>
            <li><Link to="/online">Quem está online</Link></li>
          </ul>
        </div>
        <div>
          <h3>Servidor</h3>
          <ul>
            <li>Protocolo 15.25</li>
            <li>Mapa global</li>
            <li><a href="/aac">Painel antigo (MyAAC)</a></li>
          </ul>
        </div>
        <p className="fim">
          Vethara é um servidor não oficial de Tibia, sem vínculo com a CipSoft GmbH.
          Tibia e seus gráficos são marcas registradas da CipSoft GmbH.
        </p>
      </div>
    </footer>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Topo />
      <main className="casca">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mundo" element={<Mundo />} />
          <Route path="/monstros" element={<Monstros />} />
          <Route path="/highscores" element={<Highscores />} />
          <Route path="/online" element={<Online />} />
          <Route path="/download" element={<Download />} />
          <Route path="/criar-conta" element={<CriarConta />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/minha-conta" element={<MinhaConta />} />
          <Route path="/personagem/:nome" element={<Personagem />} />
          <Route path="*" element={
            <div className="vazio">
              <strong>Página não encontrada</strong>
              <Link to="/">Voltar ao início</Link>
            </div>
          } />
        </Routes>
      </main>
      <Rodape />
    </BrowserRouter>
  )
}
