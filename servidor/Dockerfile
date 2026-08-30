# Imagem do servidor com as taxas do Vethara.
#
# As taxas entram aqui, e nao por docker exec no container, porque o config.lua
# fica DENTRO da imagem do Canary — o Dockerfile deles faz
# `COPY config.lua.dist /canary/config.lua`, e o volume /data so guarda o dump do
# banco. Editar o arquivo com o servidor rodando funciona ate o proximo deploy
# recriar o container a partir da imagem: a alteracao some sem aviso nenhum.
#
# O digest do Canary fica fixado aqui em vez de no compose. Para atualizar o
# servidor de proposito, troque o sha256 abaixo.
FROM ghcr.io/opentibiabr/canary@sha256:b64263764d88decfc0b345cb618371d14e044897c2c6ec53618b3fed6f552762

# rateSpawn 3 divide o tempo de respawn por 3: os 58.598 spawns de 90s do mapa
# global passam a 30s, e os 24.228 de 60s vao a 20s.
#
# rateExp 15 e a experiencia final, nao um bonus sobre os stages: com
# rateUseStages = false o Canary usa rateExp direto e ignora o data/stages.lua
# (data/libs/functions/player.lua:338). O padrao do Canary e 1, entao isto e 15x.
#
# freePremium liga o multiplicador de stamina. Ele so vale para conta premium com
# stamina acima de 2340 minutos (data/libs/functions/player.lua:353); sem premium
# o client mostra "Stamina multiplier: x1.0" e um terco da experiencia se perde.
# A conta final e exp * (1 + bonus) * stamina * rateExp, entao o x1.5 multiplica
# tudo: 15 * 1,5 (nivel baixo) * 1,5 (stamina) = 33,75x.
#
# basespeed 220 dobra a velocidade base das vocacoes. A velocidade final e
# basespeed + (level - 1), entao o ganho e de +110 em qualquer nivel: no level 1
# e o dobro exato, no level 100 fica ~1,5x. Dobrar em todos os niveis exigiria
# script Lua recalculando a cada level up.
RUN sed -i -e 's/^rateSpawn = .*/rateSpawn = 3/' \
           -e 's/^rateExp = .*/rateExp = 15/' \
           -e 's/^freePremium = .*/freePremium = true/' \
           /canary/config.lua \
 && sed -i 's/basespeed="110"/basespeed="220"/g' \
           /canary/data/XML/vocations.xml \
 && grep -qx 'rateSpawn = 3' /canary/config.lua \
 && grep -qx 'rateExp = 15' /canary/config.lua \
 && grep -qx 'freePremium = true' /canary/config.lua \
 && ! grep -q 'basespeed="110"' /canary/data/XML/vocations.xml \
 && echo "taxas do Vethara aplicadas"
