using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using MySqlConnector;

namespace Vethara;

public record NovaConta(string? Email, string? Senha, string? Personagem, int Sexo = 1);

public static partial class Contas
{
    // O Canary guarda SHA-1 do texto puro, sem sal. Verificado no banco: o hash da
    // conta @god e exatamente sha1("god"). Mudar isso faz o jogador criar a conta
    // e nao conseguir entrar, sem erro que ajude a diagnosticar.
    public static string Hash(string senha) =>
        Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(senha))).ToLowerInvariant();

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex FormatoEmail();

    [GeneratedRegex(@"^[A-Za-zÀ-ÿ]+(?: [A-Za-zÀ-ÿ]+)*$")]
    private static partial Regex FormatoNome();

    public static string? Validar(NovaConta c)
    {
        var email = c.Email?.Trim() ?? "";
        var senha = c.Senha ?? "";
        var nome = c.Personagem?.Trim() ?? "";

        if (email.Length is < 5 or > 255 || !FormatoEmail().IsMatch(email))
            return "Informe um e-mail válido.";
        if (senha.Length < 8)
            return "A senha precisa ter ao menos 8 caracteres.";
        if (nome.Length is < 3 or > 20)
            return "O nome do personagem precisa ter entre 3 e 20 caracteres.";
        if (!FormatoNome().IsMatch(nome))
            return "O nome do personagem aceita apenas letras e espaços simples.";
        if (c.Sexo is not (0 or 1))
            return "Sexo inválido.";

        return null;
    }

    /// <summary>
    /// A coluna accounts.name e unica e tem 32 caracteres. O login e feito pelo email,
    /// entao o name e so um identificador interno — derivamos da parte local do email
    /// e resolvemos colisao com sufixo numerico.
    /// </summary>
    public static async Task<string> ApelidoLivreAsync(MySqlConnection c, string email)
    {
        var baseNome = new string(email.Split('@')[0]
            .Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
        if (baseNome.Length == 0) baseNome = "jogador";
        if (baseNome.Length > 24) baseNome = baseNome[..24];

        for (var i = 0; i < 100; i++)
        {
            var tentativa = i == 0 ? baseNome : $"{baseNome}{i}";
            await using var cmd = c.CreateCommand();
            cmd.CommandText = "SELECT 1 FROM accounts WHERE name = @n LIMIT 1";
            cmd.Parameters.AddWithValue("@n", tentativa);
            if (await cmd.ExecuteScalarAsync() is null) return tentativa;
        }
        // 100 colisoes seguidas nao acontece por acaso; melhor falhar alto.
        throw new InvalidOperationException("Não foi possível gerar um identificador de conta.");
    }

    public static async Task<bool> EmailEmUsoAsync(MySqlConnection c, string email)
    {
        await using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT 1 FROM accounts WHERE email = @e LIMIT 1";
        cmd.Parameters.AddWithValue("@e", email);
        return await cmd.ExecuteScalarAsync() is not null;
    }

    public static async Task<bool> PersonagemEmUsoAsync(MySqlConnection c, string nome)
    {
        await using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT 1 FROM players WHERE name = @n LIMIT 1";
        cmd.Parameters.AddWithValue("@n", nome);
        return await cmd.ExecuteScalarAsync() is not null;
    }

    /// <summary>
    /// Cria conta e primeiro personagem numa transacao: uma conta sem personagem
    /// deixaria o jogador preso na tela de selecao, sem forma de sair dali.
    /// Os atributos iniciais vem do personagem de exemplo que o proprio Canary
    /// distribui (Rook Sample), em vez de numeros inventados.
    /// </summary>
    public static async Task CriarAsync(MySqlConnection c, string email, string senha, string apelido, string personagem, int sexo)
    {
        await using var tx = await c.BeginTransactionAsync();

        long contaId;
        await using (var cmd = c.CreateCommand())
        {
            cmd.Transaction = tx;
            cmd.CommandText = """
                INSERT INTO accounts (name, password, email, created)
                VALUES (@nome, @senha, @email, UNIX_TIMESTAMP())
                """;
            cmd.Parameters.AddWithValue("@nome", apelido);
            cmd.Parameters.AddWithValue("@senha", Hash(senha));
            cmd.Parameters.AddWithValue("@email", email);
            await cmd.ExecuteNonQueryAsync();
            // No MySqlConnector o id gerado fica no comando, nao na conexao.
            contaId = cmd.LastInsertedId;
        }

        await using (var cmd = c.CreateCommand())
        {
            cmd.Transaction = tx;
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
            cmd.Parameters.AddWithValue("@nome", personagem);
            cmd.Parameters.AddWithValue("@conta", contaId);
            // 128 e o corpo masculino padrao; 136 o feminino.
            cmd.Parameters.AddWithValue("@looktype", sexo == 1 ? 128 : 136);
            cmd.Parameters.AddWithValue("@sexo", sexo);
            await cmd.ExecuteNonQueryAsync();
        }

        await tx.CommitAsync();
    }
}
