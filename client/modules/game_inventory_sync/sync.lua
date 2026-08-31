-- Mantem os slots de equipamento em dia com o que o jogador realmente veste.
--
-- Existe por um sintoma concreto: equipar um item nao o desenhava no slot, e
-- tirar nao o apagava. Relogar corrigia, porque o servidor reenvia tudo no login.
--
-- Nao e correcao de causa raiz, e nao vou fingir que e. Conferi a cadeia inteira
-- e todos os elos parecem certos: o servidor manda 0x78/0x79 por slot
-- (protocolgame.cpp:8833), o client analisa
-- (protocolgameparse.cpp:1784), aplica em setInventoryItem
-- (localplayer.cpp:458) e dispara onInventoryChange, que o game_inventory
-- escuta com :execute(). Nenhum erro de Lua aparece no log. Ainda assim o
-- sintoma acontece.
--
-- Entao isto reconcilia de tempos em tempos em vez de depender do evento. O
-- game_inventory ja sabe se redesenhar a partir do estado real: reloadInventory
-- percorre os dez slots e reaplica cada item. Aqui so chamamos isso quando algo
-- de fato divergiu.
--
-- Se um dia a causa aparecer, este modulo sai inteiro.

local INTERVALO = 500 -- ms

local SLOTS = {
    InventorySlotHead,
    InventorySlotNeck,
    InventorySlotBack,
    InventorySlotBody,
    InventorySlotRight,
    InventorySlotLeft,
    InventorySlotLeg,
    InventorySlotFeet,
    InventorySlotFinger,
    InventorySlotAmmo
}

local tique = nil
local ultimo = {}

-- Redesenhar os dez slots a cada meio segundo seria desperdicio continuo. Isto
-- guarda o id visto por ultimo em cada slot e so manda redesenhar quando muda.
local function conferir()
    local p = g_game.getLocalPlayer()
    if not p then
        return
    end

    local mudou = false
    for _, slot in ipairs(SLOTS) do
        local item = p:getInventoryItem(slot)
        local id = item and item:getId() or 0
        if ultimo[slot] ~= id then
            ultimo[slot] = id
            mudou = true
        end
    end

    if mudou and modules.game_inventory and modules.game_inventory.reloadInventory then
        modules.game_inventory.reloadInventory()
    end
end

function onGameStart()
    ultimo = {}
    if not tique then
        tique = cycleEvent(conferir, INTERVALO)
    end
end

function onGameEnd()
    if tique then
        removeEvent(tique)
        tique = nil
    end
    ultimo = {}
end

function init()
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
end
