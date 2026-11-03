/**
 * PRODUTO.JS — galeria, zoom, add ao carrinho, relacionados.
 */
(function () {
  const container = document.getElementById("produto-container");
  if (!container) return;

  async function carregar() {
    const slug = new URLSearchParams(location.search).get("slug");
    if (!slug) { container.innerHTML = `<p style="text-align:center">Produto não especificado.</p>`; return; }

    const { data: prod, error } = await window.sb
      .from("products")
      .select(`
        id, nome, slug, descricao, descricao_curta, caracteristicas,
        preco_original, preco_promocional, stock, activo, categoria_id,
        categories ( nome ),
        product_images ( url, ordem )
      `)
      .eq("slug", slug)
      .eq("activo", true)
      .maybeSingle();

    if (error || !prod) {
      container.innerHTML = `<p style="text-align:center;color:#ff5252">Produto não encontrado.</p>`;
      return;
    }

    const imgs = (prod.product_images || []).slice()
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
      .map(i => i.url);
    if (!imgs.length) imgs.push("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect fill='%231e1e1e' width='400' height='400'/%3E%3C/svg%3E");

    const temPromo = prod.preco_promocional != null && Number(prod.preco_promocional) < Number(prod.preco_original);
    const preco = temPromo ? prod.preco_promocional : prod.preco_original;
    const desconto = temPromo ? Math.round((1 - prod.preco_promocional / prod.preco_original) * 100) : 0;
    const esgotado = Number(prod.stock) <= 0;
    const caracteristicas = Array.isArray(prod.caracteristicas)
      ? prod.caracteristicas
      : (typeof prod.caracteristicas === "string" ? prod.caracteristicas.split("\n").filter(Boolean) : []);

    container.innerHTML = `
      <div class="produto-layout">
        <div class="galeria reveal">
          <div class="galeria-principal" id="galeria-principal">
            <img src="${CCS.escapeHTML(imgs[0])}" alt="${CCS.escapeHTML(prod.nome)}" id="img-principal">
          </div>
          <div class="galeria-thumbs" id="galeria-thumbs">
            ${imgs.map((u, i) => `
              <img src="${CCS.escapeHTML(u)}" data-src="${CCS.escapeHTML(u)}"
                   class="${i === 0 ? "activa" : ""}" alt="Imagem ${i + 1}">
            `).join("")}
          </div>
        </div>

        <div class="produto-info reveal reveal-delay-1">
          <p class="subtitulo" style="margin-bottom:6px">${CCS.escapeHTML(prod.categories?.nome || "Loja")}</p>
          <h1>${CCS.escapeHTML(prod.nome)}</h1>
          <div class="linha-dourada"></div>

          <div class="produto-precos">
            <span class="produto-preco-promo">${CCS.formatarPreco(preco)}</span>
            ${temPromo ? `<span class="produto-preco-original">${CCS.formatarPreco(prod.preco_original)}</span>
                          <span class="produto-desconto-badge">-${desconto}%</span>` : ""}
          </div>

          <div class="stock-info ${esgotado ? "esgotado" : "disponivel"}">
            <span class="dot"></span>
            ${esgotado ? "Esgotado" : `Em stock · ${prod.stock} unidades`}
          </div>

          <p class="produto-descricao">${CCS.escapeHTML(prod.descricao || prod.descricao_curta || "")}</p>

          <div class="compra-linha">
            <div class="qtd-control">
              <button id="qtd-menos">−</button>
              <input type="number" id="qtd" value="1" min="1" max="${Math.max(1, prod.stock)}" />
              <button id="qtd-mais">+</button>
            </div>
            <button class="btn btn-secundario" id="btn-add" ${esgotado ? "disabled" : ""}>Adicionar ao Carrinho</button>
            <button class="btn btn-primario" id="btn-comprar" ${esgotado ? "disabled" : ""}>Comprar Agora</button>
          </div>

          ${caracteristicas.length ? `
            <h3 style="margin-top:30px;font-family:var(--fonte-titulo)">Características</h3>
            <ul class="caracteristicas-lista">
              ${caracteristicas.map(c => `<li>${CCS.escapeHTML(c)}</li>`).join("")}
            </ul>` : ""}
        </div>
      </div>

      <div class="relacionados" id="relacionados-wrap">
        <div class="cabecalho-seccao"><h2 class="titulo-seccao">Também podes <span class="dourado">gostar</span></h2><div class="linha-dourada centro"></div></div>
        <div class="grelha-produtos" id="relacionados"></div>
      </div>
    `;

    // ----- Galeria: thumbs + zoom -----
    const principal = document.getElementById("img-principal");
    const wrap = document.getElementById("galeria-principal");
    wrap.addEventListener("click", () => wrap.classList.toggle("zoom"));
    document.querySelectorAll("#galeria-thumbs img").forEach(t => {
      t.addEventListener("click", () => {
        document.querySelectorAll("#galeria-thumbs img").forEach(x => x.classList.remove("activa"));
        t.classList.add("activa");
        principal.src = t.dataset.src;
        wrap.classList.remove("zoom");
      });
    });

    // ----- Quantidade -----
    const qtdInput = document.getElementById("qtd");
    document.getElementById("qtd-menos").addEventListener("click", () => {
      qtdInput.value = Math.max(1, Number(qtdInput.value) - 1);
    });
    document.getElementById("qtd-mais").addEventListener("click", () => {
      qtdInput.value = Math.min(Number(prod.stock), Number(qtdInput.value) + 1);
    });

    // ----- Add / Comprar -----
    const produtoParaCarrinho = {
      id: prod.id, nome: prod.nome,
      preco_original: prod.preco_original,
      preco_promocional: prod.preco_promocional,
      imagem_principal: imgs[0]
    };
    document.getElementById("btn-add").addEventListener("click", () => {
      CCS.adicionarAoCarrinho(produtoParaCarrinho, Number(qtdInput.value));
      CCS.toast("Adicionado ao carrinho!", "sucesso");
    });
    document.getElementById("btn-comprar").addEventListener("click", () => {
      CCS.adicionarAoCarrinho(produtoParaCarrinho, Number(qtdInput.value));
      location.href = "carrinho.html";
    });

    // ----- Relacionados -----
    carregarRelacionados(prod.categoria_id, prod.id);
  }

  async function carregarRelacionados(catId, excluirId) {
    const wrap = document.getElementById("relacionados-wrap");
    if (!catId) { wrap.remove(); return; }

    const { data } = await window.sb.from("products")
      .select(`id, nome, slug, descricao_curta, preco_original, preco_promocional, stock,
               categories(nome), product_images(url, ordem)`)
      .eq("activo", true)
      .eq("categoria_id", catId)
      .neq("id", excluirId)
      .limit(4);

    if (!data || !data.length) { wrap.remove(); return; }

    const produtos = data.map(p => ({
      ...p,
      imagem_principal: (p.product_images || []).sort((a, b) => (a.ordem || 0) - (b.ordem || 0))[0]?.url,
      categoria_nome: p.categories?.nome
    }));
    window.CCS_loja.renderGrelha(produtos, document.getElementById("relacionados"));
  }

  carregar().catch(err => {
    console.error(err);
    container.innerHTML = `<p style="text-align:center;color:#ff5252">Erro ao carregar produto.</p>`;
  });
})();