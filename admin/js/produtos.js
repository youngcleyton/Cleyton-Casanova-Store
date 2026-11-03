(async function () {
  await new Promise(r => setTimeout(r, 400));
  const { data: { session } } = await window.sb.auth.getSession();
  if (!session) return;

  const container = document.getElementById("tabela-produtos");
  const modal = document.getElementById("modal-produto");
  const form = document.getElementById("form-produto");
  let categorias = [];
  let produtos = [];
  let imagensNova = []; // { url, id? }

  // ---------- Carregar categorias ----------
  async function carregarCategorias() {
    const { data } = await window.sb.from("categories").select("*").order("nome");
    categorias = data || [];
    document.getElementById("prod-categoria").innerHTML = categorias.map(c =>
      `<option value="${c.id}">${CCS.escapeHTML(c.nome)}</option>`).join("") ||
      `<option value="">— sem categorias —</option>`;
  }

  // ---------- Carregar produtos ----------
  async function carregarProdutos() {
    const { data, error } = await window.sb.from("products")
      .select(`*, categories(nome), product_images(id, url, ordem)`)
      .order("criado_em", { ascending: false });
    if (error) { container.innerHTML = "Erro: " + error.message; return; }
    produtos = data || [];
    renderTabela();
  }

  function renderTabela() {
    if (!produtos.length) { container.innerHTML = "<p>Sem produtos. Cria o primeiro.</p>"; return; }
    container.innerHTML = `
      <table class="tabela-admin">
        <thead><tr>
          <th>Produto</th><th>Categoria</th><th>Preço</th><th>Promo</th><th>Stock</th><th>Estado</th><th>Ações</th>
        </tr></thead>
        <tbody>
          ${produtos.map(p => `
            <tr>
              <td><strong>${CCS.escapeHTML(p.nome)}</strong><br><small style="color:var(--cinza-texto)">${CCS.escapeHTML(p.slug)}</small></td>
              <td>${CCS.escapeHTML(p.categories?.nome || "—")}</td>
              <td>${CCS.formatarPreco(p.preco_original)}</td>
              <td>${p.preco_promocional != null ? CCS.formatarPreco(p.preco_promocional) : "—"}</td>
              <td>${p.stock}</td>
              <td>${p.activo ? `<span class="estado-tag confirmado">activo</span>` : `<span class="estado-tag cancelado">inactivo</span>`}</td>
              <td>
                <button class="btn btn-secundario" style="padding:6px 12px;font-size:.75rem" data-editar="${p.id}">Editar</button>
                <button class="btn btn-secundario" style="padding:6px 12px;font-size:.75rem;color:#ff5252;border-color:#ff5252" data-eliminar="${p.id}">Eliminar</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;

    container.querySelectorAll("[data-editar]").forEach(b => b.addEventListener("click", () => abrirModal(b.dataset.editar)));
    container.querySelectorAll("[data-eliminar]").forEach(b => b.addEventListener("click", async () => {
      if (!confirm("Eliminar este produto e as suas imagens?")) return;
      const { error } = await window.sb.from("products").delete().eq("id", b.dataset.eliminar);
      if (error) { CCS.toast("Erro: " + error.message, "erro"); return; }
      CCS.toast("Produto eliminado", "sucesso");
      carregarProdutos();
    }));
  }

  // ---------- Abrir modal ----------
  async function abrirModal(id = null) {
    form.reset();
    imagensNova = [];
    document.getElementById("prod-imagens-prev").innerHTML = "";
    document.getElementById("modal-titulo").textContent = id ? "Editar Produto" : "Novo Produto";
    document.getElementById("prod-id").value = "";

    if (id) {
      const p = produtos.find(x => x.id === id);
      if (!p) return;
      document.getElementById("prod-id").value = p.id;
      document.getElementById("prod-nome").value = p.nome;
      document.getElementById("prod-slug").value = p.slug;
      document.getElementById("prod-categoria").value = p.categoria_id || "";
      document.getElementById("prod-stock").value = p.stock;
      document.getElementById("prod-preco").value = p.preco_original;
      document.getElementById("prod-promo").value = p.preco_promocional ?? "";
      document.getElementById("prod-curta").value = p.descricao_curta || "";
      document.getElementById("prod-descricao").value = p.descricao || "";
      document.getElementById("prod-carac").value = (p.caracteristicas || []).join("\n");
      document.getElementById("prod-activo").value = String(p.activo);
      imagensNova = (p.product_images || []).sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        .map(i => ({ url: i.url, id: i.id }));
      renderPrevImagens();
    }
    modal.classList.add("aberto");
  }

  function renderPrevImagens() {
    document.getElementById("prod-imagens-prev").innerHTML = imagensNova.map((img, i) => `
      <div class="prev">
        <img src="${CCS.escapeHTML(img.url)}" alt="">
        <button type="button" data-rem-img="${i}">×</button>
      </div>
    `).join("");
    document.querySelectorAll("[data-rem-img]").forEach(b => b.addEventListener("click", () => {
      imagensNova.splice(Number(b.dataset.remImg), 1);
      renderPrevImagens();
    }));
  }

  // ---------- Upload de imagens ----------
  document.getElementById("prod-imagens-input").addEventListener("change", async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    CCS.toast("A carregar imagens…");
    for (const file of files) {
      try {
        const url = await window.CCS_uploadImagem(file, "produtos");
        imagensNova.push({ url });
        renderPrevImagens();
      } catch (err) {
        CCS.toast("Falha ao carregar: " + err.message, "erro");
      }
    }
    e.target.value = "";
  });

  // ---------- Slug automático ----------
  document.getElementById("prod-nome").addEventListener("input", (e) => {
    const slugField = document.getElementById("prod-slug");
    if (!slugField.dataset.touched) {
      slugField.value = e.target.value.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
  });
  document.getElementById("prod-slug").addEventListener("input", (e) => {
    e.target.dataset.touched = "1";
  });

  // ---------- Guardar ----------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("prod-id").value;
    const payload = {
      nome: document.getElementById("prod-nome").value.trim(),
      slug: document.getElementById("prod-slug").value.trim(),
      categoria_id: document.getElementById("prod-categoria").value || null,
      stock: Number(document.getElementById("prod-stock").value),
      preco_original: Number(document.getElementById("prod-preco").value),
      preco_promocional: document.getElementById("prod-promo").value ? Number(document.getElementById("prod-promo").value) : null,
      descricao_curta: document.getElementById("prod-curta").value.trim() || null,
      descricao: document.getElementById("prod-descricao").value.trim() || null,
      caracteristicas: document.getElementById("prod-carac").value.split("\n").map(s => s.trim()).filter(Boolean),
      activo: document.getElementById("prod-activo").value === "true"
    };

    let prodId = id;
    if (id) {
      const { error } = await window.sb.from("products").update(payload).eq("id", id);
      if (error) { CCS.toast("Erro: " + error.message, "erro"); return; }
    } else {
      const { data, error } = await window.sb.from("products").insert(payload).select("id").single();
      if (error) { CCS.toast("Erro: " + error.message, "erro"); return; }
      prodId = data.id;
    }

    // Sincronizar imagens: apagar todas e reinserir (simples e seguro)
    await window.sb.from("product_images").delete().eq("product_id", prodId);
    if (imagensNova.length) {
      const inserts = imagensNova.map((img, i) => ({
        product_id: prodId, url: img.url, ordem: i
      }));
      const { error: imgErr } = await window.sb.from("product_images").insert(inserts);
      if (imgErr) CCS.toast("Aviso imagens: " + imgErr.message, "erro");
    }

    CCS.toast("Produto guardado!", "sucesso");
    modal.classList.remove("aberto");
    carregarProdutos();
  });

  document.getElementById("btn-novo").addEventListener("click", () => abrirModal());

  // Init
  await carregarCategorias();
  await carregarProdutos();
})();