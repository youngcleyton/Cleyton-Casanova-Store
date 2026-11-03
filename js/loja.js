/**
 * LOJA.JS — leitura de produtos, filtros, pesquisa, renderização.
 * Depende de: config.js, supabase.js, app.js
 */
(function () {
  // ---------- CARREGAR PRODUTOS ----------
  async function carregarProdutos(filtros = {}) {
    let q = window.sb
      .from("products")
      .select(`
        id, nome, slug, descricao_curta, preco_original, preco_promocional,
        stock, activo, categoria_id,
        categories ( id, nome ),
        product_images ( url, ordem )
      `)
      .eq("activo", true)
      .order("criado_em", { ascending: false });

    if (filtros.categoria) q = q.eq("categoria_id", filtros.categoria);
    if (filtros.disponivel === true) q = q.gt("stock", 0);
    if (filtros.disponivel === false) q = q.lte("stock", 0);
    if (filtros.precoMax) q = q.lte("preco_original", filtros.precoMax);

    const { data, error } = await q;
    if (error) { console.error(error); throw error; }

    return (data || []).map(p => {
      const imgs = (p.product_images || []).slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      return {
        ...p,
        imagem_principal: imgs[0]?.url || null,
        categoria_nome: p.categories?.nome || "Geral"
      };
    });
  }

  // ---------- RENDER: CARD ----------
  function cardProdutoHTML(p) {
    const temPromo = p.preco_promocional != null && Number(p.preco_promocional) < Number(p.preco_original);
    const preco = temPromo ? p.preco_promocional : p.preco_original;
    const desconto = temPromo
      ? Math.round((1 - Number(p.preco_promocional) / Number(p.preco_original)) * 100)
      : 0;
    const esgotado = Number(p.stock) <= 0;

    return `
      <article class="card-produto reveal" data-id="${p.id}">
        <a href="produto.html?slug=${encodeURIComponent(p.slug)}" class="img-wrap">
          ${p.imagem_principal
            ? `<img src="${CCS.escapeHTML(p.imagem_principal)}" alt="${CCS.escapeHTML(p.nome)}" loading="lazy">`
            : `<div style="width:100%;height:100%;background:var(--cinza)"></div>`}
          ${temPromo && !esgotado ? `<span class="desconto-tag">-${desconto}%</span>` : ""}
          ${esgotado ? `<div class="esgotado-tag">Esgotado</div>` : ""}
        </a>
        <div class="info">
          <h3>${CCS.escapeHTML(p.nome)}</h3>
          <p style="color:var(--cinza-texto);font-size:.85rem;margin-bottom:10px">
            ${CCS.escapeHTML((p.descricao_curta || "").slice(0, 80))}
          </p>
          <div class="precos">
            <span class="preco-promo">${CCS.formatarPreco(preco)}</span>
            ${temPromo ? `<span class="preco-original">${CCS.formatarPreco(p.preco_original)}</span>` : ""}
          </div>
          <div class="card-acoes">
            <button class="btn btn-secundario btn-add" data-id="${p.id}" ${esgotado ? "disabled" : ""}>
              + Carrinho
            </button>
            <a href="produto.html?slug=${encodeURIComponent(p.slug)}" class="btn btn-primario">Ver</a>
          </div>
        </div>
      </article>`;
  }

  // ---------- RENDER: GRELHA ----------
  function renderGrelha(produtos, container) {
    if (!produtos.length) {
      container.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--cinza-texto)">Nenhum produto encontrado.</p>`;
      return;
    }
    container.innerHTML = produtos.map(cardProdutoHTML).join("");

    // Animação reveal
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visivel"); obs.unobserve(e.target); } });
    }, { threshold: 0.1 });
    container.querySelectorAll(".reveal").forEach(el => obs.observe(el));

    // Add ao carrinho
    container.querySelectorAll(".btn-add").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const id = btn.dataset.id;
        const prod = produtos.find(x => String(x.id) === String(id));
        if (!prod) return;
        CCS.adicionarAoCarrinho(prod, 1);
        CCS.toast(`"${prod.nome}" adicionado ao carrinho`, "sucesso");
        btn.textContent = "✓ Adicionado";
        setTimeout(() => (btn.textContent = "+ Carrinho"), 1200);
      });
    });
  }

  // ---------- HOME: DESTAQUES ----------
  document.addEventListener("DOMContentLoaded", async () => {
    const dest = document.getElementById("produtos-destaque");
    if (dest) {
      try {
        const produtos = await carregarProdutos();
        renderGrelha(produtos.slice(0, 6), dest);
      } catch (e) {
        dest.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#ff5252">Erro ao carregar. Verifica js/config.js.</p>`;
      }
    }

    // ---------- LOJA.HTML: FILTROS + PESQUISA ----------
    const grelhaLoja = document.getElementById("loja-grelha");
    if (grelhaLoja) {
      let todos = [];
      try {
        todos = await carregarProdutos();
      } catch (e) {
        grelhaLoja.innerHTML = `<p style="color:#ff5252">Erro ao carregar produtos.</p>`;
        return;
      }

      // Categorias dinâmicas
      const selectCat = document.getElementById("filtro-categoria");
      if (selectCat) {
        const cats = [...new Set(todos.map(p => p.categoria_nome).filter(Boolean))];
        selectCat.innerHTML = `<option value="">Todas as categorias</option>` +
          cats.map(c => `<option value="${CCS.escapeHTML(c)}">${CCS.escapeHTML(c)}</option>`).join("");
      }

      const pesquisa = document.getElementById("pesquisa");
      const precoMax = document.getElementById("filtro-preco");
      const disp = document.getElementById("filtro-disponivel");

      function aplicarFiltros() {
        let res = [...todos];
        const termo = (pesquisa?.value || "").trim().toLowerCase();
        if (termo) res = res.filter(p =>
          p.nome.toLowerCase().includes(termo) ||
          (p.descricao_curta || "").toLowerCase().includes(termo));
        if (selectCat?.value) res = res.filter(p => p.categoria_nome === selectCat.value);
        if (precoMax?.value) res = res.filter(p => Number(p.preco_original) <= Number(precoMax.value));
        if (disp?.value === "1") res = res.filter(p => Number(p.stock) > 0);
        if (disp?.value === "0") res = res.filter(p => Number(p.stock) <= 0);
        renderGrelha(res, grelhaLoja);
      }

      [pesquisa, selectCat, precoMax, disp].forEach(el => {
        if (el) el.addEventListener("input", aplicarFiltros);
      });

      renderGrelha(todos, grelhaLoja);
    }
  });

  // ---------- EXPORTAR para produto.html ----------
  window.CCS_loja = { carregarProdutos, renderGrelha, cardProdutoHTML };
})();