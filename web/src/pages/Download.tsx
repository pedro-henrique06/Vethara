const ARQUIVO = '/download/vethara-client.zip'

export default function Download() {
  return (
    <section className="secao">
      <h1>Baixar o client</h1>
      <p style={{ color: 'var(--ink-2)', maxWidth: '34rem' }}>
        Descompacte a pasta inteira e execute <code>otclient.exe</code>. Na primeira
        vez ele baixa os arquivos gráficos do jogo sozinho — são cerca de 395 MB,
        e só acontece uma vez.
      </p>

      <div className="acoes" style={{ margin: '1.5rem 0' }}>
        <a className="botao" href={ARQUIVO}>Baixar (41 MB)</a>
      </div>

      <div className="aviso">
        <strong>O Windows vai avisar que o arquivo é desconhecido.</strong> Isso
        acontece porque o client não tem assinatura digital paga, não porque haja
        algo nele. Se quiser conferir que baixou exatamente o que publicamos,
        compare o SHA-256:
        <div className="rolagem" style={{ marginTop: '0.75rem' }}>
          <code style={{ fontSize: '0.85rem' }}>
            2190784a59474ff5521f78c0fe3fc3f239cdc4f94fa29598d4107ed56177cb42
          </code>
        </div>
      </div>
    </section>
  )
}
