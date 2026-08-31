# Imagem do servidor com os ajustes do Vethara.
#
# Eles entram aqui, e nao por docker exec no container, porque o config.lua fica
# DENTRO da imagem do Canary — o Dockerfile deles faz
# `COPY config.lua.dist /canary/config.lua`, e o volume /data so guarda o dump do
# banco. Editar o arquivo com o servidor rodando funciona ate o proximo deploy
# recriar o container a partir da imagem: a alteracao some sem aviso nenhum.
#
# O digest do Canary fica fixado aqui em vez de no compose. Para atualizar o
# servidor de proposito, troque o sha256 abaixo.
FROM ghcr.io/opentibiabr/canary@sha256:b64263764d88decfc0b345cb618371d14e044897c2c6ec53618b3fed6f552762

# rateSpawn 2 divide o tempo de respawn por 2: os 58.598 spawns de 90s do mapa
# global passam a 45s, e os 24.228 de 60s vao a 30s. Estava em 3, e a populacao
# viva que isso sustenta esgotou a memoria do VPS depois de sete horas.
#
# rateExp 50 e a experiencia final, nao um bonus sobre os stages: com
# rateUseStages = false o Canary usa rateExp direto e ignora o data/stages.lua
# (data/libs/functions/player.lua:338). O padrao do Canary e 1.
#
# freePremium liga o multiplicador de stamina. Ele so vale para conta premium com
# stamina acima de 2340 minutos (data/libs/functions/player.lua:353); sem premium
# o client mostra "Stamina multiplier: x1.0" e um terco da experiencia se perde.
# A conta final e exp * (1 + bonus) * stamina * rateExp, entao o x1.5 multiplica
# tudo: 50 * 1,5 (nivel baixo) * 1,5 (stamina) = 112,5x.
#
# toggleLearnSpells false libera as magias por level em vez de por compra. Com
# ele em true, o Canary exige que TODA magia instantanea tenha sido aprendida de
# um NPC (spells.cpp:562). Os requisitos continuam de pe: level, magic level,
# vocacao e mana sao checados antes e em separado (spells.cpp:539).
#
# O sed nos scripts alcanca as 18 magias que se declaram needLearn(true) uma a
# uma, fora do alcance da chave de config: avatares, great death beam,
# executioners throw, os bursts. A Wheel of Destiny concede essas magias com
# learnInstantSpell e as retira em resetUpgradedSpells (player_wheel.cpp:3437);
# com needLearn false isso deixa de controlar se da para castar, mas a wheel
# segue controlando o GRAU. Quem nao investiu nela casta no grau minimo.
#
# O caminho e data/scripts/spells de proposito: as 590 ocorrencias em
# data-otservbr-global/scripts/spells/monster sao magias de monstro e nao tem
# nada a ver com o que o jogador pode castar.
#
# basespeed 220 dobra a velocidade base das vocacoes. A velocidade final e
# basespeed + (level - 1), entao o ganho e de +110 em qualquer nivel: no level 1
# e o dobro exato, no level 100 fica ~1,5x. Dobrar em todos os niveis exigiria
# script Lua recalculando a cada level up.
RUN sed -i -e 's/^rateSpawn = .*/rateSpawn = 2/' \
           -e 's/^rateExp = .*/rateExp = 50/' \
           -e 's/^freePremium = .*/freePremium = true/' \
           -e 's/^toggleLearnSpells = .*/toggleLearnSpells = false/' \
           /canary/config.lua \
 && sed -i 's/basespeed="110"/basespeed="220"/g' \
           /canary/data/XML/vocations.xml \
 && find /canary/data/scripts/spells -name '*.lua' \
      -exec sed -i 's/needLearn(true)/needLearn(false)/g' {} + \
 && grep -qx 'rateSpawn = 2' /canary/config.lua \
 && grep -qx 'rateExp = 50' /canary/config.lua \
 && grep -qx 'freePremium = true' /canary/config.lua \
 && grep -qx 'toggleLearnSpells = false' /canary/config.lua \
 && ! grep -q 'basespeed="110"' /canary/data/XML/vocations.xml \
 && ! grep -rq 'needLearn(true)' /canary/data/scripts/spells \
 && echo "ajustes do Vethara aplicados"

# Avisa o client de que a conta pode usar o menu de GM. O client nao tem como
# saber o grupo sozinho — nada no protocolo conta isso —, entao o servidor manda
# um extended opcode no login. Scripts em data/scripts sao carregados sozinhos.
#
# E conveniencia de interface, nao seguranca: o menu apenas digita /i, e o /i so
# funciona para o grupo god.
COPY scripts/menu_gm.lua /canary/data/scripts/creaturescripts/player/menu_gm.lua
