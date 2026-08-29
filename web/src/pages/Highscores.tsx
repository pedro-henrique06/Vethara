import { useEffect, useState } from 'react'
import { api, type Posicao } from '../api'

const TAMANHO = 50

export default function Highscores() {
  const [pagina, setPagina] = useState(1)
  const [lista, setLista] = useState<Posicao[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    setLista(null)
    api.highscores(pagina).then(setLista).catch(e => setErro(e.message))
  }, [pagina])

  // A API devolve menos que o tamanho da pagina quando chega ao fim da lista.
  const temProxima = (lista?.length ?? 0) === TAMANHO

  return (
    <section className="secao">
      <h1>Ranking</h1>
      {erro && <div className="aviso erro">{erro}</div>}
      {!lista && !erro && <div className="aviso">Carregando…</div>}
      {lista?.length === 0 && (
        <div className="aviso">Nenhum personagem nesta página.</div>
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
                {lista.map(p => (
                  <tr key={p.nome}>
                    <td className="num posto">{p.posicao}</td>
                    <td>{p.nome}</td>
                    <td>{p.vocacao}</td>
                    <td className="num">{p.level}</td>
                    <td className="num">{p.experiencia.toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="paginacao">
            <button onClick={() => setPagina(p => p - 1)} disabled={pagina === 1}>
              Anterior
            </button>
            <span>Página {pagina}</span>
            <button onClick={() => setPagina(p => p + 1)} disabled={!temProxima}>
              Próxima
            </button>
          </div>
        </>
      )}
    </section>
  )
}
