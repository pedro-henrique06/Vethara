import { useEffect, useState } from 'react'
import { api, type Jogador } from '../api'

export default function Online() {
  const [lista, setLista] = useState<Jogador[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    api.online().then(setLista).catch(e => setErro(e.message))
  }, [])

  return (
    <section className="secao">
      <h1>Quem está online</h1>
      {erro && <div className="aviso erro">{erro}</div>}
      {!lista && !erro && <div className="aviso">Carregando…</div>}
      {lista?.length === 0 && (
        <div className="aviso">Ninguém online no momento. Seja o primeiro.</div>
      )}
      {lista && lista.length > 0 && (
        <div className="rolagem">
          <table>
            <thead>
              <tr><th>Personagem</th><th>Vocação</th><th className="num">Level</th></tr>
            </thead>
            <tbody>
              {lista.map(j => (
                <tr key={j.nome}>
                  <td>{j.nome}</td>
                  <td>{j.vocacao}</td>
                  <td className="num">{j.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
