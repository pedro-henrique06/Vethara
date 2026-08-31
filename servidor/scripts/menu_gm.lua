-- Avisa o client de que este jogador pode usar o menu de GM.
--
-- O client nao tem como saber sozinho o grupo da conta: nada no protocolo conta
-- isso. Entao o servidor manda um extended opcode no login, e o modulo game_gm
-- do client so mostra o botao para quem recebeu.
--
-- Isto e conveniencia de interface, e nao seguranca. A autoridade continua sendo
-- o servidor: o menu apenas digita /i, e o /i so funciona para o grupo god
-- (create_item.lua e groupType("god")). Um jogador comum que forcasse o menu a
-- aparecer nao conseguiria criar nada.
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
