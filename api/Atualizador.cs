using System.IO.Hashing;

namespace Vethara.Api;

/// <summary>
/// Manifesto de atualizacao do client.
///
/// O modulo updater do OTClient pede este manifesto no boot, compara o CRC32 de
/// cada arquivo com o que tem em disco e baixa so o que difere
/// (modules/updater/updater.lua). Com isso, corrigir uma linha do Assistente
/// deixa de exigir que o jogador rebaixe 254 MB.
///
/// O manifesto lista apenas os arquivos que sao nossos, os mesmos que estao em
/// client/ no repositorio. Os assets da CipSoft ficam de fora de proposito: sao
/// 6.039 arquivos que nunca mudam sem uma troca de versao do Tibia, e nessa hora
/// um pacote novo e mais honesto que 6.039 downloads avulsos. O keepFiles = true
/// garante que o updater nao remova nada que o manifesto nao cite.
/// </summary>
public static class Atualizador
{
    // README e script de build existem para quem trabalha no repositorio, e nao
    // para quem joga.
    private static readonly HashSet<string> Ignorados = new(StringComparer.OrdinalIgnoreCase)
    {
        "README.md",
        "build-vethara.bat",
        // Tem tratamento proprio: vai no campo binary, e nao na lista de arquivos.
        "otclient.exe"
    };

    private static readonly SemaphoreSlim Trava = new(1, 1);
    private static Manifesto? _cache;
    private static DateTime _cacheAte = DateTime.MinValue;

    public sealed record Manifesto(
        string Url,
        Dictionary<string, string> Files,
        bool KeepFiles,
        Binario? Binary);

    public sealed record Binario(string File, string Checksum);

    /// <summary>
    /// O CRC32 aqui precisa casar com g_crypt.crc32 do client, que e o CRC-32
    /// padrao (IEEE) em hexadecimal minusculo. Qualquer divergencia de formato
    /// faz o client rebaixar tudo a cada boot, sem nunca convergir.
    /// </summary>
    private static string Crc32(string caminho)
    {
        using var arquivo = File.OpenRead(caminho);
        var crc = new Crc32();
        crc.Append(arquivo);
        // Sem preenchimento com zeros: o client usa std::to_chars(num, 16), que
        // nao completa a largura (stdext/string.cpp:82). Um CRC 0x00abcdef vira
        // "abcdef" la, e "x8" aqui produziria "00abcdef" — divergencia permanente,
        // com o arquivo sendo rebaixado a cada boot sem nunca convergir.
        return crc.GetCurrentHashAsUInt32().ToString("x");
    }

    private static Manifesto Gerar(string raiz, string urlBase)
    {
        var arquivos = new Dictionary<string, string>();

        if (Directory.Exists(raiz))
        {
            foreach (var caminho in Directory.EnumerateFiles(raiz, "*", SearchOption.AllDirectories))
            {
                var nome = Path.GetFileName(caminho);
                if (Ignorados.Contains(nome))
                {
                    continue;
                }

                // O client usa caminho absoluto com barra normal: /modules/x/y.lua
                var relativo = Path.GetRelativePath(raiz, caminho).Replace('\\', '/');
                arquivos['/' + relativo] = Crc32(caminho);
            }
        }

        // O client sabe trocar o proprio executavel: baixa, grava como
        // otclient-<timestamp>.exe e reinicia nele (resourcemanager.cpp:1176). O
        // checksum e comparado com g_resources.selfChecksum(), que e o CRC32 do
        // exe em execucao — mesmo algoritmo e mesmo formato dos demais arquivos.
        //
        // O exe nao entra no git: sao 19 MB de binario que mudam a cada
        // recompilacao. Ele e enviado por scp para a pasta servida, e se nao
        // estiver la o manifesto simplesmente nao anuncia binario nenhum.
        var exe = Path.Combine(raiz, "otclient.exe");
        var binario = File.Exists(exe)
            ? new Binario("/otclient.exe", Crc32(exe))
            : null;

        return new Manifesto(urlBase.TrimEnd('/'), arquivos, KeepFiles: true, binario);
    }

    public static async Task<Manifesto> ObterAsync(IConfiguration config)
    {
        // O manifesto e o mesmo para todos os jogadores e so muda quando um deploy
        // altera os arquivos. Recalcular o CRC32 de tudo a cada login seria ler o
        // disco inteiro por jogador que abre o client.
        if (_cache is not null && DateTime.UtcNow < _cacheAte)
        {
            return _cache;
        }

        await Trava.WaitAsync();
        try
        {
            if (_cache is not null && DateTime.UtcNow < _cacheAte)
            {
                return _cache;
            }

            var raiz = config["VETHARA_CLIENT_DIR"] ?? "/client";
            var dominio = config["VETHARA_DOMAIN"] ?? "vethara.com.br";
            _cache = Gerar(raiz, $"https://{dominio}/client");
            _cacheAte = DateTime.UtcNow.AddMinutes(2);
            return _cache;
        }
        finally
        {
            Trava.Release();
        }
    }
}
