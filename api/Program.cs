using System.Security.Claims;
using System.Data;
using MySqlConnector;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Vethara;

var builder = WebApplication.CreateBuilder(args);

// As credenciais vêm das mesmas variáveis que o resto do stack usa (docker/.env).
// Nada de senha em appsettings.json — esse arquivo iria para o git.
var host = Environment.GetEnvironmentVariable("CANARY_DB_HOST") ?? "db";
var port = Environment.GetEnvironmentVariable("CANARY_DB_PORT") ?? "3306";
var name = Environment.GetEnvironmentVariable("CANARY_DB_NAME") ?? "canary";
var user = Environment.GetEnvironmentVariable("CANARY_DB_USER") ?? "canary";
var pass = Environment.GetEnvironmentVariable("CANARY_DB_PASSWORD") ?? "";

var connString = new MySqlConnectionStringBuilder
{
    Server = host,
    Port = uint.Parse(port),
    Database = name,
    UserID = user,
    Password = pass,
    // O servidor de jogo é quem manda no banco; a API só lê. Um pool enxuto
    // evita competir por conexões numa hora de pico.
    MaximumPoolSize = 10,
    ConnectionTimeout = 5
}.ConnectionString;

builder.Services.AddSingleton(_ => new DbFactory(connString));

// Sem isto o ASP.NET Core renomeia as claims do token (sub vira NameIdentifier,
// email vira o URI do schema), e o codigo que le pelo nome original nao acha nada.
System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

var chaveJwt = Sessao.Chave(LoggerFactory.Create(b => b.AddConsole()).CreateLogger("sessao"));
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = Sessao.Emissor,
            ValidAudience = Sessao.Emissor,
            IssuerSigningKey = chaveJwt,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();

// Vocações do Canary. Ids desconhecidos caem no fallback em vez de virar "None",
// que esconderia uma vocação nova numa atualização do servidor.
static string Vocacao(int id) => id switch
{
    0 => "Sem vocação",
    1 => "Sorcerer",
    2 => "Druid",
    3 => "Paladin",
    4 => "Knight",
    5 => "Master Sorcerer",
    6 => "Elder Druid",
    7 => "Royal Paladin",
    8 => "Elite Knight",
    _ => $"Vocação {id}"
};

app.MapGet("/api/status", async (DbFactory db) =>
{
    await using var c = await db.OpenAsync();

    await using var cmd = c.CreateCommand();
    cmd.CommandText = """
        SELECT
            (SELECT COUNT(*) FROM players_online)                    AS online,
            (SELECT COUNT(*) FROM players WHERE deletion = 0)        AS personagens,
            (SELECT COUNT(*) FROM accounts)                          AS contas
        """;
    await using var r = await cmd.ExecuteReaderAsync();
    await r.ReadAsync();

    return Results.Ok(new
    {
        servidor = Environment.GetEnvironmentVariable("CANARY_SERVER_NAME") ?? "Vethara",
        online = r.GetInt32("online"),
        personagens = r.GetInt32("personagens"),
        contas = r.GetInt32("contas")
    });
});

app.MapGet("/api/online", async (DbFactory db) =>
{
    await using var c = await db.OpenAsync();
    await using var cmd = c.CreateCommand();
    cmd.CommandText = """
        SELECT p.name, p.level, p.vocation
        FROM players_online o
        JOIN players p ON p.id = o.player_id
        WHERE p.deletion = 0
        ORDER BY p.level DESC, p.name
        """;

    var lista = new List<object>();
    await using var r = await cmd.ExecuteReaderAsync();
    while (await r.ReadAsync())
    {
        lista.Add(new
        {
            nome = r.GetString("name"),
            level = r.GetInt32("level"),
            vocacao = Vocacao(r.GetInt32("vocation"))
        });
    }
    return Results.Ok(lista);
});

