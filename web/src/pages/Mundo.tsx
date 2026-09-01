// Tudo o que muda em relação ao Tibia global, num lugar só.
//
// Os números vêm do servidor/Dockerfile, que é onde os ajustes são aplicados na
// imagem do Canary. Ao mexer nas taxas de lá, mexa aqui: esta página é a única
// coisa que o jogador lê antes de decidir se entra.

import { Link } from 'react-router-dom'

const TAXAS = [
  {
    titulo: 'Experiência 50x',
    detalhe: 'Valor final, não bônus sobre stages. Com o multiplicador de stamina ' +
      'e o bônus de nível baixo, os primeiros levels chegam a 112x.',
    selo: '50x',
  },
  {
    titulo: 'Respawn 2x',
    detalhe: 'Os spawns de 90 segundos do mapa global caem para 45, e os de 60 vão a 30. ' +
      'Segurar em 2x é o que mantém o servidor estável — em 3x a memória do VPS esgotava.',
    selo: '2x',
  },
  {
    titulo: 'Velocidade base dobrada',
    detalhe: 'A velocidade base das vocações vai de 110 para 220. O ganho é de +110 em ' +
      'qualquer nível: o dobro exato no level 1, cerca de 1,5x no level 100.',
    selo: '220',
  },
  {
    titulo: 'Premium para todos',
    detalhe: 'Free premium ligado. Além das áreas e vocações promovidas, é ele que libera ' +
      'o multiplicador de stamina de 1,5x acima de 39 horas.',
    selo: 'Grátis',
  },
  {
    titulo: 'Magias por level',
    detalhe: 'Nenhuma magia precisa ser comprada de NPC. Os requisitos continuam valendo: ' +
      'level, magic level, vocação e mana são checados normalmente.',
    selo: 'Sem NPC',
  },
  {
    titulo: 'Mapa global completo',
    detalhe: 'O otservbr-global inteiro, sem áreas cortadas, com as 1.363 criaturas do ' +
      'datapack e os chefes de quest no lugar.',
    selo: '15.25',
  },
]

const PORTAS = [
  ['7171', 'Login do jogo'],
  ['7172', 'Mundo 15.25'],
  ['7174 / 7175', 'Mundos 11.00 e 8.60'],
  ['443', 'Site e login web, por HTTPS'],
]

export default function Mundo() {
  return (
    <>
      <section className="heroi">
        <span className="sobrancelha">O mundo</span>
        <h1>Taxas, regras e o que muda</h1>
        <p className="guia">
          O Vethara roda o mapa global no protocolo 15.25, com ajustes escolhidos para
          quem tem algumas horas por semana — não para quem tem o dia inteiro.
        </p>
      </section>

      <section className="secao">
        <div className="secao-topo"><h2>O que mudamos</h2></div>
        <div className="grade g2">
          {TAXAS.map(t => (
            <article className="painel alto" key={t.titulo}>
              <div className="selos" style={{ marginBottom: '0.6rem' }}>
                <span className="selo destaque">{t.selo}</span>
              </div>
              <h3>{t.titulo}</h3>
              <p className="guia" style={{ margin: 0, fontSize: '0.92rem' }}>{t.detalhe}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="colunas">
        <section className="secao">
          <div className="secao-topo"><h2>Como a experiência é calculada</h2></div>
          <div className="painel">
            <p className="guia">
              A conta do Canary multiplica tudo, e é por isso que 50x não é o teto:
            </p>
            <p style={{
              fontFamily: 'var(--fonte-mono)', fontSize: '0.9rem',
              background: 'var(--pedra)', padding: '0.9rem', borderRadius: 'var(--raio)',
              color: 'var(--pergaminho-2)', overflowX: 'auto',
            }}>
              experiência × (1 + bônus de nível) × stamina × 50
            </p>
            <p className="guia" style={{ marginBottom: 0 }}>
              Em níveis baixos o bônus vale 1,5, e a stamina acima de 39 horas vale outros
              1,5 — daí os <strong>112x</strong> do começo. Conforme o personagem sobe, o
              bônus de nível diminui e a taxa se aproxima de 75x com stamina cheia.
            </p>
          </div>
        </section>

        <aside className="secao">
          <div className="secao-topo"><h2>Portas</h2></div>
          <div className="painel">
            <table>
              <tbody>
                {PORTAS.map(([porta, uso]) => (
                  <tr key={porta}>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>{porta}</td>
                    <td style={{ color: 'var(--pergaminho-2)' }}>{uso}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="painel">
            <h3>Conta e personagem</h3>
            <p className="guia" style={{ fontSize: '0.92rem' }}>
              A mesma senha vale para o site e para o jogo. Personagens são criados
              pelo painel da conta e entram no mundo imediatamente.
            </p>
            <div className="acoes">
              <Link className="botao p" to="/criar-conta">Criar conta</Link>
              <Link className="botao p vazado" to="/download">Baixar o client</Link>
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}
