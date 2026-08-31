-- Assistente do Vethara.
--
-- Equivalente ao helper oficial do Rubinot: uma tela fechada com cura por magia,
-- cura por pocao, treino de mana e utilidades. Nao e um bot de scripts — nao anda,
-- nao ataca, nao coleta. So automatiza o que o jogador faria apertando teclas.
--
-- O intervalo minimo entre magias existe por um motivo concreto: magia e enviada
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

local INTERVALO_TIQUE = 200 -- ms entre verificacoes
local ESPERA_MAGIA = 1000 -- ms minimo entre falas, por causa do maxMessageBuffer
local ESPERA_POCAO = 1000
local ESPERA_COMIDA = 60000

local ARQUIVO_EXPORTADO = '/assistente.json'

local ultimaMagia = 0
local ultimaPocao = 0
local ultimaComida = 0
local reconectando = false

local POCOES = {
    { nome = 'Health Potion', id = 266 },
    { nome = 'Strong Health Potion', id = 236 },
    { nome = 'Great Health Potion', id = 239 },
    { nome = 'Ultimate Health Potion', id = 7643 },
    { nome = 'Supreme Health Potion', id = 23375 },
    { nome = 'Mana Potion', id = 268 },
    { nome = 'Strong Mana Potion', id = 237 },
    { nome = 'Great Mana Potion', id = 238 },
    { nome = 'Ultimate Mana Potion', id = 23373 },
    { nome = 'Great Spirit Potion', id = 7642 },
    { nome = 'Ultimate Spirit Potion', id = 23374 }
}

-- Tentadas em ordem: o servidor ignora id que o jogador nao tem, entao a primeira
-- que ele carregar e a que vai ser comida.
local COMIDAS = { 3582, 3577, 3607, 3601, 3585, 3606 }

local config = {
    magias = {
        { ativo = false, texto = 'exura', porcento = 80 },
        { ativo = false, texto = 'exura gran', porcento = 60 },
        { ativo = false, texto = 'exura vita', porcento = 40 }
    },
    pocoes = {
        { ativo = false, id = 266, porcento = 70 },
        { ativo = false, id = 236, porcento = 50 },
        { ativo = false, id = 268, porcento = 30 }
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

local function beber(itemId)
    if not itemId or itemId <= 0 then
        return false
    end
    if agora() - ultimaPocao < ESPERA_POCAO then
        return false
    end
    ultimaPocao = agora()
    g_game.useInventoryItemWith(itemId, g_game.getLocalPlayer())
    return true
end

-- Uma acao por tique, na ordem de urgencia: curar antes de treinar, treinar antes
-- de correr. Duas acoes no mesmo tique so serviriam para gastar o limite de fala.
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

    for _, q in ipairs(config.pocoes) do
        if q.ativo and vida <= q.porcento then
            if beber(q.id) then
                return
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
    for _, q in ipairs(config.pocoes) do
        if q.ativo then n = n + 1 end
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
local function aplicar(salvo)
    if type(salvo) ~= 'table' then
        return
    end
    for i, m in ipairs(config.magias) do
        local s = salvo.magias and salvo.magias[i]
        if type(s) == 'table' then
            m.ativo = s.ativo == true
            m.texto = s.texto or m.texto
            m.porcento = tonumber(s.porcento) or m.porcento
        end
    end
    for i, q in ipairs(config.pocoes) do
        local s = salvo.pocoes and salvo.pocoes[i]
        if type(s) == 'table' then
            q.ativo = s.ativo == true
            q.id = tonumber(s.id) or q.id
            q.porcento = tonumber(s.porcento) or q.porcento
        end
    end
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

    if opcoes.lerPocao then
        for _, p in ipairs(POCOES) do
            linha.opcao:addOption(p.nome, p.id)
        end
        local atual = opcoes.lerPocao()
        for _, p in ipairs(POCOES) do
            if p.id == atual then
                linha.opcao:setCurrentOption(p.nome)
                break
            end
        end
        linha.opcao.onOptionChange = function(_, _, dados)
            opcoes.gravarPocao(tonumber(dados) or 0)
            salvar()
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

        ligarLinha(janela['pocao' .. i], {
            lerAtivo = function() return config.pocoes[i].ativo end,
            gravarAtivo = function(v) config.pocoes[i].ativo = v end,
            lerPocao = function() return config.pocoes[i].id end,
            gravarPocao = function(v) config.pocoes[i].id = v end,
            lerPorcento = function() return config.pocoes[i].porcento end,
            gravarPorcento = function(v) config.pocoes[i].porcento = v end
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

    aplicar(g_settings.getNode('vethara_helper'))
    ligarTela()
    atualizarCabecalho()

    botaoTopo = modules.client_topmenu.addRightGameToggleButton('helperButton', tr('Assistente'),
        '/images/topbuttons/bot', toggle)

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
    if botaoTopo then
        botaoTopo:destroy()
        botaoTopo = nil
    end
    if janela then
        janela:destroy()
        janela = nil
    end
end
