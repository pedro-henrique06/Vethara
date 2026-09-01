import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Noticia, type Posicao, type Status } from '../api'
import { Vocacao } from '../componentes/Icones'
import { Carregando, Erro } from '../componentes/Estados'

// As taxas ficam aqui e na página do Mundo. A fonte é o servidor/Dockerfile —
// mudar lá e não mudar aqui faz a home mentir, então o número curto vive junto
// da explicação, e a página do Mundo é quem detalha.
const TAXAS = [
  { valor: '50x', rotulo: 'Experiência' },
  { valor: '2x', rotulo: 'Respawn' },
  { valor: '2x', rotulo: 'Velocidade base' },
  { valor: 'Grátis', rotulo: 'Premium' },
]

export default function Home() {
  const [status, setStatus] = useState<Status | null>(null)
  const [noticias, setNoticias] = useState<Noticia[] | null>(null)
  const [topo, setTopo] = useState<Posicao[]>([])
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    // Promise.all falharia inteiro se só o ranking falhasse; separado, cada
    // bloco cai sozinho e o resto da home continua de pé.
    api.status().then(setStatus).catch(e => setErro(e.message))
    api.noticias(4).then(setNoticias).catch(() => setNoticias([]))
    api.highscores(1).then(l => setTopo(l.slice(0, 5))).catch(() => {})
  }, [])

  return (
    <>
      <section className="heroi">
        <span className="sobrancelha">Servidor brasileiro · Protocolo 15.25</span>
        <h1>O mundo global, com o ritmo certo</h1>
        <p className="guia">
          Mapa global completo, experiência 50x, respawn dobrado e premium liberado
          para todo mundo. Baixe o client, crie a conta e entre — leva dois minutos.
        </p>
        <div className="acoes">
          <Link className="botao" to="/download">Baixar o client</Link>
          <Link className="botao vazado" to="/criar-conta">Criar conta grátis</Link>
        </div>
      </section>

      {erro && <Erro>{erro}</Erro>}

      <dl className="numeros" style={{ marginBottom: '3.5rem' }}>
        <div className="numero">
          <dt>Online agora</dt>
          <dd>{status ? status.online : '—'}</dd>
        </div>
        <div className="numero">
          <dt>Personagens</dt>
          <dd>{status ? status.personagens.toLocaleString('pt-BR') : '—'}</dd>
        </div>
        <div className="numero">
          <dt>Contas</dt>
          <dd>{status ? status.contas.toLocaleString('pt-BR') : '—'}</dd>
        </div>
        <div className="numero">
          <dt>Criaturas</dt>
          <dd>1.363</dd>
        </div>
      </dl>

      <section className="secao">
        <div className="secao-topo">
          <h2>Como o Vethara joga</h2>
          <Link to="/mundo">Ver tudo sobre o mundo →</Link>
        </div>
        <dl className="numeros">
          {TAXAS.map(t => (
            <div className="numero" key={t.rotulo}>
              <dt>{t.rotulo}</dt>
              <dd>{t.valor}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="colunas">
        <section className="secao">
          <div className="secao-topo"><h2>Notícias</h2></div>
          {!noticias && <Carregando linhas={3} altura="7rem" />}
          {noticias?.length === 0 && (
            <div className="painel">
              <p className="guia" style={{ margin: 0 }}>
                Nenhuma notícia publicada ainda. As novidades do servidor aparecem aqui.
              </p>
            </div>
          )}
          {noticias?.map(n => (
            <article className="painel" key={n.id}>
              <h3>{n.titulo}</h3>
              <time dateTime={n.data} style={{ fontSize: '0.8rem', color: 'var(--tinta-3)' }}>
                {new Date(n.data).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </time>
              <div
                className="guia"
                style={{ marginTop: '0.75rem' }}
                dangerouslySetInnerHTML={{ __html: n.corpo }}
              />
            </article>
          ))}
        </section>

        <aside className="secao">
          <div className="secao-topo">
            <h2>Topo do ranking</h2>
            <Link to="/highscores">Ver todos</Link>
          </div>
          <div className="painel alto">
            {topo.length === 0 && <p className="guia" style={{ margin: 0 }}>Ainda sem personagens no ranking.</p>}
            {topo.map(p => (
              <div key={p.nome} className="linha-barra" style={{ gridTemplateColumns: '1.5rem 1fr auto' }}>
                <span className={`posto${p.posicao <= 3 ? ' medalha' : ''}`}>{p.posicao}</span>
                <span style={{ minWidth: 0 }}>
                  <Link to={`/personagem/${encodeURIComponent(p.nome)}`}>{p.nome}</Link>
                  <br />
                  <small style={{ color: 'var(--tinta-3)' }}>
                    <Vocacao valor={p.vocacao} tamanho={12} />
                  </small>
                </span>
                <span className="num">{p.level}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  )
}
