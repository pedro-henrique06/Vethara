// Extrai o bestiario do datapack do Canary para um JSON que o site le.
//
//   git clone --filter=blob:none --no-checkout https://github.com/opentibiabr/canary.git
//   cd canary && git sparse-checkout set --cone data-otservbr-global/monster && git checkout
//   node dev/gerar-monstros.mjs /caminho/do/canary
//
// Escreve web/public/monstros.json. O arquivo e versionado de proposito: a
// alternativa seria a API ler os .lua em runtime, e o container da API nao tem o
// datapack — ele vive dentro da imagem do servidor. Gerar uma vez e commitar
// deixa a pagina servida como arquivo estatico, sem tocar no banco nem no jogo.
//
// O parser e de regex e nao um interpretador de Lua. Da certo porque estes
// arquivos sao gerados por ferramenta e seguem sempre a mesma forma; qualquer
// monstro que fuja dela e contado e reportado no fim, em vez de sair calado.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const canary = process.argv[2]
if (!canary) {
  console.error('uso: node dev/gerar-monstros.mjs /caminho/do/clone/do/canary')
  process.exit(1)
}

const base = join(canary, 'data-otservbr-global', 'monster')

function arquivos(dir) {
  const saida = []
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada)
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho))
    else if (entrada.endsWith('.lua')) saida.push(caminho)
  }
  return saida
}

// Lua junta linhas com \z: a barra come o proprio \z e todo o espaco em branco
// que vier depois. Sem desfazer isso, as descricoes de local saem com tabs no
// meio da frase.
const emendar = (s) => s.replace(/\\z\s*/g, '').replace(/\s+/g, ' ').trim()

const numero = (texto, chave) => {
  const m = texto.match(new RegExp(`\\b${chave}\\s*=\\s*(-?[\\d.]+)`))
  return m ? Number(m[1]) : null
}

const cadeia = (texto, chave) => {
  const m = texto.match(new RegExp(`\\b${chave}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`))
  return m ? emendar(m[1]) : null
}

// Recorta um bloco `monster.<campo> = { ... }` contando chaves, porque os blocos
// tem tabelas aninhadas e um match preguicoso pararia na primeira `}`.
function bloco(texto, campo) {
  const inicio = texto.indexOf(`monster.${campo} = {`)
  if (inicio === -1) return null
  let i = texto.indexOf('{', inicio)
  let nivel = 0
  for (let j = i; j < texto.length; j++) {
    if (texto[j] === '{') nivel++
    else if (texto[j] === '}' && --nivel === 0) return texto.slice(i + 1, j)
  }
  return null
}

const ELEMENTOS = {
  COMBAT_PHYSICALDAMAGE: 'fisico',
  COMBAT_ENERGYDAMAGE: 'energia',
  COMBAT_EARTHDAMAGE: 'terra',
  COMBAT_FIREDAMAGE: 'fogo',
  COMBAT_LIFEDRAIN: 'vida',
  COMBAT_MANADRAIN: 'mana',
  COMBAT_DROWNDAMAGE: 'afogamento',
  COMBAT_ICEDAMAGE: 'gelo',
  COMBAT_HOLYDAMAGE: 'sagrado',
  COMBAT_DEATHDAMAGE: 'morte',
}

const CLASSES = {
  Amphibic: 'Anfíbio',
  Aquatic: 'Aquático',
  Bird: 'Ave',
  Construct: 'Constructo',
  Demon: 'Demônio',
  Dragon: 'Dragão',
  Elemental: 'Elemental',
  'Extra Dimensional': 'Extradimensional',
  Fey: 'Feérico',
  Giant: 'Gigante',
  Human: 'Humano',
  Humanoid: 'Humanoide',
  Lycanthrope: 'Licantropo',
  Magical: 'Mágico',
  Mammal: 'Mamífero',
  Plant: 'Planta',
  Reptile: 'Réptil',
  Slime: 'Gosma',
  Undead: 'Morto-vivo',
  Vermin: 'Verme',
}

