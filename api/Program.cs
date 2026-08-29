using System.Data;
using MySqlConnector;

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
var app = builder.Build();

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
