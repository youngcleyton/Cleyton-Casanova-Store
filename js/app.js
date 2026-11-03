/**
 * APP.JS — utilitários globais partilhados por todas as páginas
 */
const CCS = {
  // ---------- FORMATAÇÃO ----------
  formatarPreco(valor) {
    const n = Number(valor || 0);
    return new Intl.NumberFormat("pt-MZ", {
      style: "currency", currency: CCS_CONFIG.CURRENCY, minimumFractionDigits: 2
    }).format(n);
  },

  // ---------- CLIENTE LOCAL (fidelização) ----------
  getClientId() {
    let id = localStorage.getItem(CCS_CONFIG.LOCAL_CLIENT_ID_KEY);
    if (!id) {
      id = "cli_" + crypto.randomUUID();
      localStorage.setItem(CCS_CONFIG.LOCAL_CLIENT_ID_KEY, id);
    }
    return id;
  },

  // ---------- CARRINHO ----------
  getCarrinho() {
    try { return JSON.parse(localStorage.getItem(CCS_CONFIG.CART_KEY)) || []; }
    catch { return []; }
  },
  setCarrinho(carrinho) {
    localStorage.setItem(CCS_CONFIG.CART_KEY, JSON.stringify(carrinho));
    CCS.actualizarBadgeCarrinho();
  },
  adicionarAoCarrinho(produto, quantidade = 1) {
    const carrinho = CCS.getCarrinho();
    const existente = carrinho.find(i => i.id === produto.id);
    if (existente) {
      existente.quantidade += quantidade;
    } else {
      carrinho.push({
        id: produto.id, nome: produto.nome,
        preco: Number(produto.preco_promocional ?? produto.preco_original),
        preco_original: Number(produto.preco_original),
        imagem: produto.imagem_principal || null,
        quantidade
      });
    }
    CCS.setCarrinho(carrinho);
  },
  removerDoCarrinho(id) {
    CCS.setCarrinho(CCS.getCarrinho().filter(i => i.id !== id));
  },
  limparCarrinho() { CCS.setCarrinho([]); },

  actualizarBadgeCarrinho() {
    const total = CCS.getCarrinho().reduce((s, i) => s + i.quantidade, 0);
    document.querySelectorAll(".nav-carrinho .badge").forEach(b => {
      b.textContent = total;
      b.classList.toggle("vazio", total === 0);
    });
  },

  // ---------- TOASTS ----------
  toast(mensagem, tipo = "info") {
    let cont = document.querySelector(".toast-container");
    if (!cont) {
      cont = document.createElement("div");
      cont.className = "toast-container";
      document.body.appendChild(cont);
    }
    const el = document.createElement("div");
    el.className = `toast ${tipo}`;
    el.textContent = mensagem;
    cont.appendChild(el);
    setTimeout(() => {
      el.classList.add("saindo");
      setTimeout(() => el.remove(), 320);
    }, 3800);
  },

  // ---------- WHATSAPP ----------
  linkWhatsApp(mensagem) {
    const num = CCS_CONFIG.WHATSAPP_NUMBER.replace(/\D/g, "");
    return `https://wa.me/${num}?text=${encodeURIComponent(mensagem)}`;
  },

  // ---------- HELPERS ----------
  escapeHTML(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  },
  gerarCodigoPedido() {
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `CCS-${stamp}-${rand}`;
  }
};

// ---------- INICIALIZAÇÃO GLOBAL ----------
document.addEventListener("DOMContentLoaded", () => {
  // Loader
  const loader = document.getElementById("loader");
  if (loader) setTimeout(() => loader.classList.add("escondido"), 500);

  // Menu mobile
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("activo");
      nav.classList.toggle("aberto");
    });
  }

  // Header scroll
  const header = document.querySelector(".header");
  if (header) {
    window.addEventListener("scroll", () => {
      header.classList.toggle("rolado", window.scrollY > 40);
    });
  }

  // Reveal on scroll
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visivel"); obs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(el => obs.observe(el));

  // Badge carrinho
  CCS.actualizarBadgeCarrinho();

  // Marca link activo
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav a").forEach(a => {
    if (a.getAttribute("href") === path) a.classList.add("activo");
  });
});