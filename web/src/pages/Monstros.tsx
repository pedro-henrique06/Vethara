import { useEffect, useMemo, useState } from 'react'
import {
  carregarIndice, carregarDetalhes, chanceEmPorcento, raridade,
  type Detalhe, type Monstro,
} from '../monstros'
import { Lupa } from '../componentes/Icones'
import { Carregando, Erro, Vazio } from '../componentes/Estados'

const ELEMENTOS = ['fisico', 'fogo', 'gelo', 'energia', 'terra', 'sagrado', 'morte'] as const
const NOME_ELEMENTO: Record<string, string> = {
  fisico: 'Físico', fogo: 'Fogo', gelo: 'Gelo', energia: 'Energia', terra: 'Terra',
  sagrado: 'Sagrado', morte: 'Morte', vida: 'Dreno de vida', mana: 'Dreno de mana',
  afogamento: 'Afogamento',
}
const NOME_IMUNIDADE: Record<string, string> = {
  paralyze: 'paralisia', invisible: 'invisibilidade', outfit: 'transformação',
  bleed: 'sangramento', drunk: 'embriaguez', fire: 'fogo', energy: 'energia',
  ice: 'gelo', earth: 'terra', death: 'morte', holy: 'sagrado', physical: 'físico',
  lifedrain: 'dreno de vida', manadrain: 'dreno de mana',
}

const POR_PAGINA = 60

