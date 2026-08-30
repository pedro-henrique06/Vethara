-- Assistente do Vethara.
--
-- Equivalente ao helper oficial do Rubinot: uma tela fechada com cura por magia,
-- cura por pocao, treino de mana e utilidades. Nao e um bot de scripts — nao anda,
-- nao ataca, nao coleta. So automatiza o que o jogador faria apertando teclas.
--
-- O intervalo minimo entre magias existe por um motivo concreto: magia e enviada
-- como fala, e o servidor corta com maxMessageBuffer = 4. Sem o limite, o
-- assistente muta o proprio jogador.

local janela = nil
local botaoTopo = nil
local tique = nil

local INTERVALO_TIQUE = 200 -- ms entre verificacoes
local ESPERA_MAGIA = 1000 -- ms minimo entre falas, por causa do maxMessageBuffer
local ESPERA_POCAO = 1000
local ESPERA_COMIDA = 60000

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

local function salvar()
    g_settings.setNode('vethara_helper', config)
    g_settings.save()
end

local function carregar()
    local salvo = g_settings.getNode('vethara_helper')
    if not salvo then
        return
    end
    -- Mesclagem campo a campo: um arquivo salvo por uma versao anterior nao pode
    -- apagar opcoes novas nem derrubar o modulo por chave faltando.
    for i, m in ipairs(config.magias) do
        local s = salvo.magias and salvo.magias[i]
        if s then
            m.ativo = s.ativo == true
            m.texto = s.texto or m.texto
            m.porcento = tonumber(s.porcento) or m.porcento
        end
    end
    for i, q in ipairs(config.pocoes) do
        local s = salvo.pocoes and salvo.pocoes[i]
        if s then
            q.ativo = s.ativo == true
            q.id = tonumber(s.id) or q.id
            q.porcento = tonumber(s.porcento) or q.porcento
        end
    end
    if salvo.mana then
        config.mana.ativo = salvo.mana.ativo == true
        config.mana.texto = salvo.mana.texto or config.mana.texto
        config.mana.porcento = tonumber(salvo.mana.porcento) or config.mana.porcento
    end
    if salvo.haste then
        config.haste.ativo = salvo.haste.ativo == true
        config.haste.texto = salvo.haste.texto or config.haste.texto
    end
    if salvo.comida then
        config.comida.ativo = salvo.comida.ativo == true
    end
    if salvo.reconectar then
        config.reconectar.ativo = salvo.reconectar.ativo == true
    end
end

local function secao(texto)
    local w = g_ui.createWidget('HelperSection', janela.conteudo)
    w:setText(texto)
    return w
end

local function linha(opcoes)
    local w = g_ui.createWidget('HelperRow', janela.conteudo)
    w.rotulo:setText(opcoes.rotulo)
    w.sufixo:setText(opcoes.sufixo or '')
    w.ativo:setChecked(opcoes.ativo == true)
    w.ativo.onCheckChange = function(_, marcado)
        opcoes.aoMarcar(marcado)
        salvar()
    end

    if opcoes.texto ~= nil then
        w.valor:setText(opcoes.texto)
        w.valor.onTextChange = function(_, t)
            opcoes.aoTexto(t)
            salvar()
        end
    else
        w.valor:hide()
    end

    if opcoes.pocao ~= nil then
        w.valor:hide()
        w.opcao:show()
        for _, p in ipairs(POCOES) do
            w.opcao:addOption(p.nome, p.id)
        end
        for _, p in ipairs(POCOES) do
            if p.id == opcoes.pocao then
                w.opcao:setCurrentOption(p.nome)
                break
            end
        end
        w.opcao.onOptionChange = function(combo, texto, dados)
            opcoes.aoPocao(tonumber(dados) or 0)
            salvar()
        end
    end

    if opcoes.porcento ~= nil then
        w.porcento:setMinimum(1)
        w.porcento:setMaximum(100)
        w.porcento:setValue(opcoes.porcento)
        w.porcento.onValueChange = function(_, v)
            opcoes.aoPorcento(v)
            salvar()
        end
    else
        w.porcento:hide()
    end

    return w
end

local function montar()
    secao(tr('Cura por magia'))
    for i, m in ipairs(config.magias) do
        linha({
            rotulo = tr('Magia'),
            sufixo = '% ' .. tr('de vida ou menos'),
            ativo = m.ativo,
            texto = m.texto,
            porcento = m.porcento,
            aoMarcar = function(v) config.magias[i].ativo = v end,
            aoTexto = function(t) config.magias[i].texto = t end,
            aoPorcento = function(v) config.magias[i].porcento = v end
        })
    end

    secao(tr('Cura por pocao'))
    for i, q in ipairs(config.pocoes) do
        linha({
            rotulo = tr('Pocao'),
            sufixo = '% ' .. tr('de vida ou menos'),
            ativo = q.ativo,
            pocao = q.id,
            porcento = q.porcento,
            aoMarcar = function(v) config.pocoes[i].ativo = v end,
            aoPocao = function(v) config.pocoes[i].id = v end,
            aoPorcento = function(v) config.pocoes[i].porcento = v end
        })
    end

    secao(tr('Treino de mana'))
    linha({
        rotulo = tr('Magia'),
        sufixo = '% ' .. tr('de mana ou mais'),
        ativo = config.mana.ativo,
        texto = config.mana.texto,
        porcento = config.mana.porcento,
        aoMarcar = function(v) config.mana.ativo = v end,
        aoTexto = function(t) config.mana.texto = t end,
        aoPorcento = function(v) config.mana.porcento = v end
    })

    secao(tr('Utilidades'))
    linha({
        rotulo = tr('Haste'),
        sufixo = tr('quando estiver sem'),
        ativo = config.haste.ativo,
        texto = config.haste.texto,
        aoMarcar = function(v) config.haste.ativo = v end,
        aoTexto = function(t) config.haste.texto = t end
    })
    linha({
        rotulo = tr('Comer'),
        sufixo = tr('a cada 60 segundos'),
        ativo = config.comida.ativo,
        aoMarcar = function(v) config.comida.ativo = v end
    })
    linha({
        rotulo = tr('Reconectar'),
        sufixo = tr('se a conexao cair'),
        ativo = config.reconectar.ativo,
        aoMarcar = function(v) config.reconectar.ativo = v end
    })
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
    if not tique then
        tique = cycleEvent(verificar, INTERVALO_TIQUE)
    end
end

function onGameEnd()
    if tique then
        removeEvent(tique)
        tique = nil
    end
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

    carregar()
    montar()

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
