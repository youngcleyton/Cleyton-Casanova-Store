(async function () {
  await new Promise(r => setTimeout(r, 400)); // espera auth-guard
  const { data: { session } } = await window.sb.auth.getSession();
  if (!session) return;

  // ---------- Contadores ----------
  const [vendas, pendentes, confirmados, cancelados, produtos, esgotados, clientes] =
    await Promise.all([
      window.sb.from("orders").select("total").eq("estado", "confirmado"),
      window.sb.from("orders").select("id", { count: "exact", head: true }).eq("estado", "pendente"),
      window.sb.from("orders").select("id", { count: "exact", head: true }).eq("estado", "confirmado"),
      window.sb.from("orders").select("id", { count: "exact", head: true }).eq("estado", "cancelado"),
      window.sb.from("products").select("id", { count: "exact", head: true }).eq("activo", true),
      window.sb.from("products").select("id", { count: "exact", head: true }).lte("stock", 0),
      window.sb.from("customers").select("id", { count: "exact", head: true }).gt("total_compras", 1)
    ]);

  const totalVendas = (vendas.data || []).reduce((s, o) => s + Number(o.total), 0);

  const stats = [
    { label: "Total de Vendas", valor: CCS.formatarPreco(totalVendas), cor: "dourado" },
    { label: "Pedidos Pendentes", valor: pendentes.count || 0, cor: "amarelo" },
    { label: "Pedidos Confirmados", valor: confirmados.count || 0, cor: "verde" },
    { label: "Pedidos Cancelados", valor: cancelados.count || 0, cor: "vermelho" },
    { label: "Produtos Activos", valor: produtos.count || 0, cor: "dourado" },
    { label: "Produtos Esgotados", valor: esgotados.count || 0, cor: "vermelho" },
    { label: "Clientes Recorrentes", valor: clientes.count || 0, cor: "dourado" }
  ];

  document.getElementById("stats").innerHTML = stats.map(s => `
    <div class="stat-card ${s.cor}">
      <div class="stat-label">${s.label}</div>
      <div class="stat-value">${s.valor}</div>
    </div>
  `).join("");

  // ---------- Chart últimos 7 dias ----------
  const { data: orders7 } = await window.sb
    .from("orders").select("total, criado_em")
    .eq("estado", "confirmado")
    .gte("criado_em", new Date(Date.now() - 7 * 864e5).toISOString());

  const dias = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    dias[k] = 0;
  }
  (orders7 || []).forEach(o => {
    const k = o.criado_em.slice(0, 10);
    if (dias[k] !== undefined) dias[k] += Number(o.total);
  });
  const max = Math.max(...Object.values(dias), 1);
  document.getElementById("chart-semana").innerHTML = Object.entries(dias).map(([k, v]) => `
    <div class="bar-item">
      <div class="bar" style="height:${(v / max) * 100}%" title="${CCS.formatarPreco(v)}"></div>
      <div class="bar-label">${k.slice(5)}</div>
      <div class="bar-val">${CCS.formatarPreco(v)}</div>
    </div>
  `).join("");
})();