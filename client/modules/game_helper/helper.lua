-- Assistente do Vethara.
--
-- Equivalente ao helper oficial do Rubinot: uma tela fechada com cura por magia,
-- cura por item, runa no alvo, treino de mana e utilidades. Nao e um bot de
-- scripts — nao anda, nao procura alvo, nao coleta. So automatiza o que o jogador
-- faria apertando teclas, e a runa de ataque so dispara contra o alvo que ele
-- mesmo escolheu.
--
-- O intervalo minimo entre acoes existe por um motivo concreto: magia e enviada
-- como fala, e o servidor corta com maxMessageBuffer = 4. Sem o limite, o
-- assistente muta o proprio jogador.
--
-- A tela e toda estatica no helper.otui, e este arquivo so amarra os widgets por
-- id. A versao anterior criava as linhas em tempo de execucao dentro de um painel
-- com fit-children, e aquilo travava o client inteiro num laco de layout: a
-- ancora fixava a altura e o fit-children mandava ajustar ao conteudo.

local janela = nil
local botaoTopo = nil
local tique = nil
local pegadorMouse = nil
local slotEscolhendo = nil

local INTERVALO_TIQUE = 200 -- ms entre verificacoes
local ESPERA_MAGIA = 1000 -- ms minimo entre falas, por causa do maxMessageBuffer
local ESPERA_ITEM = 1000
local ESPERA_COMIDA = 60000

-- Aparece no rodape da janela. Serve para saber qual build o jogador tem quando
-- ele reporta alguma coisa, e para conferir de relance se a atualizacao chegou.
local VERSAO = '1.0'

local ARQUIVO_EXPORTADO = '/assistente.json'

local ultimaMagia = 0
local ultimoItem = 0
local ultimaComida = 0
local reconectando = false

-- Tentadas em ordem: o servidor ignora id que o jogador nao tem, entao a primeira
-- que ele carregar e a que vai ser comida.
local COMIDAS = { 3582, 3577, 3607, 3601, 3585, 3606 }

local config = {
    magias = {
        { ativo = false, texto = 'exura', porcento = 80 },
        { ativo = false, texto = 'exura gran', porcento = 60 },
        { ativo = false, texto = 'exura vita', porcento = 40 }
    },
    -- Usados em si mesmo: pocao de vida, pocao de mana, runa de cura.
    itens = {
        { ativo = false, id = 0, porcento = 70 },
        { ativo = false, id = 0, porcento = 50 },
        { ativo = false, id = 0, porcento = 30 }
    },
    -- Usadas no alvo que o jogador esta atacando.
    runas = {
        { ativo = false, id = 0, porcento = 100 },
        { ativo = false, id = 0, porcento = 100 }
    },
    mana = { ativo = false, texto = 'utevo lux', porcento = 90 },
    haste = { ativo = false, texto = 'utani hur' },
    comida = { ativo = false },
    reconectar = { ativo = false }
}

local function agora()
    return g_clock.millis()
end

local function jogador()
    local p = g_game.getLocalPlayer()
    if not p or g_game.isDead() or p:isDead() then
        return nil
    end
    return p
end

local function porcentoVida(p)
    local max = p:getMaxHealth()
    if max <= 0 then
        return 100
    end
    return (p:getHealth() * 100) / max
end

local function porcentoMana(p)
    local max = p:getMaxMana()
    if max <= 0 then
        return 100
    end
    return (p:getMana() * 100) / max
end

local function castar(texto)
    if not texto or texto == '' then
        return false
    end
    if agora() - ultimaMagia < ESPERA_MAGIA then
        return false
    end
    ultimaMagia = agora()
    g_game.talk(texto)
    return true
end

local function usarItem(itemId, alvo)
    if not itemId or itemId <= 0 or not alvo then
        return false
    end
    if agora() - ultimoItem < ESPERA_ITEM then
        return false
    end
    ultimoItem = agora()
    g_game.useInventoryItemWith(itemId, alvo)
    return true
end

