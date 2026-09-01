import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Posicao } from '../api'
import { Vocacao } from '../componentes/Icones'
import { Carregando, Erro, Vazio } from '../componentes/Estados'

const TAMANHO = 50

// A API filtra por id de vocação. Só as quatro promovidas aparecem aqui: quem
// chega ao topo do ranking já promoveu, e oferecer as oito dobraria a lista
// para dividir os mesmos jogadores.
const FILTROS: [number | null, string][] = [
  [null, 'Todas'],
  [5, 'Master Sorcerer'],
  [6, 'Elder Druid'],
  [7, 'Royal Paladin'],
  [8, 'Elite Knight'],
]

export default function Highscores() {
  const [pagina, setPagina] = useState(1)
  const [vocacao, setVocacao] = useState<number | null>(null)
  const [lista, setLista] = useState<Posicao[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    setLista(null)
    setErro(null)
    api.highscores(pagina, vocacao).then(setLista).catch(e => setErro(e.message))
  }, [pagina, vocacao])

  // A API devolve menos que o tamanho da página quando chega ao fim da lista.
  const temProxima = (lista?.length ?? 0) === TAMANHO
  // O pódio só faz sentido na primeira página, onde o 1º lugar de fato está.
  const podio = pagina === 1 ? (lista ?? []).slice(0, 3) : []
  const restante = pagina === 1 ? (lista ?? []).slice(3) : (lista ?? [])

  return (
    <>
      <section className="secao">
        <h1>Ranking</h1>
        <p className="guia">Por experiência acumulada. A equipe do servidor não entra na lista.</p>
      </section>

      <div className="pilulas" style={{ marginBottom: '1.5rem' }}>
        {FILTROS.map(([id, rotulo]) => (
          <button
            key={rotulo}
            className="pilula"
            aria-pressed={vocacao === id}
            onClick={() => { setVocacao(id); setPagina(1) }}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {erro && <Erro>{erro}</Erro>}
      {!lista && !erro && <Carregando linhas={8} />}

      {lista?.length === 0 && (
        <Vazio titulo="Nenhum personagem nesta lista">
          {vocacao ? 'Ninguém dessa vocação chegou ao ranking ainda.' : 'O ranking enche conforme o mundo cresce.'}
        </Vazio>
      )}

      {podio.length === 3 && (
        <div className="podio">
          {/* Ordem visual 2º, 1º, 3º: o primeiro fica no meio e mais alto. */}
          {[podio[1], podio[0], podio[2]].map(p => (
            <article className={`degrau${p.posicao === 1 ? ' primeiro' : ''}`} key={p.nome}>
              <div className="coroa">{p.posicao}º lugar</div>
              <div className="nome">
                <Link to={`/personagem/${encodeURIComponent(p.nome)}`}>{p.nome}</Link>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.4rem' }}>
                <Vocacao valor={p.vocacao} />
              </div>
              <div className="exp">
                Level {p.level} · {p.experiencia.toLocaleString('pt-BR')} xp
              </div>
            </article>
          ))}
        </div>
      )}

      {lista && lista.length > 0 && (
        <>
          <div className="rolagem">
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Personagem</th>
                  <th>Vocação</th>
                  <th className="num">Level</th>
                  <th className="num">Experiência</th>
                </tr>
              </thead>
              <tbody>
                {restante.map(p => (
                  <tr key={p.nome}>
                    <td className={`num posto${p.posicao <= 3 ? ' medalha' : ''}`}>{p.posicao}</td>
                    <td><Link to={`/personagem/${encodeURIComponent(p.nome)}`}>{p.nome}</Link></td>
                    <td><Vocacao valor={p.vocacao} /></td>
                    <td className="num">{p.level}</td>
                    <td className="num">{p.experiencia.toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="paginacao">
            <button
              className="botao discreto p"
              onClick={() => setPagina(p => p - 1)}
              disabled={pagina === 1}
            >
              Anterior
            </button>
            <span>Página {pagina}</span>
            <button
              className="botao discreto p"
              onClick={() => setPagina(p => p + 1)}
              disabled={!temProxima}
            >
              Próxima
            </button>
          </div>
        </>
      )}
    </>
  )
}
