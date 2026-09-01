// Os tres estados que toda tela que busca dados precisa mostrar. Ficam aqui
// porque estavam repetidos e ligeiramente diferentes em cada pagina — cada uma
// tinha o seu "Carregando…" e o seu jeito de dizer que a lista estava vazia.

type PropsErro = { children: React.ReactNode }

export function Erro({ children }: PropsErro) {
  return <div className="aviso erro" role="alert">{children}</div>
}

export function Vazio({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="vazio">
      <strong>{titulo}</strong>
      {children}
    </div>
  )
}

/** Blocos cinza no formato do conteudo que vem. Evita o salto do layout quando
 *  a resposta chega, que e o que acontece com um "Carregando…" de uma linha. */
export function Carregando({ linhas = 5, altura = '2.6rem' }: { linhas?: number; altura?: string }) {
  return (
    <div style={{ display: 'grid', gap: '0.4rem' }} aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="esqueleto" style={{ height: altura, opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  )
}