-- Uma acao por tique, na ordem de urgencia: curar antes de atacar, atacar antes
-- de treinar mana, treinar antes de correr. Duas acoes no mesmo tique so
-- serviriam para gastar o limite de fala mais rapido.
local function verificar()
    local p = jogador()
    if not p then
        return
    end

    local vida = porcentoVida(p)

    for _, m in ipairs(config.magias) do
        if m.ativo and vida <= m.porcento then
            if castar(m.texto) then
                return
            end
        end
    end

    for _, i in ipairs(config.itens) do
        if i.ativo and i.id > 0 and vida <= i.porcento then
            if usarItem(i.id, p) then
                return
            end
        end
    end

    -- Runa de ataque so existe se o jogador ja escolheu um alvo. O assistente
    -- nao procura alvo nenhum.
    local alvo = g_game.getAttackingCreature()
    if alvo then
        local vidaAlvo = alvo:getHealthPercent()
        for _, r in ipairs(config.runas) do
            if r.ativo and r.id > 0 and vidaAlvo <= r.porcento then
                if usarItem(r.id, alvo) then
                    return
                end
            end
        end
    end

    if config.mana.ativo and porcentoMana(p) >= config.mana.porcento then
        if castar(config.mana.texto) then
            return
        end
    end

    if config.haste.ativo and not p:hasState(PlayerStates.Haste) then
        if castar(config.haste.texto) then
            return
        end
    end

    if config.comida.ativo and agora() - ultimaComida >= ESPERA_COMIDA then
        ultimaComida = agora()
        for _, id in ipairs(COMIDAS) do
            g_game.useInventoryItem(id)
        end
    end
end

local function quantosAtivos()
    local n = 0
    for _, m in ipairs(config.magias) do
        if m.ativo then n = n + 1 end
    end
    for _, i in ipairs(config.itens) do
        if i.ativo then n = n + 1 end
    end
    for _, r in ipairs(config.runas) do
        if r.ativo then n = n + 1 end
    end
    if config.mana.ativo then n = n + 1 end
    if config.haste.ativo then n = n + 1 end
    if config.comida.ativo then n = n + 1 end
    if config.reconectar.ativo then n = n + 1 end
    return n
end

local function atualizarCabecalho()
    if not janela then
        return
    end
    local p = g_game.getLocalPlayer()
    janela.personagem:setText(p and p:getName() or tr('Sem personagem'))

    local n = quantosAtivos()
    if n == 0 then
        janela.status:setText(tr('Status: nada ligado'))
        janela.status:setColor('#aaaaaa')
    else
        janela.status:setText(tr('Status: ativo') .. ' (' .. n .. ')')
        janela.status:setColor('#5fbf5f')
    end
end

local function salvar()
    g_settings.setNode('vethara_helper', config)
    g_settings.save()
    atualizarCabecalho()
end

-- Mesclagem campo a campo, e nao substituicao da tabela: um arquivo salvo por uma
-- versao anterior nao pode apagar opcoes novas nem derrubar o modulo por chave
-- faltando. Vale tanto para g_settings quanto para o arquivo importado.
local function mesclarLista(destino, origem)
    if type(origem) ~= 'table' then
        return
    end
    for i, d in ipairs(destino) do
        local s = origem[i]
        if type(s) == 'table' then
            d.ativo = s.ativo == true
            d.porcento = tonumber(s.porcento) or d.porcento
            if d.id ~= nil then
                d.id = tonumber(s.id) or d.id
            end
            if d.texto ~= nil then
                d.texto = s.texto or d.texto
            end
        end
    end
end

local function aplicar(salvo)
    if type(salvo) ~= 'table' then
        return
    end
    mesclarLista(config.magias, salvo.magias)
    mesclarLista(config.itens, salvo.itens)
    mesclarLista(config.runas, salvo.runas)
    if type(salvo.mana) == 'table' then
        config.mana.ativo = salvo.mana.ativo == true
        config.mana.texto = salvo.mana.texto or config.mana.texto
        config.mana.porcento = tonumber(salvo.mana.porcento) or config.mana.porcento
    end
    if type(salvo.haste) == 'table' then
        config.haste.ativo = salvo.haste.ativo == true
        config.haste.texto = salvo.haste.texto or config.haste.texto
    end
    if type(salvo.comida) == 'table' then
        config.comida.ativo = salvo.comida.ativo == true
    end
    if type(salvo.reconectar) == 'table' then
        config.reconectar.ativo = salvo.reconectar.ativo == true
    end
end

