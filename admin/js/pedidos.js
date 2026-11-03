// admin/js/pedidos.js
(async function () {
  await new Promise(r => setTimeout(r, 400));
  const { data: { session } } = await window.sb.auth.getSession();
  if (!session) return;

  const container = document.getElementById("tabela-pedidos");
  const filtro = document.getElementById("filtro-estado");
  const modal = document.getElementById("modal-pedido");
  const modalBox = document.getElementById("modal-pedido-box");
  let pedidos = [];

  async function carregar() {
    let q = window.sb.from("orders")
      .select(`*, order_items(*)`)
      .order("criado_em", { ascending: false });
    if (filtro.value) q = q.eq("estado", filtro.value);
    const { data, error } = await q;
    if (error) { container.innerHTML = "Erro: " + error.message; return; }
    pedidos = data || [];
    render();
  }

  function render() {
    if (!pedidos.length) { container.innerHTML = "<p>Sem pedidos.</p>"; return; }
    container.innerHTML = `
      <table class="tabela-admin">
        <thead><tr>
          <th>Código</th><th>Cliente</th><th>WhatsApp</th><th>Total</th><th>Estado</th><th>Data</th><th>Ações</th>
        </tr></thead>
        <tbody>
        ${pedidos.map(p => `
          <tr>
            <td><strong>${CCS.escapeHTML(p.codigo)}</strong></td>
            <td>${CCS.escapeHTML(p.nome_cliente)}</td>
            <td>${CCS.escapeHTML(p.whatsapp)}</td>
            <td>${CCS.formatarPreco(p.total)}</td>
            <td><span class="estado-tag ${p.estado}">${p.estado}</span></td>
            <td>${new Date(p.criado_em).toLocaleString("pt-PT")}</td>
            <td>
              <button class="btn btn-secundario" style="padding:6px 12px;font-size:.75rem" data-ver="${p.id}">Ver</button>
              <select data-estado="${p.id}" style="padding:4px 8px;background:var(--cinza);border:1px solid var(--cinza-linha);border-radius:6px;color:var(--branco);font-size:.75rem">
                <option value="pendente" ${p.estado==="pendente"?"selected":""}>pendente</option>
                <option value="confirmado" ${p.estado==="confirmado"?"selected":""}>confirmado</option>
                <option value="concluido" ${p.estado==="concluido"?"selected":""}>concluído</option>
                <option value="cancelado" ${p.estado==="cancelado"?"selected":""}>cancelado</option>
              </select>
            </td>
          </tr>
        `).join("")}
        </tbody>
      </table>`;

    container.querySelectorAll("[data-ver]").forEach(b =>
      b.addEventListener("click", () => verPedido(b.dataset.ver)));

    container.querySelectorAll("[data-estado]").forEach(sel =>
      sel.addEventListener("change", async () => {
        const id = sel.dataset.estado;
        const novo = sel.value;
        const { error } = await window.sb.from("orders").update({ estado: novo }).eq("id", id);
        if (error) { CCS.toast("Erro: " + error.message, "erro"); return; }
        CCS.toast("Estado actualizado: " + novo, "sucesso");
        carregar();
      }));
  }

  function verPedido(id) {
    const p = pedidos.find(x => x.id === id);
    if (!p) return;
    const linhas = (p.order_items || []).map(i => `
      <tr>
        <td>${CCS.escapeHTML(i.nome_produto)}</td>
        <td>${i.quantidade}</td>
        <td>${CCS.formatarPreco(i.preco_unitario)}</td>
        <td>${CCS.formatarPreco(i.subtotal)}</td>
      </tr>`).join("");
    modalBox.innerHTML = `
      <h2>Pedido ${CCS.escapeHTML(p.codigo)}</h2>
      <p style="color:var(--cinza-texto);margin-bottom:10px">
        <strong>${CCS.escapeHTML(p.nome_cliente)}</strong> · ${CCS.escapeHTML(p.whatsapp)}<br>
        ${new Date(p.criado_em).toLocaleString("pt-PT")} · Estado: <span class="estado-tag ${p.estado}">${p.estado}</span>
      </p>
      <table class="tabela-admin" style="margin-top:16px">
        <thead><tr><th>Produto</th><th>Qtd</th><th>Preço</th><th>Subtotal</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      <div style="margin-top:20px;text-align:right">
        <p>Subtotal: ${CCS.formatarPreco(p.subtotal)}</p>
        <p>Desconto (${p.desconto_percent}%): -${CCS.formatarPreco(p.desconto_valor)}</p>
        <p style="font-size:1.2rem;color:var(--dourado);font-weight:700">Total: ${CCS.formatarPreco(p.total)}</p>
      </div>
      <div style="margin-top:20px;display:flex;gap:10px">
        <a href="${CCS.linkWhatsApp(`Olá ${p.nome_cliente}! O teu pedido ${p.codigo} está a ser processado.`)}" target="_blank" class="btn btn-primario" style="flex:1">Contactar cliente</a>
        <button class="btn btn-secundario" onclick="document.getElementById('modal-pedido').classList.remove('aberto')">Fechar</button>
      </div>`;
    modal.classList.add("aberto");
  }

  filtro.addEventListener("change", carregar);
  document.getElementById("btn-refresh").addEventListener("click", carregar);
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("aberto"); });

  carregar();
})();