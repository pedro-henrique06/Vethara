// Guarda o token no localStorage. É por navegador e sobrevive ao F5 — suficiente
// para um painel de conta, e evita manter estado de sessão no servidor.
const CHAVE = 'vethara.token'

export const sessao = {
  token: () => {
    try { return localStorage.getItem(CHAVE) } catch { return null }
  },
  entrar: (token: string) => {
    try { localStorage.setItem(CHAVE, token) } catch { /* modo privado */ }
  },
  sair: () => {
    try { localStorage.removeItem(CHAVE) } catch { /* idem */ }
  },
  ativa: () => {
    try { return localStorage.getItem(CHAVE) !== null } catch { return false }
  }
}
