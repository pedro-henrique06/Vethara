import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Ficha } from '../api'
import { Brasao, Vocacao } from '../componentes/Icones'
import { baseDaVocacao } from '../vocacoes'
import { Carregando, Erro, Vazio } from '../componentes/Estados'

const HABILIDADES: [keyof Ficha['habilidades'], string][] = [
  ['magia', 'Magic level'],
  ['punho', 'Punho'],
  ['clava', 'Clava'],
  ['espada', 'Espada'],
  ['machado', 'Machado'],
  ['distancia', 'Distância'],
  ['escudo', 'Escudo'],
  ['pesca', 'Pesca'],
]

export default function Personagem() {
  const { nome } = useParams()
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!nome) return
    setFicha(null)
    setErro(null)
    api.personagem(nome).then(setFicha).catch(e => setErro(e.message))
  }, [nome])

  if (erro) {
    return (
      <Vazio titulo="Personagem não encontrado">
        <p className="guia" style={{ margin: '0.5rem 0 1rem' }}>{erro}</p>
        <Link className="botao vazado" to="/highscores">Ver o ranking</Link>
      </Vazio>
    )
  }

  if (!ficha) return <Carregando linhas={4} altura="4rem" />

  // A maior habilidade define a escala das barras: comparar cada uma com 100
  // deixaria todas rasteiras num personagem novo.
  const teto = Math.max(10, ...HABILIDADES.map(([k]) => ficha.habilidades[k]))

  return (
    <>
      <section className="ficha-topo">
        <span className={`brasao-grande voc-${baseDaVocacao(ficha.vocacao)}`}>
          <Brasao vocacao={ficha.vocacao} tamanho={30} />
        </span>
        <div>
          <h1>{ficha.nome}</h1>
          <div className="selos" style={{ marginTop: '0.5rem' }}>
            <span className="selo destaque">Level {ficha.level}</span>
            <span className="selo"><Vocacao valor={ficha.vocacao} tamanho={13} /></span>
            {ficha.online
              ? <span className="selo destaque">Online</span>
              : <span className="selo">Offline</span>}
            {ficha.guilda && (
              <span className="selo ouro">
                {ficha.cargo ? `${ficha.cargo} · ` : ''}{ficha.guilda}
              </span>
            )}
          </div>
        </div>
      </section>

      <dl className="numeros" style={{ marginBottom: '2.5rem' }}>
        <div className="numero">
          <dt>Experiência</dt>
          <dd style={{ fontSize: '1.35rem' }}>{ficha.experiencia.toLocaleString('pt-BR')}</dd>
        </div>
        <div className="numero">
          <dt>Horas jogadas</dt>
          <dd>{ficha.horasJogadas.toLocaleString('pt-BR')}<small> h</small></dd>
        </div>
        <div className="numero">
          <dt>Sexo</dt>
          <dd style={{ fontSize: '1.2rem' }}>{ficha.sexo}</dd>
        </div>
        <div className="numero">
          <dt>Último login</dt>
          <dd style={{ fontSize: '1.05rem' }}>
            {ficha.ultimoLogin
              ? new Date(ficha.ultimoLogin).toLocaleDateString('pt-BR')
              : 'nunca entrou'}
          </dd>
        </div>
      </dl>

      <div className="colunas">
        <section className="secao">
          <div className="secao-topo"><h2>Últimas mortes</h2></div>
          {ficha.mortes.length === 0 ? (
            <div className="painel">
              <p className="guia" style={{ margin: 0 }}>
                Nenhuma morte registrada. {ficha.level > 20 ? 'Impressionante.' : 'Por enquanto.'}
              </p>
            </div>
          ) : (
            <div className="rolagem">
              <table>
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th className="num">Level</th>
                    <th>Morto por</th>
                  </tr>
                </thead>
                <tbody>
                  {ficha.mortes.map((m, i) => (
                    <tr key={`${m.data}-${i}`}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(m.data).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                        })}
                      </td>
                      <td className="num">{m.level}</td>
                      <td>
                        {m.porJogador
                          ? <Link to={`/personagem/${encodeURIComponent(m.por)}`}>{m.por}</Link>
                          : m.por}
                        {m.maiorDano && (
                          <small style={{ color: 'var(--tinta-3)' }}> (maior dano: {m.maiorDano})</small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="secao">
          <div className="secao-topo"><h2>Habilidades</h2></div>
          <div className="painel">
            {HABILIDADES.map(([chave, rotulo]) => (
              <div className="linha-barra" key={chave}>
                <span>{rotulo}</span>
                <span className="barra">
                  <i style={{ width: `${(ficha.habilidades[chave] / teto) * 100}%` }} />
                </span>
                <span>{ficha.habilidades[chave]}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  )
}
