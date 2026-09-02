-- Menu de GM do Vethara: procurar um item pelo nome e cria-lo.
--
-- O botao so aparece para quem o servidor liberou. O client nao tem como saber
-- sozinho o grupo da conta — nada no protocolo conta isso —, entao o
-- servidor manda um extended opcode no login (servidor/scripts/menu_gm.lua).
--
-- Isto e conveniencia de interface, e nao seguranca: o menu apenas digita /i, e
-- o /i so funciona para o grupo god. Um jogador comum que forcasse o botao a
-- aparecer nao criaria nada.

local OPCODE_MENU_GM = 55
local POR_PAGINA = 60
local MAXIMO_LISTADO = 3000 -- teto de resultados sem busca, para nao varrer tudo a toa

local janela = nil
local botao = nil
local slots = {}
local catalogo = nil
local resultados = {}
local pagina = 1
local escolhido = nil

-- O catalogo tem dezenas de milhares de entradas. Montado uma unica vez, na
-- primeira abertura, e nao no carregamento do modulo: nao ha motivo para pagar
-- esse custo em quem nunca abrir o menu.
local function obterCatalogo()
    if catalogo then
        return catalogo
    end

    catalogo = {}
    local tipos = g_things.getThingTypes(ThingCategoryItem)
    for _, tipo in ipairs(tipos or {}) do
        local nome = tipo:getName()
        if nome and nome:len() > 0 then
            table.insert(catalogo, { id = tipo:getId(), nome = nome })
        end
    end
    return catalogo
end

local function totalPaginas()
    return math.max(1, math.ceil(#resultados / POR_PAGINA))
end

local function mostrarPagina()
    local inicio = (pagina - 1) * POR_PAGINA

    for i, slot in ipairs(slots) do
        local r = resultados[inicio + i]
        if r then
            slot:setItemId(r.id)
            slot:setTooltip(r.nome .. ' (' .. r.id .. ')')
            slot.dados = r
            slot:show()
        else
            slot:clearItem()
            slot:setTooltip('')
            slot.dados = nil
            slot:hide()
        end
    end

    janela.paginacao:setText(tr('Pagina') .. ' ' .. pagina .. '/' .. totalPaginas() ..
        '  —  ' .. #resultados .. ' ' .. tr('itens'))
end

local function buscar(texto)
    local lista = obterCatalogo()
    resultados = {}

    if not texto or texto:len() == 0 then
        -- Sem termo de busca, mostra so o comeco do catalogo. Listar dezenas de
        -- milhares de itens sem filtro nao ajuda ninguem a achar nada.
        for i = 1, math.min(#lista, MAXIMO_LISTADO) do
            table.insert(resultados, lista[i])
        end
    else
        local alvo = texto:lower()
        for _, item in ipairs(lista) do
            if item.nome:lower():find(alvo, 1, true) then
                table.insert(resultados, item)
                if #resultados >= MAXIMO_LISTADO then
                    break
                end
            end
        end
    end

    pagina = 1
    mostrarPagina()
end

local function selecionar(slot)
    if not slot.dados then
        return
    end
    escolhido = slot.dados
    slot:focus()
    janela.selecionado:setText(escolhido.nome .. '  (id ' .. escolhido.id .. ')')
end

local function criar()
    if not escolhido then
        return
    end
    -- Campo de texto e nao SpinBox: o SpinBox reescreve o valor a cada tecla
    -- e impede digitar o numero inteiro.
    local qtd = math.floor(tonumber(janela.quantidade:getText()) or 1)
    qtd = math.max(1, math.min(10000, qtd))
    -- Enviado pelo nome, e nao pelo id: o /i aceita os dois, e o nome evita o
    -- descasamento entre id de client e id de servidor.
    g_game.talk('/i ' .. escolhido.nome .. ', ' .. qtd)
end

local function montarGrade()
    for i = 1, POR_PAGINA do
        local slot = g_ui.createWidget('GmSlot', janela.grade)
        slot.onMouseRelease = function(widget, _, botaoMouse)
            if botaoMouse == MouseLeftButton then
                selecionar(widget)
                return true
            end
        end
        slot.onDoubleClick = function(widget)
            selecionar(widget)
            criar()
            return true
        end
        slot:hide()
        slots[i] = slot
    end
end

function toggle()
    if not janela then
        return
    end
    if janela:isVisible() then
        janela:hide()
        if botao then botao:setOn(false) end
    else
        if #resultados == 0 then
            buscar(janela.busca:getText())
        end
        janela:show()
        janela:raise()
        janela:focus()
        if botao then botao:setOn(true) end
    end
end

-- Chamado quando o servidor confirma que esta conta tem acesso.
local function liberar()
    if botao then
        return
    end
    botao = modules.game_mainpanel.addToggleButton('gmButton', tr('Menu de GM'),
        '/images/options/button_control', toggle, false, 99998)
    botao:setOn(false)
    botao:show()
end

local function aoReceberOpcode(protocol, code, buffer)
    if code == OPCODE_MENU_GM then
        liberar()
    end
end

function onGameEnd()
    -- O acesso e reavaliado a cada login: se o proximo personagem nao for GM, o
    -- botao nao deve continuar la.
    if janela and janela:isVisible() then
        janela:hide()
    end
    if botao then
        botao:destroy()
        botao = nil
    end
end

function init()
    janela = g_ui.displayUI('gm')
    janela:hide()

    montarGrade()

    janela.quantidade:setText('1')

    janela.busca.onTextChange = function(_, texto)
        buscar(texto)
    end
    janela.anterior.onClick = function()
        if pagina > 1 then
            pagina = pagina - 1
            mostrarPagina()
        end
    end
    janela.proxima.onClick = function()
        if pagina < totalPaginas() then
            pagina = pagina + 1
            mostrarPagina()
        end
    end
    janela.criar.onClick = criar

    ProtocolGame.registerExtendedOpcode(OPCODE_MENU_GM, aoReceberOpcode)
    connect(g_game, { onGameEnd = onGameEnd })
end

function terminate()
    disconnect(g_game, { onGameEnd = onGameEnd })
    ProtocolGame.unregisterExtendedOpcode(OPCODE_MENU_GM, aoReceberOpcode)

    if botao then
        botao:destroy()
        botao = nil
    end
    if janela then
        janela:destroy()
        janela = nil
    end
    slots = {}
    catalogo = nil
    resultados = {}
end