-- Seletor por clique, o mesmo mecanismo das hotkeys do client: pega o mouse e
-- resolve o item sob o cursor, seja no chao ou dentro de um container.
local function aoSoltarMouse(self, posicao, botao)
    local item = nil
    if botao == MouseLeftButton then
        local alvo = modules.game_interface.getRootPanel():recursiveGetChildByPos(posicao, false)
        if alvo then
            if alvo:getClassName() == 'UIGameMap' then
                local piso = alvo:getTile(posicao)
                if piso then
                    local coisa = piso:getTopMoveThing()
                    if coisa and coisa:isItem() then
                        item = coisa
                    end
                end
            elseif alvo:getClassName() == 'UIItem' and not alvo:isVirtual() then
                item = alvo:getItem()
            end
        end
    end

    if item and slotEscolhendo then
        slotEscolhendo.definir(item:getId())
    end
    slotEscolhendo = nil

    if modules.client_options and modules.client_options.getOption('nativeCursor') then
        g_window.restoreMouseCursor()
    else
        g_mouse.popCursor('target')
    end
    self:ungrabMouse()

    if janela then
        janela:show()
        janela:raise()
    end
    return true
end

local function escolherItem(definir)
    if g_ui.isMouseGrabbed() then
        return
    end
    slotEscolhendo = { definir = definir }
    if janela then
        janela:hide()
    end
    pegadorMouse:grabMouse()
    if modules.client_options and modules.client_options.getOption('nativeCursor') then
        g_window.setSystemCursor('cross')
    else
        g_mouse.pushCursor('target')
    end
end

-- Amarra uma linha do .otui a um pedaco da configuracao. Nenhum widget e criado
-- aqui: todos ja existem na tela, e isto so preenche e liga os eventos.
local function ligarLinha(linha, opcoes)
    linha.ativo:setChecked(opcoes.lerAtivo())
    linha.ativo.onCheckChange = function(_, marcado)
        opcoes.gravarAtivo(marcado)
        salvar()
    end

    if opcoes.lerTexto then
        linha.valor:setText(opcoes.lerTexto())
        linha.valor.onTextChange = function(_, t)
            opcoes.gravarTexto(t)
            salvar()
        end
    end

    if opcoes.lerItem then
        local function definir(id)
            opcoes.gravarItem(id or 0)
            if id and id > 0 then
                linha.item:setItemId(id)
            else
                linha.item:clearItem()
            end
            salvar()
        end

        local atual = opcoes.lerItem()
        if atual > 0 then
            linha.item:setItemId(atual)
        end

        -- Arrastar da mochila para o quadro.
        linha.item.onDrop = function(_, arrastado)
            local coisa = arrastado and arrastado.currentDragThing
            if coisa and coisa:isItem() then
                definir(coisa:getId())
                return true
            end
        end

        -- Botao direito limpa o quadro.
        linha.item.onMouseRelease = function(_, _, botao)
            if botao == MouseRightButton then
                definir(0)
                return true
            end
        end

        linha.escolher.onClick = function()
            escolherItem(definir)
        end
    end

    if opcoes.lerPorcento then
        linha.porcento:setMinimum(1)
        linha.porcento:setMaximum(100)
        linha.porcento:setValue(opcoes.lerPorcento())
        linha.porcento.onValueChange = function(_, v)
            opcoes.gravarPorcento(v)
            salvar()
        end
    end

    if opcoes.rotulo then
        linha.rotulo:setText(opcoes.rotulo)
    end
end

local function ligarTela()
    for i = 1, 3 do
        ligarLinha(janela['magia' .. i], {
            lerAtivo = function() return config.magias[i].ativo end,
            gravarAtivo = function(v) config.magias[i].ativo = v end,
            lerTexto = function() return config.magias[i].texto end,
            gravarTexto = function(t) config.magias[i].texto = t end,
            lerPorcento = function() return config.magias[i].porcento end,
            gravarPorcento = function(v) config.magias[i].porcento = v end
        })

        ligarLinha(janela['item' .. i], {
            lerAtivo = function() return config.itens[i].ativo end,
            gravarAtivo = function(v) config.itens[i].ativo = v end,
            lerItem = function() return config.itens[i].id end,
            gravarItem = function(v) config.itens[i].id = v end,
            lerPorcento = function() return config.itens[i].porcento end,
            gravarPorcento = function(v) config.itens[i].porcento = v end
        })
    end

    for i = 1, 2 do
        ligarLinha(janela['runa' .. i], {
            lerAtivo = function() return config.runas[i].ativo end,
            gravarAtivo = function(v) config.runas[i].ativo = v end,
            lerItem = function() return config.runas[i].id end,
            gravarItem = function(v) config.runas[i].id = v end,
            lerPorcento = function() return config.runas[i].porcento end,
            gravarPorcento = function(v) config.runas[i].porcento = v end
        })
    end

    ligarLinha(janela.mana, {
        lerAtivo = function() return config.mana.ativo end,
        gravarAtivo = function(v) config.mana.ativo = v end,
        lerTexto = function() return config.mana.texto end,
        gravarTexto = function(t) config.mana.texto = t end,
        lerPorcento = function() return config.mana.porcento end,
        gravarPorcento = function(v) config.mana.porcento = v end
    })

    ligarLinha(janela.haste, {
        lerAtivo = function() return config.haste.ativo end,
        gravarAtivo = function(v) config.haste.ativo = v end,
        lerTexto = function() return config.haste.texto end,
        gravarTexto = function(t) config.haste.texto = t end
    })

    ligarLinha(janela.comer, {
        rotulo = tr('Comer a cada 60 segundos'),
        lerAtivo = function() return config.comida.ativo end,
        gravarAtivo = function(v) config.comida.ativo = v end
    })

    ligarLinha(janela.reconectar, {
        rotulo = tr('Reconectar se a conexao cair'),
        lerAtivo = function() return config.reconectar.ativo end,
        gravarAtivo = function(v) config.reconectar.ativo = v end
    })