app.MapGet("/api/highscores", async (DbFactory db, int pagina = 1, int tamanho = 50, int? vocacao = null) =>
{
    // Limites fixos: sem isso, um pedido com tamanho=1000000 vira um jeito fácil
    // de derrubar o banco de fora.
    tamanho = Math.Clamp(tamanho, 1, 100);
    pagina = Math.Max(pagina, 1);

    await using var c = await db.OpenAsync();
    await using var cmd = c.CreateCommand();
    cmd.CommandText = """
        SELECT p.name, p.level, p.experience, p.vocation
        FROM players p
        WHERE p.deletion = 0
          AND p.group_id = 1                       -- esconde a equipe do ranking
          AND (@voc IS NULL OR p.vocation = @voc)
        ORDER BY p.experience DESC, p.name
        LIMIT @limite OFFSET @salto
        """;
    cmd.Parameters.AddWithValue("@voc", vocacao.HasValue ? vocacao.Value : DBNull.Value);
    cmd.Parameters.AddWithValue("@limite", tamanho);
    cmd.Parameters.AddWithValue("@salto", (pagina - 1) * tamanho);

    var lista = new List<object>();
    var posicao = (pagina - 1) * tamanho;
    await using var r = await cmd.ExecuteReaderAsync();
    while (await r.ReadAsync())
    {
        lista.Add(new
        {
            posicao = ++posicao,
            nome = r.GetString("name"),
            level = r.GetInt32("level"),
            experiencia = r.GetInt64("experience"),
            vocacao = Vocacao(r.GetInt32("vocation"))
        });
    }
    return Results.Ok(lista);
});

app.MapGet("/api/noticias", async (DbFactory db, int limite = 5) =>
{
    limite = Math.Clamp(limite, 1, 20);

    await using var c = await db.OpenAsync();
    await using var cmd = c.CreateCommand();
    // A data é unix timestamp em int; a conversão fica aqui e o front recebe ISO.
    cmd.CommandText = """
        SELECT id, title, body, date
        FROM myaac_news
        WHERE hide = 0
        ORDER BY date DESC
        LIMIT @limite
        """;
    cmd.Parameters.AddWithValue("@limite", limite);

    var lista = new List<object>();
    await using var r = await cmd.ExecuteReaderAsync();
    while (await r.ReadAsync())
    {
        lista.Add(new
        {
            id = r.GetInt32("id"),
            titulo = r.GetString("title"),
            corpo = r.GetString("body"),
            data = DateTimeOffset.FromUnixTimeSeconds(r.GetInt32("date")).UtcDateTime
        });
    }
    return Results.Ok(lista);
});

app.MapPost("/api/contas", async (DbFactory db, NovaConta corpo) =>
{
    var erro = Contas.Validar(corpo);
    if (erro is not null) return Results.BadRequest(new { erro });

    var email = corpo.Email!.Trim().ToLowerInvariant();
    var personagem = corpo.Personagem!.Trim();

    await using var c = await db.OpenAsync();

    // O login-server casa apenas pelo campo email, e o schema do Canary nao poe
    // indice unico nele. Sem esta checagem, dois cadastros com o mesmo email
    // deixariam o segundo jogador sem conseguir entrar.
    if (await Contas.EmailEmUsoAsync(c, email))
        return Results.Conflict(new { erro = "Já existe uma conta com esse e-mail." });

    if (await Contas.PersonagemEmUsoAsync(c, personagem))
        return Results.Conflict(new { erro = "Esse nome de personagem já está em uso." });

    var apelido = await Contas.ApelidoLivreAsync(c, email);

    try
    {
        await Contas.CriarAsync(c, email, corpo.Senha!, apelido, personagem, corpo.Sexo);
    }
    catch (MySqlException e) when (e.Number == 1062)
    {
        // Corrida entre a checagem e o insert: alguem cadastrou o mesmo nome no meio.
        return Results.Conflict(new { erro = "Esse nome acabou de ser registrado por outra pessoa. Escolha outro." });
    }

    return Results.Created("/api/contas", new
    {
        email,
        personagem,
        mensagem = "Conta criada. Use o e-mail e a senha para entrar no jogo."
    });
});

