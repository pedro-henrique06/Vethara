import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Jogador } from '../api'
import { Lupa, Vocacao } from '../componentes/Icones'
import { baseDaVocacao } from '../vocacoes'
import { Carregando, Erro, Vazio } from '../componentes/Estados'

export default function Online() {
  const [lista, setLista] = useState<Jogador[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    let vivo = true
    const carregar = () => api.online()
      .then(l => { if (vivo) setLista(l) })
      .catch(e => { if (vivo) setErro(e.message) })
    carregar()
    // Esta é a página em que a lista mais envelhece: quem a deixa aberta espera
    // ver gente entrando e saindo.
    const t = setInterval(carregar, 30_000)
    return () => { vivo = false; clearInterval(t) }
  }, [])

  // Quantos de cada vocação, para a faixa de resumo no topo.
  const porVocacao = useMemo(() => {
    const conta = new Map<string, number>()
    for (const j of lista ?? []) {
      const b = baseDaVocacao(j.vocacao)
      conta.set(b, (conta.get(b) ?? 0) + 1)
    }
    return conta
  }, [lista])

  const filtrada = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return lista ?? []
    return (lista ?? []).filter(j => j.nome.toLowerCase().includes(termo))
  }, [lista, busca])

  const NOMES: [string, string][] = [
    ['knight', 'Knights'], ['paladin', 'Paladins'],
    ['druid', 'Druids'], ['sorcerer', 'Sorcerers'],
  ]

  return (
    <>
      <section className="secao">
        <h1>Quem está online</h1>
        <p className="guia">
          {lista
            ? `${lista.length} ${lista.length === 1 ? 'jogador' : 'jogadores'} no mundo agora. A lista se atualiza sozinha a cada 30 segundos.`
            : 'Carregando a lista do mundo…'}
        </p>
      </section>

      {erro && <Erro>{erro}</Erro>}
      {!lista && !erro && <Carregando linhas={8} />}

      {lista && lista.length > 0 && (
        <>
          <dl className="numeros" style={{ marginBottom: '1.5rem' }}>
            {NOMES.map(([chave, rotulo]) => (
              <div className="numero" key={chave}>
                <dt>{rotulo}</dt>
                <dd className={`voc-${chave}`}>{porVocacao.get(chave) ?? 0}</dd>
              </div>
            ))}
          </dl>

          <div className="filtros">
            <div className="busca">
              <Lupa />
              <input
                type="search"
                placeholder="Procurar alguém na lista…"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                aria-label="Procurar jogador online"
              />
            </div>
          </div>
        </>
      )}

      {lista?.length === 0 && (
        <Vazio titulo="Ninguém online no momento">Seja o primeiro a entrar hoje.</Vazio>
      )}

      {lista && lista.length > 0 && filtrada.length === 0 && (
        <Vazio titulo={`Ninguém chamado "${busca}" está online`}>
          O nome pode estar escrito diferente, ou o jogador saiu.
        </Vazio>
      )}

      {filtrada.length > 0 && (
        <div className="rolagem">
          <table>
            <thead>
              <tr>
                <th>Personagem</th>
                <th>Vocação</th>
                <th className="num">Level</th>
              </tr>
            </thead>
            <tbody>
              {filtrada.map(j => (
                <tr key={j.nome}>
                  <td><Link to={`/personagem/${encodeURIComponent(j.nome)}`}>{j.nome}</Link></td>
                  <td><Vocacao valor={j.vocacao} /></td>
                  <td className="num">{j.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