end

function exportar()
    local ok, texto = pcall(json.encode, config)
    if not ok then
        return
    end
    g_resources.writeFileContents(ARQUIVO_EXPORTADO, texto)
    modules.game_textmessage.displayStatusMessage(
        tr('Assistente exportado para') .. ' ' .. ARQUIVO_EXPORTADO)
end

function importar()
    if not g_resources.fileExists(ARQUIVO_EXPORTADO) then
        modules.game_textmessage.displayStatusMessage(
            tr('Nao encontrei') .. ' ' .. ARQUIVO_EXPORTADO)
        return
    end
    local ok, dados = pcall(function()
        return json.decode(g_resources.readFileContents(ARQUIVO_EXPORTADO))
    end)
    if not ok or type(dados) ~= 'table' then
        modules.game_textmessage.displayStatusMessage(tr('Arquivo invalido'))
        return
    end
    aplicar(dados)
    ligarTela()
    salvar()
    modules.game_textmessage.displayStatusMessage(tr('Assistente importado'))
end

function toggle()
    if not janela then
        return
    end
    if janela:isVisible() then
        janela:hide()
        if botaoTopo then
            botaoTopo:setOn(false)
        end
    else
        atualizarCabecalho()
        janela:show()
        janela:raise()
        janela:focus()
        if botaoTopo then
            botaoTopo:setOn(true)
        end
    end
end

function onGameStart()
    reconectando = false
    ultimaComida = agora()
    atualizarCabecalho()
    if not tique then
        tique = cycleEvent(verificar, INTERVALO_TIQUE)
    end
end

function onGameEnd()
    if tique then
        removeEvent(tique)
        tique = nil
    end
    atualizarCabecalho()
    -- Reconexao com atraso e uma so tentativa por queda. Reconectar em laco
    -- transformaria um kick por regra numa enxurrada de logins.
    if config.reconectar.ativo and not reconectando then
        reconectando = true
        scheduleEvent(function()
            if not g_game.isOnline() then
                modules.client_entergame.EnterGame.doLogin()
            end
        end, 3000)
    end
end

function init()
    janela = g_ui.displayUI('helper')
    janela:hide()

    pegadorMouse = g_ui.createWidget('UIWidget')
    pegadorMouse:setVisible(false)
    pegadorMouse:setFocusable(false)
    pegadorMouse.onMouseRelease = aoSoltarMouse

    janela.versao:setText(tr('Assistente') .. ' ' .. VERSAO)
    aplicar(g_settings.getNode('vethara_helper'))
    ligarTela()
    atualizarCabecalho()

    -- Mesma barra e mesmo icone do bot antigo, que foi desligado no mods.otmod.
    -- O ultimo argumento e o indice que o game_bot usava, para o botao cair no
    -- mesmo lugar da barra.
    botaoTopo = modules.game_mainpanel.addToggleButton('botButton', tr('Assistente'),
        '/images/options/bot', toggle, false, 99999)
    botaoTopo:setOn(false)
    botaoTopo:show()

    connect(g_game, {
        onGameStart = onGameStart,
        onGameEnd = onGameEnd
    })

    if g_game.isOnline() then
        onGameStart()
    end
end

function terminate()
    disconnect(g_game, {
        onGameStart = onGameStart,
        onGameEnd = onGameEnd
    })

    if tique then
        removeEvent(tique)
        tique = nil
    end
    if pegadorMouse then
        pegadorMouse:destroy()
        pegadorMouse = nil
    end
    if botaoTopo then
        botaoTopo:destroy()
        botaoTopo = nil
    end
    if janela then
        janela:destroy()
        janela = nil
    end
end
