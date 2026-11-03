/**
 * CARRINHO.JS
 * Render do carrinho, cálculo de totais, criação do pedido no Supabase,
 * redireccionamento para WhatsApp.
 */
(function () {
  const wrap = document.getElementById("carrinho-wrap");
  if (!wrap) return;

  const KEY_CLIENTE = "ccs_cliente_info";

  function renderizar() {
    const carrinho = CCS.getCarrinho();
    if (!carrinho.length) {
      wrap.innerHTML = `
        <div class="carrinho-vazio reveal">
          <h3>O teu carrinho está vazio</h3>
          <p>Adiciona produtos para continuar.</p>
          <a href="loja.html" class="btn btn-primario">Ir para a Loja</a>
        </div>`;
      return;
    }

    const subtotal = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);
    const infoGuardada = JSON.parse(localStorage.getItem(KEY_CLIENTE) || "{}");

    wrap.innerHTML = `
      <div class="carrinho-layout">
        <div class="carrinho-itens reveal">
          ${carrinho.map(i => `
            <div class="item-carrinho" data-id="${i.id}">
              ${i.imagem
                ? `<img src="${CCS.escapeHTML(i.imagem)}" alt="${CCS.escapeHTML(i.nome)}">`
                : `<div style="width:90px;height:90px;background:var(--cinza);border-radius:10px"></div>`}
              <div>
                <h4>${CCS.escapeHTML(i.nome)}</h4>
                <div class="preco">${CCS.formatarPreco(i.preco)}</div>
              </div>
              <div class="item-acoes">
                <div class="qtd-mini">
                  <button data-acao="menos">−</button>
                  <span>${i.quantidade}</span>
                  <button data-acao="mais">+</button>
                </div>
                <button class="remover" data-acao="remover">Remover</button>
              </div>
            </div>
          `).join("")}
        </div>

        <aside class="resumo reveal reveal-delay-1">
          <h3>Resumo</h3>
          <div class="resumo-linha"><span>Subtotal</span><span>${CCS.formatarPreco(subtotal)}</span></div>
          <div class="resumo-linha"><span>Desconto fidelização</span><span id="desconto-fidelizacao">—</span></div>
          <div class="resumo-linha total"><span>Total</span><span class="valor" id="total-final">${CCS.formatarPreco(subtotal)}</span></div>

          <div class="campo-cliente">
            <label>Nome completo</label>
            <input type="text" id="cli-nome" placeholder="O teu nome" value="${CCS.escapeHTML(infoGuardada.nome || "")}" />
          </div>
          <div class="campo-cliente">
            <label>WhatsApp</label>
            <input type="tel" id="cli-whatsapp" placeholder="258XXXXXXXXX" value="${CCS.escapeHTML(infoGuardada.whatsapp || "")}" />
          </div>

          <button class="btn btn-primario btn-grande" id="btn-finalizar">
            Finalizar Pedido via WhatsApp
          </button>
          <a href="loja.html" class="btn btn-secundario" style="margin-top:8px">Continuar a comprar</a>
        </aside>
      </div>
    `;

    ligarEventos();
    atualizarDesconto(subtotal);
  }

  async function atualizarDesconto(subtotal) {
    // Mostra desconto estimado (valor real é calculado no servidor)
    const wa = document.getElementById("cli-whatsapp")?.value;
    try {
      const hist = await window.CCS_Fidelizacao.obterHistorico(wa);
      const nivel = window.CCS_Fidelizacao.calcularNivel(hist.total_compras || 0);
      const valorDesconto = subtotal * (nivel.desconto / 100);
      document.getElementById("desconto-fidelizacao").textContent =
        nivel.desconto > 0
          ? `-${nivel.desconto}% (${CCS.formatarPreco(valorDesconto)})`
          : "Primeira compra";
      document.getElementById("total-final").textContent = CCS.formatarPreco(subtotal - valorDesconto);
    } catch {
      document.getElementById("desconto-fidelizacao").textContent = "—";
    }
  }

  function ligarEventos() {
    wrap.querySelectorAll(".item-carrinho").forEach(el => {
      const id = el.dataset.id;
      el.querySelectorAll("[data-acao]").forEach(btn => {
        btn.addEventListener("click", () => {
          const carrinho = CCS.getCarrinho();
          const idx = carrinho.findIndex(x => String(x.id) === String(id));
          if (idx < 0) return;
          const acao = btn.dataset.acao;
          if (acao === "mais") carrinho[idx].quantidade++;
          if (acao === "menos") {
            carrinho[idx].quantidade--;
            if (carrinho[idx].quantidade <= 0) carrinho.splice(idx, 1);
          }
          if (acao === "remover") carrinho.splice(idx, 1);
          CCS.setCarrinho(carrinho);
          renderizar();
        });
      });
    });

    document.getElementById("cli-whatsapp").addEventListener("blur", () => {
      const subtotal = CCS.getCarrinho().reduce((s, i) => s + i.preco * i.quantidade, 0);
      atualizarDesconto(subtotal);
    });

    document.getElementById("btn-finalizar").addEventListener("click", finalizarPedido);
  }

  async function finalizarPedido() {
    const nome = document.getElementById("cli-nome").value.trim();
    const whatsapp = document.getElementById("cli-whatsapp").value.trim().replace(/\D/g, "");
    if (!nome || whatsapp.length < 9) {
      CCS.toast("Preenche o nome e um WhatsApp válido.", "erro");
      return;
    }

    const carrinho = CCS.getCarrinho();
    if (!carrinho.length) return;

    const clientId = CCS.getClientId();
    localStorage.setItem(KEY_CLIENTE, JSON.stringify({ nome, whatsapp }));
    // Guardar também para o sistema de notificações
localStorage.setItem("ccs_cliente_info", JSON.stringify({ nome, whatsapp }));

    const subtotal = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);
    const codigo = CCS.gerarCodigoPedido();
    const btn = document.getElementById("btn-finalizar");
    btn.disabled = true; btn.textContent = "A processar…";

    try {
      /**
       * CHAMADA À EDGE FUNCTION "criar-pedido"
       * O servidor valida:
       *  - stock actual
       *  - preços reais (nunca os do navegador)
       *  - desconto de fidelização
       *  - cria customer se não existir
       *  - cria order + order_items
       *  - devolve { codigo, total, desconto, linhas }
       */
      const { data, error } = await window.sb.functions.invoke("criar-pedido", {
  body: {
    codigo,
    client_id: clientId,
    nome, whatsapp,
    itens: carrinho.map(i => ({ produto_id: i.id, quantidade: i.quantidade })),
    token_cliente: window.CCS_Cliente?.getToken() || null  // ← NOVO
  }
});

      if (error) throw error;
      if (!data || !data.ok) throw new Error(data?.erro || "Falha ao criar pedido");

      // Montar mensagem WhatsApp
      const linhas = data.linhas.map(l =>
        `• ${l.nome} × ${l.quantidade} — ${CCS.formatarPreco(l.subtotal)}`
      ).join("\n");

      const msg = `Olá CLEYTON CASANOVA STORE!%0A%0A` +
        `*NOVO PEDIDO* — ${data.codigo}%0A` +
        `*Cliente:* ${encodeURIComponent(nome)}%0A` +
        `*WhatsApp:* ${encodeURIComponent(whatsapp)}%0A%0A` +
        `*Produtos:*%0A${encodeURIComponent(linhas)}%0A%0A` +
        `*Subtotal:* ${encodeURIComponent(CCS.formatarPreco(data.subtotal))}%0A` +
        (data.desconto_percent > 0
          ? `*Desconto fidelização (${data.desconto_percent}%):* -${encodeURIComponent(CCS.formatarPreco(data.desconto_valor))}%0A`
          : "") +
        `*Total:* ${encodeURIComponent(CCS.formatarPreco(data.total))}%0A%0A` +
        `Aguardo confirmação. Obrigado!`;

      CCS.limparCarrinho();
      window.open(CCS.linkWhatsApp(decodeURIComponent(msg.replace(/%0A/g, "\n"))), "_blank");
      CCS.toast("Pedido criado! A abrir WhatsApp…", "sucesso");
      setTimeout(() => location.href = "loja.html", 1500);
    } catch (err) {
      console.error(err);
      CCS.toast("Erro ao criar pedido: " + (err.message || "tenta novamente"), "erro");
      btn.disabled = false; btn.textContent = "Finalizar Pedido via WhatsApp";
    }
  }

  renderizar();
})();