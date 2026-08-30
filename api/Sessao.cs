using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using MySqlConnector;

namespace Vethara;

public record Credenciais(string? Email, string? Senha);
public record NovoPersonagem(string? Nome, int Sexo = 1);
public record TrocaSenha(string? SenhaAtual, string? SenhaNova);

public static class Sessao
{
    public const string Emissor = "vethara";

    /// <summary>
    /// O segredo vem do ambiente. Sem ele a API ainda sobe — com um segredo aleatório
    /// gerado na inicialização — para não derrubar o site por configuração faltando.
    /// O efeito colateral é que reiniciar a API desconecta quem estava logado.
    /// </summary>
    public static SymmetricSecurityKey Chave(ILogger log)
    {
        var segredo = Environment.GetEnvironmentVariable("VETHARA_JWT_SECRET");
        if (string.IsNullOrWhiteSpace(segredo) || segredo.Length < 32)
        {
            log.LogWarning(
                "VETHARA_JWT_SECRET ausente ou curto demais. Usando segredo aleatório: " +
                "as sessões cairão a cada reinício da API. Defina a variável no docker/.env.");
            segredo = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        }
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(segredo));
    }

    public static string Emitir(SymmetricSecurityKey chave, long contaId, string email)
    {
        var token = new JwtSecurityToken(
            issuer: Emissor,
            audience: Emissor,
            claims: [
                new Claim(JwtRegisteredClaimNames.Sub, contaId.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, email)
            ],
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: new SigningCredentials(chave, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>
    /// Le o id da conta do token. Procura tambem em NameIdentifier porque o
    /// ASP.NET Core, por padrao, traduz a claim "sub" para esse nome — e ai
    /// buscar por "sub" nao encontra nada.
    /// </summary>
    public static long? ContaDoUsuario(ClaimsPrincipal usuario)
    {
        var bruto = usuario.FindFirstValue(JwtRegisteredClaimNames.Sub)
                 ?? usuario.FindFirstValue(ClaimTypes.NameIdentifier);
        return long.TryParse(bruto, out var id) ? id : null;
    }

    /// <summary>
    /// Confere as credenciais contra a tabela accounts. O login é pelo campo email:
    /// verificado empiricamente que o login-server do jogo casa só por ele.
    /// </summary>
    public static async Task<(long Id, string Email)?> AutenticarAsync(MySqlConnection c, string email, string senha)
    {
        await using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT id, email FROM accounts WHERE email = @e AND password = @p LIMIT 1";
        cmd.Parameters.AddWithValue("@e", email);
        cmd.Parameters.AddWithValue("@p", Contas.Hash(senha));

        await using var r = await cmd.ExecuteReaderAsync();
        if (!await r.ReadAsync()) return null;
        return (r.GetInt64("id"), r.GetString("email"));
    }

    /// <summary>
    /// Le o email do banco em vez de confiar na claim do token: o ASP.NET Core
    /// renomeia claims por padrao, e o banco e a fonte da verdade de qualquer jeito.
    /// </summary>
    public static async Task<string?> EmailDaContaAsync(MySqlConnection c, long contaId)
    {
        await using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT email FROM accounts WHERE id = @id LIMIT 1";
        cmd.Parameters.AddWithValue("@id", contaId);
        return await cmd.ExecuteScalarAsync() as string;
    }

    public static async Task<List<object>> PersonagensAsync(MySqlConnection c, long contaId)
    {
        await using var cmd = c.CreateCommand();
        cmd.CommandText = """
            SELECT name, level, vocation, lastlogin, deletion
            FROM players
            WHERE account_id = @conta AND deletion = 0
            ORDER BY level DESC, name
            """;
        cmd.Parameters.AddWithValue("@conta", contaId);

        var lista = new List<object>();
        await using var r = await cmd.ExecuteReaderAsync();
        while (await r.ReadAsync())
        {
            var ultimo = r.GetInt64("lastlogin");
            lista.Add(new
            {
                nome = r.GetString("name"),
                level = r.GetInt32("level"),
                vocacao = r.GetInt32("vocation"),
                ultimoLogin = ultimo > 0
                    ? DateTimeOffset.FromUnixTimeSeconds(ultimo).UtcDateTime
                    : (DateTime?)null
            });
        }
        return lista;
    }

    public static async Task<int> QuantosPersonagensAsync(MySqlConnection c, long contaId)
    {
        await using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM players WHERE account_id = @conta AND deletion = 0";
        cmd.Parameters.AddWithValue("@conta", contaId);
        return Convert.ToInt32(await cmd.ExecuteScalarAsync());
    }

    public static async Task CriarPersonagemAsync(MySqlConnection c, long contaId, string nome, int sexo)
    {
        await using var cmd = c.CreateCommand();
        cmd.CommandText = """
            INSERT INTO players
                (name, group_id, account_id, level, vocation, experience,
                 health, healthmax, mana, manamax, cap, soul, stamina,
                 looktype, lookhead, lookbody, looklegs, lookfeet, sex, town_id, conditions)
            VALUES
                (@nome, 1, @conta, 2, 0, 100,
                 155, 155, 60, 60, 410, 0, 2520,
                 @looktype, 95, 113, 39, 115, @sexo, 1, '')
            """;
        cmd.Parameters.AddWithValue("@nome", nome);
        cmd.Parameters.AddWithValue("@conta", contaId);
        cmd.Parameters.AddWithValue("@looktype", sexo == 1 ? 128 : 136);
        cmd.Parameters.AddWithValue("@sexo", sexo);
        await cmd.ExecuteNonQueryAsync();
    }

    public static async Task<bool> TrocarSenhaAsync(MySqlConnection c, long contaId, string atual, string nova)
    {
        await using var conferir = c.CreateCommand();
        conferir.CommandText = "SELECT 1 FROM accounts WHERE id = @id AND password = @p LIMIT 1";
        conferir.Parameters.AddWithValue("@id", contaId);
        conferir.Parameters.AddWithValue("@p", Contas.Hash(atual));
        if (await conferir.ExecuteScalarAsync() is null) return false;

        await using var trocar = c.CreateCommand();
        trocar.CommandText = "UPDATE accounts SET password = @p WHERE id = @id";
        trocar.Parameters.AddWithValue("@p", Contas.Hash(nova));
        trocar.Parameters.AddWithValue("@id", contaId);
        await trocar.ExecuteNonQueryAsync();
        return true;
    }
}