app.MapPost("/api/sessao", async (DbFactory db, Credenciais corpo) =>
{
    var email = corpo.Email?.Trim().ToLowerInvariant() ?? "";
    var senha = corpo.Senha ?? "";
    if (email.Length == 0 || senha.Length == 0)
        return Results.BadRequest(new { erro = "Informe e-mail e senha." });

    await using var c = await db.OpenAsync();
    var conta = await Sessao.AutenticarAsync(c, email, senha);

    // Mesma resposta para e-mail inexistente e senha errada: dizer qual dos dois
    // falhou entrega a quem sonda quais e-mails estao cadastrados.
    if (conta is null)
        return Results.Json(new { erro = "E-mail ou senha incorretos." }, statusCode: 401);

    return Results.Ok(new
    {
        token = Sessao.Emitir(chaveJwt, conta.Value.Id, conta.Value.Email),
        email = conta.Value.Email
    });
});

app.MapGet("/api/minha-conta", async (DbFactory db, ClaimsPrincipal usuario) =>
{
    var contaId = Sessao.ContaDoUsuario(usuario);
    if (contaId is null) return Results.Unauthorized();

    await using var c = await db.OpenAsync();
    return Results.Ok(new
    {
        email = await Sessao.EmailDaContaAsync(c, contaId.Value),
        personagens = await Sessao.PersonagensAsync(c, contaId.Value)
    });
}).RequireAuthorization();

app.MapPost("/api/minha-conta/personagens", async (DbFactory db, ClaimsPrincipal usuario, NovoPersonagem corpo) =>
{
    var contaId = Sessao.ContaDoUsuario(usuario);
    if (contaId is null) return Results.Unauthorized();

    var erro = Contas.ValidarNomePersonagem(corpo.Nome, corpo.Sexo);
    if (erro is not null) return Results.BadRequest(new { erro });

    var nome = corpo.Nome!.Trim();
    await using var c = await db.OpenAsync();

    // Um teto evita que uma conta encha o banco de nomes reservados.
    if (await Sessao.QuantosPersonagensAsync(c, contaId.Value) >= 10)
        return Results.BadRequest(new { erro = "Sua conta ja tem o maximo de 10 personagens." });

    if (await Contas.PersonagemEmUsoAsync(c, nome))
        return Results.Conflict(new { erro = "Esse nome de personagem ja esta em uso." });

    try
    {
        await Sessao.CriarPersonagemAsync(c, contaId.Value, nome, corpo.Sexo);
    }
    catch (MySqlException e) when (e.Number == 1062)
    {
        return Results.Conflict(new { erro = "Esse nome acabou de ser registrado por outra pessoa." });
    }

    return Results.Created("/api/minha-conta", new { nome });
}).RequireAuthorization();

app.MapPost("/api/minha-conta/senha", async (DbFactory db, ClaimsPrincipal usuario, TrocaSenha corpo) =>
{
    var contaId = Sessao.ContaDoUsuario(usuario);
    if (contaId is null) return Results.Unauthorized();

    if ((corpo.SenhaNova?.Length ?? 0) < 8)
        return Results.BadRequest(new { erro = "A nova senha precisa ter ao menos 8 caracteres." });

    await using var c = await db.OpenAsync();
    var ok = await Sessao.TrocarSenhaAsync(c, contaId.Value, corpo.SenhaAtual ?? "", corpo.SenhaNova!);

    return ok
        ? Results.Ok(new { mensagem = "Senha alterada. Use a nova para entrar no jogo." })
        : Results.BadRequest(new { erro = "A senha atual esta incorreta." });
}).RequireAuthorization();

// Usado pelo healthcheck do compose: responde 200 só se o banco estiver acessível.
app.MapGet("/api/saude", async (DbFactory db) =>
{
    try
    {
        await using var c = await db.OpenAsync();
        return Results.Ok(new { ok = true });
    }
    catch (Exception e)
    {
        return Results.Problem($"banco inacessível: {e.Message}", statusCode: 503);
    }
});

app.Run();

sealed class DbFactory(string connString)
{
    public async Task<MySqlConnection> OpenAsync()
    {
        var c = new MySqlConnection(connString);
        await c.OpenAsync();
        return c;
    }
}
