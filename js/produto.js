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
      .maybeSingle(); 

    if (error || !prod) {
      container.innerHTML = `<div style="text-align:center;padding:50px"><h2>Produto não encontrado</h2><a href="loja.html" class="btn btn-primario" style="margin-top:20px">Voltar à Loja</a></div>`;
      return;
    }

    const imgs = (prod.product_images || []).slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map(i => i.url);
    if (!imgs.length) imgs.push("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect fill='%231e1e1e' width='400' height='400'/%3E%3C/svg%3E");

    const temPromo = prod.preco_promocional != null && Number(prod.preco_promocional) < Number(prod.preco_original);
    const preco = temPromo ? prod.preco_promocional : prod.preco_original;
    const desconto = temPromo ? Math.round((1 - prod.preco_promocional / prod.preco_original) * 100) : 0;
    const esgotado = Number(prod.stock) <= 0;
    
    let caracteristicas = [];
    if (Array.isArray(prod.caracteristicas)) caracteristicas = prod.caracteristicas;
    else if (typeof prod.caracteristicas === 'string') caracteristicas = prod.caracteristicas.split('\n').filter(Boolean);

    container.innerHTML = `
      <div class="produto-layout">
        <div class="galeria">
          <div class="galeria-principal" id="galeria-principal">
            <!-- Setas para navegar -->
            <button class="galeria-seta seta-esq" id="seta-esq">❮</button>
            <button class="galeria-seta seta-dir" id="seta-dir">❯</button>
            
            <img src="${imgs[0]}" alt="${prod.nome}" id="img-principal">
          </div>
          <div class="galeria-thumbs" id="galeria-thumbs" style="margin-top:15px">
            ${imgs.map((u, i) => `
              <img src="${u}" data-src="${u}" class="${i === 0 ? "activa" : ""}" alt="Imagem ${i + 1}">
            `).join("")}
          </div>
        </div>

        <div class="produto-info">
          <p class="subtitulo" style="margin-bottom:6px">${prod.categories?.nome || "Loja"}</p>
          <h1>${prod.nome}</h1>
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

          <p class="produto-descricao">${prod.descricao || prod.descricao_curta || "Sem descrição disponível."}</p>

          <div class="compra-linha">
            <div class="qtd-control">
              <button id="qtd-menos">−</button>
              <input type="number" id="qtd" value="1" min="1" max="${Math.max(1, prod.stock)}" readonly />
              <button id="qtd-mais">+</button>
            </div>
            <button class="btn btn-secundario" id="btn-add" ${esgotado ? "disabled" : ""}>Adicionar ao Carrinho</button>
            <button class="btn btn-primario" id="btn-comprar" ${esgotado ? "disabled" : ""}>Comprar Agora</button>
          </div>

          ${caracteristicas.length ? `
            <h3 style="margin-top:30px;font-family:var(--fonte-titulo)">Especificações</h3>
            <ul class="caracteristicas-lista">
              ${caracteristicas.map(c => `<li>${c}</li>`).join("")}
            </ul>` : ""}
        </div>
      </div>

      <div class="relacionados" id="relacionados-wrap">
        <div class="cabecalho-seccao"><h2 class="titulo-seccao">Também podes <span class="dourado">gostar</span></h2><div class="linha-dourada centro"></div></div>
        <div class="grelha-produtos" id="relacionados"></div>
      </div>
    `;

    // Lógica da Galeria (Setas e Miniaturas)
    const principal = document.getElementById("img-principal");
    const thumbs = document.querySelectorAll("#galeria-thumbs img");
    let imgAtualIndex = 0;

    function mudarImagem(index) {
      if (index < 0) index = imgs.length - 1;
      if (index >= imgs.length) index = 0;
      
      imgAtualIndex = index;
      principal.src = imgs[index];
      
      thumbs.forEach((t, i) => {
        t.classList.toggle("activa", i === index);
      });
    }

    document.getElementById("seta-esq").addEventListener("click", (e) => { e.stopPropagation(); mudarImagem(imgAtualIndex - 1); });
    document.getElementById("seta-dir").addEventListener("click", (e) => { e.stopPropagation(); mudarImagem(imgAtualIndex + 1); });

    thumbs.forEach((t, i) => {
      t.addEventListener("click", () => mudarImagem(i));
    });

    // Zoom
    const wrapPrincipal = document.getElementById("galeria-principal");
    wrapPrincipal.addEventListener("click", (e) => {
      if (e.target.id !== 'seta-esq' && e.target.id !== 'seta-dir') {
        wrapPrincipal.classList.toggle("zoom");
      }
    });

    // Carrinho
    const qtdInput = document.getElementById("qtd");
    document.getElementById("qtd-menos").addEventListener("click", () => qtdInput.value = Math.max(1, Number(qtdInput.value) - 1));
    document.getElementById("qtd-mais").addEventListener("click", () => qtdInput.value = Math.min(Number(prod.stock), Number(qtdInput.value) + 1));

    const produtoParaCarrinho = { id: prod.id, nome: prod.nome, preco_original: prod.preco_original, preco_promocional: prod.preco_promocional, imagem_principal: imgs[0] };
    document.getElementById("btn-add").addEventListener("click", () => { CCS.adicionarAoCarrinho(produtoParaCarrinho, Number(qtdInput.value)); CCS.toast("Adicionado!", "sucesso"); });
    document.getElementById("btn-comprar").addEventListener("click", () => { CCS.adicionarAoCarrinho(produtoParaCarrinho, Number(qtdInput.value)); location.href = "carrinho.html"; });

    // Relacionados
    if (prod.categoria_id) {
      const { data: rel } = await window.sb.from("products").select(`id, nome, slug, descricao_curta, preco_original, preco_promocional, stock, product_images(url, ordem)`).eq("activo", true).eq("categoria_id", prod.categoria_id).neq("id", prod.id).limit(4);
      if (rel && rel.length) {
        const relFormatados = rel.map(p => ({ ...p, imagem_principal: (p.product_images || [])[0]?.url, categoria_nome: prod.categories?.nome }));
        window.CCS_loja.renderGrelha(relFormatados, document.getElementById("relacionados"));
      } else { document.getElementById("relacionados-wrap").style.display = "none"; }
    } else { document.getElementById("relacionados-wrap").style.display = "none"; }
  }
  carregar().catch(console.error);
})();