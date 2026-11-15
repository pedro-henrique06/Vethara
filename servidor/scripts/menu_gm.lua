-- Avisa o client de que este jogador pode usar o menu de GM.
--
-- ATENCAO: na pratica este opcode nao chega. O Canary so trata a conexao como
-- OTClient quando ela se anuncia com operatingSystem >= CLIENTOS_OTCLIENT_LINUX
-- (10), e por padrao o client se anuncia como CLIENTOS_WINDOWS (2) a menos que
-- o client base tenha g_game.enableFeature(GameExtendedOpcode). Por isso o
-- botao do game_gm nao depende mais disto.
--
-- O script fica de proposito: quando o opcode chegar, o client grava uma linha
-- no log, e e assim que vamos saber que esse caminho voltou a funcionar.
--
-- A autoridade sobre criar item nao esta aqui nem no client: esta em
-- criar_item.lua, que confere o acesso antes de criar qualquer coisa.
local OPCODE_MENU_GM = 55

local avisarGm = CreatureEvent("VetharaMenuGm")

function avisarGm.onLogin(player)
	if player:getGroup():getAccess() then
		-- Pequeno atraso: no instante do login o client ainda esta montando os
		-- modulos, e o opcode chegaria antes de haver quem o escutasse.
		addEvent(function(guid)
			local p = Player(guid)
			if p then
				p:sendExtendedOpcode(OPCODE_MENU_GM, "1")
			end
		end, 2000, player:getGuid())
	end
	return true
end

avisarGm:register()
