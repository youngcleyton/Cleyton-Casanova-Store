/**
 * FIDELIZACAO.JS
 * Calcula o nível do cliente baseado no histórico (guardado no servidor).
 * NUNCA confiar no navegador para descontos — isto é apenas para mostrar ao utilizador.
 * O backend (Edge Function) recalcula o desconto real ao criar o pedido.
 */
window.CCS_Fidelizacao = (function () {
  const NIVEIS = [
    { min: 0, desconto: 0 },  // primeira compra
    { min: 1, desconto: 5 },  // segunda compra
    { min: 2, desconto: 7 },  // terceira compra em diante
    { min: 5, desconto: 10 }  // cliente frequente
  ];

  /** Buscar histórico do cliente (por client_id local OU whatsapp) */
  async function obterHistorico(whatsapp) {
    const clientId = CCS.getClientId();
    let query = window.sb.from("customers").select("id, total_compras, desconto_atual");
    if (whatsapp) {
      query = query.or(`client_id.eq.${clientId},whatsapp.eq.${whatsapp}`);
    } else {
      query = query.eq("client_id", clientId);
    }
    const { data } = await query.maybeSingle();
    return data || { total_compras: 0, desconto_atual: 0 };
  }

  /** Mostrar nível ao utilizador */
  function calcularNivel(totalCompras) {
    let nivel = NIVEIS[0];
    for (const n of NIVEIS) if (totalCompras >= n.min) nivel = n;
    return nivel;
  }

  return { obterHistorico, calcularNivel };
})();