function ler(caminho) {
  const texto = readFileSync(caminho, 'utf8')
  const pasta = caminho.slice(base.length + 1)

  const nome = cadeia(texto, 'createMonsterType\\(')
    ?? texto.match(/createMonsterType\("((?:[^"\\]|\\.)*)"\)/)?.[1]
  if (!nome) return null

  const vida = numero(texto, 'monster\\.maxHealth') ?? numero(texto, 'monster\\.health')
  const experiencia = numero(texto, 'monster\\.experience')
  if (vida === null || experiencia === null) return null

  const bestiario = bloco(texto, 'Bestiary')
  const defesas = bloco(texto, 'defenses')

  // Elementos: guardamos so o que foge de zero. Zero e "dano normal", e repetir
  // dez zeros por monstro dobraria o tamanho do arquivo sem dizer nada.
  const elementos = {}
  for (const bl of (bloco(texto, 'elements') ?? '').split('\n')) {
    const m = bl.match(/type\s*=\s*(COMBAT_\w+)\s*,\s*percent\s*=\s*(-?\d+)/)
    if (m && Number(m[2]) !== 0 && ELEMENTOS[m[1]]) elementos[ELEMENTOS[m[1]]] = Number(m[2])
  }

  const imunidades = [...(bloco(texto, 'immunities') ?? '').matchAll(
    /type\s*=\s*"(\w+)"\s*,\s*condition\s*=\s*true/g
  )].map((m) => m[1])

  // Loot por id traz o nome no comentario ao lado — e a unica fonte de nome
  // legivel para esses itens sem carregar o items.xml inteiro.
  const loot = []
  for (const linha of (bloco(texto, 'loot') ?? '').split('\n')) {
    if (!linha.includes('chance')) continue
    const nomeItem = linha.match(/name\s*=\s*"([^"]+)"/)?.[1]
      ?? linha.match(/--\s*(.+?)\s*$/)?.[1]
    if (!nomeItem) continue
    const chance = Number(linha.match(/chance\s*=\s*(\d+)/)?.[1] ?? 0)
    const maximo = Number(linha.match(/maxCount\s*=\s*(\d+)/)?.[1] ?? 1)
    loot.push({ item: nomeItem, chance, ...(maximo > 1 ? { maximo } : {}) })
  }

  const classe = bestiario ? cadeia(bestiario, 'class') : null

  // Armadilhas e cenario (pilares de fogo, "a carved stone tile", bonecos de
  // treino) sao monstros para a engine, mas nao sao criaturas para o jogador:
  // nao dao experiencia e nao entram no bestiario. Ficam de fora da lista.
  if (experiencia === 0 && !classe) return null

  return {
    nome,
    vida,
    experiencia,
    velocidade: numero(texto, 'monster\\.speed'),
    ...(classe ? { classe: CLASSES[classe] ?? classe } : {}),
    // A pasta e a unica fonte disso: nada dentro do arquivo diz que o monstro e
    // um chefe. Vale a pena porque e o primeiro filtro que alguem procura.
    ...(pasta.includes('bosses/') ? { chefe: true } : {}),
    ...(bestiario
      ? {
          estrelas: numero(bestiario, 'Stars'),
          cargas: numero(bestiario, 'CharmsPoints'),
          matarPara: numero(bestiario, 'toKill'),
          locais: cadeia(bestiario, 'Locations'),
        }
      : {}),
    armadura: defesas ? numero(defesas, 'armor') : null,
    ...(Object.keys(elementos).length ? { elementos } : {}),
    ...(imunidades.length ? { imunidades } : {}),
    // Loot ordenado do mais provavel para o menos: e a ordem em que o jogador
    // pensa ("o que costuma cair"), nao a ordem do arquivo.
    ...(loot.length ? { loot: loot.sort((a, b) => b.chance - a.chance) } : {}),
  }
}

const todos = arquivos(base)
const monstros = []
const ignorados = []

for (const caminho of todos) {
  try {
    const m = ler(caminho)
    if (m) monstros.push(m)
    else ignorados.push(caminho.slice(base.length + 1))
  } catch (e) {
    ignorados.push(`${caminho.slice(base.length + 1)}: ${e.message}`)
  }
}

monstros.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

const commit = execFileSync('git', ['-C', canary, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

const cabecalho = {
  origem: 'opentibiabr/canary, data-otservbr-global/monster',
  commit,
  gerado: new Date().toISOString().slice(0, 10),
}

// Dois arquivos, e nao um: o loot e as descricoes de local respondem por 85% do
// peso e so interessam a um monstro por vez. Junto, o arquivo tem 183 kB
// comprimidos e todo mundo que abre a lista paga por eles; separado, a lista
// custa 26 kB e o resto so chega quando alguem abre a primeira ficha.
const INDICE = ['nome', 'vida', 'experiencia', 'velocidade', 'armadura', 'classe', 'estrelas', 'chefe']

const indice = monstros.map((m) => Object.fromEntries(
  INDICE.filter((k) => m[k] !== null && m[k] !== undefined).map((k) => [k, m[k]])
))

const detalhes = Object.fromEntries(monstros.map((m) => [
  m.nome,
  Object.fromEntries(Object.entries(m).filter(([k]) => !INDICE.includes(k))),
]))

const caminhoIndice = join(RAIZ, 'web', 'public', 'monstros.json')
const caminhoDetalhes = join(RAIZ, 'web', 'public', 'monstros-detalhes.json')
writeFileSync(caminhoIndice, JSON.stringify({ ...cabecalho, monstros: indice }) + '\n')
writeFileSync(caminhoDetalhes, JSON.stringify({ ...cabecalho, detalhes }) + '\n')

const comBestiario = monstros.filter((m) => m.classe).length
const chefes = monstros.filter((m) => m.chefe).length
console.log(`${monstros.length} monstros (${comBestiario} com bestiario, ${chefes} chefes) de ${todos.length} arquivos`)
console.log(`armadilhas, cenario e arquivos sem dados, fora da lista: ${ignorados.length}`)
if (ignorados.length) console.log('  ' + ignorados.slice(0, 10).join('\n  '))
console.log(`escrito em ${caminhoIndice}`)
console.log(`escrito em ${caminhoDetalhes}`)
