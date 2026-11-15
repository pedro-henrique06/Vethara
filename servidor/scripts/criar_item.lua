-- Comando que o menu de GM do client usa para criar itens.
--
-- O menu nao usa /i de proposito. O /i e groupType("god") e, para quem nao tem
-- esse grupo, o Canary NAO engole a mensagem: checkWord devolve false, o
-- playerSay segue adiante e o texto sai falado em voz alta. Um jogador comum
-- que clicasse em Criar apareceria dizendo "/i magic sword, 1" na frente de
-- todos. O descarte do '/' no playerSay vale so para isAccessPlayer(), ou seja,
-- justamente para quem tem acesso.
--
-- Este comando nao declara grupo (m_groupType nasce 0), entao o portao de grupo
-- do checkWord passa para qualquer jogador e o onSay abaixo sempre roda. Como
-- ele devolve true, o executeSay devolve true, o checkWord devolve true e o
-- playerSay para ali: a mensagem nunca e falada, tenha o jogador acesso ou nao.
--
-- Quem pode criar e decidido aqui, no servidor. O client nao tem autoridade
-- nenhuma: ele so manda o pedido.
local COMANDO = '/vethara-criar'

-- Teto para nao transformar um clique errado em travamento do servidor.
local MAXIMO_EMPILHAVEL = 10000
local MAXIMO_AVULSO = 100

local criarItem = TalkAction(COMANDO)

function criarItem.onSay(player, words, param)
	if not player:getGroup():getAccess() then
		-- Sem aviso de proposito: quem nao e GM nao deveria ter o botao, e
		-- responder so entregaria a existencia do comando. A mensagem morre aqui.
		return true
	end

	-- "nome, quantidade" ou so "nome".
	local nome, quantidade = param:match('^%s*(.-)%s*,%s*(%d+)%s*$')
	if not nome then
		nome = param:match('^%s*(.-)%s*$')
		quantidade = '1'
	end

	if not nome or nome == '' then
		player:sendTextMessage(MESSAGE_FAILURE,
			'Uso: ' .. COMANDO .. ' <nome do item>, <quantidade>')
		return true
	end

	-- Pelo nome, e nao pelo id: o id do client nao e necessariamente o do
	-- servidor, e o menu lista nomes.
	local tipo = ItemType(nome)
	local id = tipo and tipo:getId() or 0
	if id == 0 then
		player:sendTextMessage(MESSAGE_FAILURE, 'Item nao encontrado: ' .. nome)
		return true
	end

	local teto = tipo:isStackable() and MAXIMO_EMPILHAVEL or MAXIMO_AVULSO
	local qtd = math.max(1, math.min(teto, math.floor(tonumber(quantidade) or 1)))

	local item = player:addItem(id, qtd)
	if not item then
		player:sendTextMessage(MESSAGE_FAILURE,
			'Nao foi possivel criar ' .. nome .. ' - confira capacidade e espaco na mochila.')
		return true
	end

	player:sendTextMessage(MESSAGE_FAILURE, 'Criado: ' .. qtd .. 'x ' .. nome .. ' (id ' .. id .. ').')
	return true
end

-- Obrigatorio: o separador padrao e '"', e com ele o checkWord recusa qualquer
-- parametro antes de chegar no onSay.
criarItem:separator(' ')
criarItem:register()
