import { useEffect, useState } from 'react'

const ARQUIVO = '/download/vethara-client.zip'

type Versao = {
  versao: string
  tamanho: number
  sha256: string
  publicado: string
}

// Escrito pelo deploy/publicar-client.sh no VPS a cada release. Ler daqui, em
// vez de deixar o hash fixo no codigo, evita o pior caso: publicar um client
// novo e a pagina seguir mostrando o hash do antigo — quem conferisse concluiria
// que baixou um arquivo adulterado.
function useVersao() {
  const [versao, setVersao] = useState<Versao | null>(null)

  useEffect(() => {
    let ativo = true
    fetch('/download/versao.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (ativo && d?.sha256) setVersao(d) })
      .catch(() => { /* sem versao.json a pagina so omite os detalhes */ })
    return () => { ativo = false }
  }, [])

  return versao
}

export default function Download() {
  const versao = useVersao()
  const megabytes = versao ? Math.round(versao.tamanho / 1048576) : null

  return (
    <section className="secao">
      <h1>Baixar o client</h1>
      <p style={{ color: 'var(--ink-2)', maxWidth: '34rem' }}>
        Descompacte a pasta inteira e execute <code>otclient.exe</code>. Na primeira
        vez ele baixa os arquivos gráficos do jogo sozinho — são cerca de 395 MB,
        e só acontece uma vez.
      </p>

      <div className="acoes" style={{ margin: '1.5rem 0' }}>
        <a className="botao" href={ARQUIVO}>
          Baixar{megabytes ? ` (${megabytes} MB)` : ''}
        </a>
      </div>

      {versao && (
        <p style={{ color: 'var(--ink-2)', fontSize: '0.9rem' }}>
          Versão <strong>{versao.versao}</strong>, publicada em{' '}
          {new Date(versao.publicado).toLocaleDateString('pt-BR')}.
        </p>
      )}

      <div className="aviso">
        <strong>O Windows vai avisar que o arquivo é desconhecido.</strong> Isso
        acontece porque o client não tem assinatura digital paga, não porque haja
        algo nele.
        {versao && (
          <>
            {' '}Se quiser conferir que baixou exatamente o que publicamos, compare
            o SHA-256:
            <div className="rolagem" style={{ marginTop: '0.75rem' }}>
              <code style={{ fontSize: '0.85rem' }}>{versao.sha256}</code>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
