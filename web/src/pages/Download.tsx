import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const ZIP = '/download/vethara-client.zip'
const INSTALADOR = '/download/VetharaSetup.exe'

type Arquivo = {
  arquivo: string
  tamanho: number
  sha256: string
}

type Versao = Arquivo & {
  versao: string
  publicado: string
  // Presente so nos releases que trazem o instalador. Releases antigos tem
  // apenas o zip, e a pagina continua funcionando com eles.
  instalador?: Arquivo
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

const megabytes = (bytes: number) => Math.round(bytes / 1048576)

const PASSOS = [
  ['Baixe o instalador', 'Um executável só. Não precisa descompactar nada.'],
  ['Dois cliques e avançar', 'Ele instala na sua pasta de usuário, cria o atalho e abre o jogo no fim.'],
  ['Entre com a sua conta', 'Crie a conta pelo site e use o mesmo e-mail e senha no jogo.'],
]

export default function Download() {
  const versao = useVersao()

  // Enquanto o versao.json nao carrega, a pagina ja oferece o instalador: e o
  // caminho recomendado, e o link e estatico. Os detalhes (tamanho, hash)
  // aparecem quando o arquivo chega.
  const temInstalador = !versao || versao.instalador !== undefined

  return (
    <>
      <section className="heroi">
        <span className="sobrancelha">Client oficial do Vethara</span>
        <h1>Baixar e jogar</h1>
        <p className="guia">
          Um fork do OTClient, já configurado para o nosso servidor. Windows 64 bits.
        </p>
        <div className="acoes">
          {temInstalador ? (
            <a className="botao" href={INSTALADOR}>
              Baixar{versao?.instalador ? ` · ${megabytes(versao.instalador.tamanho)} MB` : ''}
            </a>
          ) : (
            <a className="botao" href={ZIP}>
              Baixar{versao ? ` · ${megabytes(versao.tamanho)} MB` : ''}
            </a>
          )}
          <Link className="botao vazado" to="/criar-conta">Criar conta</Link>
        </div>
        {versao && (
          <p style={{ color: 'var(--pergaminho-3)', fontSize: '0.88rem', marginTop: '1.25rem', marginBottom: 0 }}>
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
        <div className="secao-topo"><h2>Na primeira vez que abrir</h2></div>
        <div className="painel">
          <p className="guia" style={{ marginBottom: 0 }}>
            O client baixa os arquivos gráficos antes de entrar no jogo — são algumas
            centenas de megabytes, e acontece uma vez só. Eles não vêm no instalador
            porque são arquivos da CipSoft, que não podemos redistribuir. Depois disso,
            o client se atualiza sozinho ao abrir: compara cada arquivo com o servidor
            e baixa apenas o que mudou.
          </p>
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
              <div className="rolagem" style={{ padding: '0.75rem', background: 'var(--pedra)' }}>
                <code style={{ fontSize: '0.82rem', color: 'var(--pergaminho-2)' }}>
                  {(versao.instalador ?? versao).sha256}
                </code>
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

      <section className="secao">
        <div className="secao-topo"><h2>Prefere o pacote solto?</h2></div>
        <div className="painel">
          <p className="guia">
            O mesmo client em zip, para quem quer escolher a pasta ou já tem uma
            instalação. Descompacte a pasta inteira antes de abrir — rodar o executável
            de dentro do zip não funciona, porque ele precisa dos arquivos ao lado.
          </p>
          <div className="acoes">
            <a className="botao p vazado" href={ZIP}>
              Baixar o zip{versao ? ` · ${megabytes(versao.tamanho)} MB` : ''}
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
