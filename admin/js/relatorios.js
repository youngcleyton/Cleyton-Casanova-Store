// admin/js/relatorios.js
(async function () {
  await new Promise(r => setTimeout(r, 400));
  const { data: { session } } = await window.sb.auth.getSession();
  if (!session) return;

  const cont = document.getElementById("relatorio-conteudo");
  let dadosAtuais = [];

  async function carregar() {
    const inicio = document.getElementById("data-inicio").value;
    const fim = document.getElementById("data-fim").value;
    let q = window.sb.from("orders").select("*, order_items(*)").order("criado_em", { ascending: false });
    if (inicio) q = q.gte("criado_em", new Date(inicio).toISOString());
    if (fim) q = q.lte("criado_em", new Date(fim + "T23:59:59").toISOString());
    const { data, error } = await q;
    if (error) { cont.innerHTML = "Erro: " + error.message; return; }
    dadosAtuais = data || [];
    render();
  }

  function render() {
    const confirmados = dadosAtuais.filter(o => o.estado === "confirmado" || o.estado === "concluido");
    const totalVendido = confirmados.reduce((s, o) => s + Number(o.total), 0);

    // Produtos mais vendidos
    const prodCount = {};
    confirmados.forEach(o => (o.order_items || []).forEach(i => {
      prodCount[i.nome_produto] = (prodCount[i.nome_produto] || 0) + i.quantidade;
    }));
    const topProdutos = Object.entries(prodCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Extrato diário
    const porDia = {};
    confirmados.forEach(o => {
      const d = o.criado_em.slice(0, 10);
      porDia[d] = porDia[d] || { count: 0, total: 0 };
      porDia[d].count++;
      porDia[d].total += Number(o.total);
    });

    cont.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card dourado"><div class="stat-label">Total vendido</div><div class="stat-value">${CCS.formatarPreco(totalVendido)}</div></div>
        <div class="stat-card verde"><div class="stat-label">Pedidos confirmados</div><div class="stat-value">${confirmados.length}</div></div>
        <div class="stat-card amarelo"><div class="stat-label">Pedidos totais</div><div class="stat-value">${dadosAtuais.length}</div></div>
      </div>

      <h3 style="font-family:var(--fonte-titulo);margin:40px 0 16px">Extrato diário</h3>
      <table class="tabela-admin">
        <thead><tr><th>Dia</th><th>Pedidos</th><th>Total</th></tr></thead>
        <tbody>
        ${Object.entries(porDia).sort().reverse().map(([d, v]) => `
          <tr><td>${d}</td><td>${v.count}</td><td>${CCS.formatarPreco(v.total)}</td></tr>
        `).join("") || `<tr><td colspan="3">Sem dados.</td></tr>`}
        </tbody>
      </table>

      <h3 style="font-family:var(--fonte-titulo);margin:40px 0 16px">Produtos mais vendidos</h3>
      <table class="tabela-admin">
        <thead><tr><th>Produto</th><th>Unidades vendidas</th></tr></thead>
        <tbody>
        ${topProdutos.map(([n, q]) => `<tr><td>${CCS.escapeHTML(n)}</td><td>${q}</td></tr>`).join("") || `<tr><td colspan="2">Sem dados.</td></tr>`}
        </tbody>
      </table>
    `;
  }

  document.getElementById("btn-filtrar").addEventListener("click", carregar);
  document.getElementById("btn-print").addEventListener("click", () => window.print());
  document.getElementById("btn-csv").addEventListener("click", () => {
    const linhas = [["Codigo", "Data", "Cliente", "WhatsApp", "Estado", "Total"]];
    dadosAtuais.forEach(o => {
      linhas.push([o.codigo, o.criado_em, o.nome_cliente, o.whatsapp, o.estado, o.total]);
    });
    const csv = linhas.map(l => l.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-ccs-${Date.now()}.csv`;
    a.click();
  });

  carregar();
})();