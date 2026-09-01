import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

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

const PASSOS = [
  ['Baixe o pacote', 'Um zip só, com os arquivos gráficos já dentro. Não há download extra depois da primeira abertura.'],
  ['Descompacte a pasta inteira', 'Rodar o executável de dentro do zip não funciona: ele precisa dos arquivos ao lado.'],
  ['Execute otclient.exe', 'Crie sua conta pelo site e entre com o mesmo e-mail e senha.'],
]

export default function Download() {
  const versao = useVersao()
  const megabytes = versao ? Math.round(versao.tamanho / 1048576) : null

  return (
    <>
      <section className="heroi">
        <span className="sobrancelha">Client oficial do Vethara</span>
        <h1>Baixar e jogar</h1>
        <p className="guia">
          Um fork do OTClient, já configurado para o nosso servidor. Windows 64 bits.
        </p>
        <div className="acoes">
          <a className="botao" href={ARQUIVO}>
            Baixar{megabytes ? ` · ${megabytes} MB` : ''}
          </a>
          <Link className="botao vazado" to="/criar-conta">Criar conta</Link>
        </div>
        {versao && (
          <p style={{ color: 'var(--tinta-3)', fontSize: '0.88rem', marginTop: '1.25rem', marginBottom: 0 }}>
            Versão <strong>{versao.versao}</strong>, publicada em{' '}
            {new Date(versao.publicado).toLocaleDateString('pt-BR')}.
          </p>
        )}
      </section>

      <section className="secao">
        <div className="secao-topo"><h2>Como instalar</h2></div>
        <div className="grade g3">
          {PASSOS.map(([titulo, texto], i) => (
            <article className="painel" key={titulo}>
              <div className="selo destaque" style={{ marginBottom: '0.6rem' }}>Passo {i + 1}</div>
              <h3>{titulo}</h3>
              <p className="guia" style={{ margin: 0, fontSize: '0.92rem' }}>{texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="secao">
        <div className="secao-topo"><h2>O aviso do Windows</h2></div>
        <div className="painel">
          <p className="guia">
            O Windows vai dizer que o arquivo é de origem desconhecida. Isso acontece
            porque o client não tem assinatura digital paga — não porque haja algo nele.
            Clique em <strong>Mais informações</strong> e depois em{' '}
            <strong>Executar assim mesmo</strong>.
          </p>
          {versao ? (
            <>
              <p className="guia" style={{ marginBottom: '0.5rem' }}>
                Se quiser conferir que baixou exatamente o que publicamos, compare o SHA-256:
              </p>
              <div className="rolagem" style={{ padding: '0.75rem', background: 'var(--fundo-2)' }}>
                <code style={{ fontSize: '0.82rem', color: 'var(--tinta-2)' }}>{versao.sha256}</code>
              </div>
            </>
          ) : (
            <p className="guia" style={{ margin: 0 }}>
              Assim que houver uma versão publicada, o SHA-256 do arquivo aparece aqui
              para conferência.
            </p>
          )}
        </div>
      </section>
    </>
  )
}
