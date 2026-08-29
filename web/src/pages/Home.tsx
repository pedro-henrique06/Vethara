import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Noticia, type Status } from '../api'

export default function Home() {
  const [status, setStatus] = useState<Status | null>(null)
  const [noticias, setNoticias] = useState<Noticia[]>([])
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.status(), api.noticias(5)])
      .then(([s, n]) => { setStatus(s); setNoticias(n) })
      .catch(e => setErro(e.message))
  }, [])

  return (
    <>
      <section className="heroi">
        <h1>Vethara</h1>
        <p>
          Servidor de Tibia com mapa global e protocolo 15.25. Baixe o client,
          crie sua conta e comece agora.
        </p>
        <div className="acoes">
          <Link className="botao" to="/download">Baixar o client</Link>
          <a className="botao vazado" href="/aac">Criar conta</a>
        </div>
      </section>

      {erro && <div className="aviso erro">{erro}</div>}

      {status && (
        <dl className="numeros">
          <div className="numero"><dt>Online agora</dt><dd>{status.online}</dd></div>
          <div className="numero"><dt>Personagens</dt><dd>{status.personagens}</dd></div>
          <div className="numero"><dt>Contas</dt><dd>{status.contas}</dd></div>
          <div className="numero"><dt>Protocolo</dt><dd>15.25</dd></div>
        </dl>
      )}

      <section className="secao">
        <h2>Notícias</h2>
        {noticias.length === 0 && !erro && (
          <div className="aviso">Nenhuma notícia publicada ainda.</div>
        )}
        {noticias.map(n => (
          <article className="cartao" key={n.id}>
            <h3>{n.titulo}</h3>
            <time dateTime={n.data}>
              {new Date(n.data).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'long', year: 'numeric'
              })}
            </time>
            <div className="corpo" dangerouslySetInnerHTML={{ __html: n.corpo }} />
          </article>
        ))}
      </section>
    </>
  )
}
