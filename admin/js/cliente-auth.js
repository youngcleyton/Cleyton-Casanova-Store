/**
 * CLIENTE-AUTH.JS
 * Gestão de sessão de cliente (não é o admin)
 * Guarda o token no localStorage. Nunca guarda dados sensíveis.
 */
window.CCS_Cliente = (function () {
  const TOKEN_KEY = "ccs_cliente_token";
  const INFO_KEY = "ccs_cliente_info";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setSessao(token, info) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(INFO_KEY, JSON.stringify(info || {}));
  }

  function limparSessao() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(INFO_KEY);
  }

  function getInfo() {
    try { return JSON.parse(localStorage.getItem(INFO_KEY) || "null"); }
    catch { return null; }
  }

  async function verificarSessao() {
    const token = getToken();
    if (!token) return null;
    try {
      const { data, error } = await window.sb.functions.invoke("customer-status", {
        body: { token }
      });
      if (error || !data?.ok) {
        limparSessao();
        return null;
      }
      setSessao(token, data.cliente);
      return data.cliente;
    } catch {
      return null;
    }
  }

  async function login(email, password) {
    const { data, error } = await window.sb.functions.invoke("customer-login", {
      body: { email, password }
    });
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error(data?.erro || "Erro ao entrar");
    setSessao(data.token, data.cliente);
    return data.cliente;
  }

  async function registar({ whatsapp, email, password, nome }) {
    const { data, error } = await window.sb.functions.invoke("customer-register", {
      body: { whatsapp, email, password, nome }
    });
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error(data?.erro || "Erro ao registar");
    return data;
  }

  async function verificarNotificacao(whatsapp) {
    const { data, error } = await window.sb.functions.invoke("customer-status", {
      body: { whatsapp }
    });
    if (error || !data?.ok) return null;
    return data.notificacao;
  }

  function logout() {
    limparSessao();
  }

  return {
    getToken, getInfo, setSessao, limparSessao,
    verificarSessao, login, registar,
    verificarNotificacao, logout
  };
})();