export default function Monstros() {
  const [lista, setLista] = useState<Monstro[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [classe, setClasse] = useState('')
  const [so, setSo] = useState<'todos' | 'chefes' | 'bestiario'>('todos')
  const [ordem, setOrdem] = useState<'nome' | 'experiencia' | 'vida'>('nome')
  const [quantos, setQuantos] = useState(POR_PAGINA)

  const [aberto, setAberto] = useState<Monstro | null>(null)
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)

  useEffect(() => {
    carregarIndice().then(d => setLista(d.monstros)).catch(e => setErro(e.message))
  }, [])

  // O arquivo de detalhes só é baixado quando alguém abre a primeira ficha.
  useEffect(() => {
    if (!aberto) return
    setDetalhe(null)
    let vivo = true
    carregarDetalhes()
      .then(d => { if (vivo) setDetalhe(d.detalhes[aberto.nome] ?? {}) })
      .catch(() => { if (vivo) setDetalhe({}) })
    return () => { vivo = false }
  }, [aberto])

  const classes = useMemo(
    () => [...new Set((lista ?? []).map(m => m.classe).filter(Boolean) as string[])].sort(),
    [lista]
  )

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const r = (lista ?? []).filter(m => {
      if (termo && !m.nome.toLowerCase().includes(termo)) return false
      if (classe && m.classe !== classe) return false
      if (so === 'chefes' && !m.chefe) return false
      if (so === 'bestiario' && !m.classe) return false
      return true
    })
    if (ordem === 'nome') return r
    // O índice já vem ordenado por nome; só reordena quando é outra coisa.
    return [...r].sort((a, b) => b[ordem] - a[ordem])
  }, [lista, busca, classe, so, ordem])

  // Qualquer mudança de filtro volta a mostrar só a primeira leva.
  useEffect(() => { setQuantos(POR_PAGINA) }, [busca, classe, so, ordem])

  return (
    <>
      <section className="secao">
        <h1>Criaturas</h1>
        <p className="guia">
          As {lista?.length.toLocaleString('pt-BR') ?? '1.363'} criaturas do datapack, com
          vida, experiência e loot como estão no servidor. Clique para ver a ficha.
        </p>
      </section>

      {erro && <Erro>{erro}</Erro>}

      <div className="filtros">
        <div className="busca">
          <Lupa />
          <input
            type="search"
            placeholder="Buscar criatura…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            aria-label="Buscar criatura"
          />
        </div>

        <select value={classe} onChange={e => setClasse(e.target.value)} aria-label="Classe">
          <option value="">Todas as classes</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={ordem} onChange={e => setOrdem(e.target.value as typeof ordem)} aria-label="Ordenar">
          <option value="nome">Por nome</option>
          <option value="experiencia">Maior experiência</option>
          <option value="vida">Maior vida</option>
        </select>
      </div>

      <div className="pilulas" style={{ marginBottom: '1.5rem' }}>
        {([['todos', 'Todas'], ['bestiario', 'No bestiário'], ['chefes', 'Chefes']] as const).map(
          ([valor, rotulo]) => (
            <button
              key={valor}
              className="pilula"
              aria-pressed={so === valor}
              onClick={() => setSo(valor)}
            >
              {rotulo}
            </button>
          )
        )}
      </div>

      {!lista && !erro && <Carregando linhas={8} altura="4rem" />}

      {lista && (
        <div className="colunas">
          <div>
            {filtrados.length === 0 ? (
              <Vazio titulo="Nenhuma criatura encontrada">
                Tente outro nome ou tire os filtros.
              </Vazio>
            ) : (
              <>
                <div className="monstros">
                  {filtrados.slice(0, quantos).map(m => (
                    <button
                      key={m.nome}
                      className="monstro"
                      aria-pressed={aberto?.nome === m.nome}
                      onClick={() => setAberto(m)}
                    >
                      <span className="titulo">{m.nome}</span>
                      <span className="medidas">
                        <span>{m.vida.toLocaleString('pt-BR')} hp</span>
                        <span>{m.experiencia.toLocaleString('pt-BR')} xp</span>
                      </span>
                      <span className="selos">
                        {m.classe && <span className="selo">{m.classe}</span>}
                        {m.chefe && <span className="selo ouro">Chefe</span>}
                      </span>
                    </button>
                  ))}
                </div>

                {quantos < filtrados.length && (
                  <div className="paginacao">
                    <button className="botao discreto" onClick={() => setQuantos(q => q + POR_PAGINA)}>
                      Mostrar mais
                    </button>
                    <span>{quantos} de {filtrados.length.toLocaleString('pt-BR')}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <aside>
            <div className="ficha-monstro">
              {!aberto ? (
                <div className="painel">
                  <h3>Ficha</h3>
                  <p className="guia" style={{ margin: 0, fontSize: '0.92rem' }}>
                    Escolha uma criatura na lista para ver onde ela aparece, o que ela
                    derruba e a que dano ela é fraca.
                  </p>
                </div>
              ) : (
                <FichaMonstro monstro={aberto} detalhe={detalhe} />
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

function FichaMonstro({ monstro, detalhe }: { monstro: Monstro; detalhe: Detalhe | null }) {
  return (
    <div className="painel alto">
      <h3 style={{ fontSize: '1.3rem' }}>{monstro.nome}</h3>
      <div className="selos" style={{ marginBottom: '1rem' }}>
        {monstro.classe && <span className="selo">{monstro.classe}</span>}
        {monstro.chefe && <span className="selo ouro">Chefe</span>}
        {monstro.estrelas ? (
          <span className="selo" title={`Dificuldade ${monstro.estrelas} de 5`}>
            <span className="estrelas">{'★'.repeat(monstro.estrelas)}</span>
          </span>
        ) : null}
      </div>

      <div className="linha-barra"><span>Vida</span><span /><span>{monstro.vida.toLocaleString('pt-BR')}</span></div>
      <div className="linha-barra"><span>Experiência</span><span /><span>{monstro.experiencia.toLocaleString('pt-BR')}</span></div>
      {monstro.armadura != null && (
        <div className="linha-barra"><span>Armadura</span><span /><span>{monstro.armadura}</span></div>
      )}
      {monstro.velocidade != null && (
        <div className="linha-barra"><span>Velocidade</span><span /><span>{monstro.velocidade}</span></div>
      )}

      {detalhe === null && <div className="esqueleto" style={{ height: '8rem', marginTop: '1rem' }} />}

      {detalhe && (
        <>
          {detalhe.elementos && (
            <>
              <h3 style={{ marginTop: '1.5rem' }}>Dano recebido</h3>
              {ELEMENTOS.filter(e => detalhe.elementos?.[e] !== undefined).map(e => {
                // No datapack, positivo é resistência e negativo é fraqueza. Para o
                // jogador o que importa é o dano que entra: 100% menos o valor.
                const pct = detalhe.elementos![e]
                const recebe = 100 - pct
                return (
                  <div className="linha-barra" key={e}>
                    <span>{NOME_ELEMENTO[e] ?? e}</span>
                    <span className={`barra${recebe > 100 ? ' perigo' : ''}`}>
                      <i style={{ width: `${Math.min(recebe, 200) / 2}%` }} />
                    </span>
                    <span>{recebe}%</span>
                  </div>
                )
              })}
            </>
          )}

          {detalhe.imunidades?.length ? (
            <>
              <h3 style={{ marginTop: '1.5rem' }}>Imune a</h3>
              <div className="selos">
                {detalhe.imunidades.map(i => (
                  <span className="selo" key={i}>{NOME_IMUNIDADE[i] ?? i}</span>
                ))}
              </div>
            </>
          ) : null}

          {detalhe.locais && (
            <>
              <h3 style={{ marginTop: '1.5rem' }}>Onde aparece</h3>
              <p className="guia" style={{ fontSize: '0.88rem', margin: 0 }}>{detalhe.locais}</p>
            </>
          )}

          {detalhe.matarPara ? (
            <p className="guia" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>
              Bestiário: {detalhe.matarPara.toLocaleString('pt-BR')} mortes
              {detalhe.cargas ? ` · ${detalhe.cargas} pontos de charm` : ''}
            </p>
          ) : null}

          {detalhe.loot?.length ? (
            <>
              <h3 style={{ marginTop: '1.5rem' }}>Loot</h3>
              <div className="loot">
                {detalhe.loot.map(l => (
                  <div className="item-loot" key={l.item}>
                    <span className="nome-item">
                      {l.item}
                      {l.maximo ? <span style={{ color: 'var(--pergaminho-3)' }}> ×{l.maximo}</span> : null}
                    </span>
                    <span className={`chance ${raridade(l.chance)}`}>{chanceEmPorcento(l.chance)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="guia" style={{ fontSize: '0.88rem', marginTop: '1.5rem' }}>
              Não derruba nada.
            </p>
          )}
        </>
      )}
    </div>
  )
}
