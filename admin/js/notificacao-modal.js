/**
 * NOTIFICACAO-MODAL.JS
 * Mostra convite para cadastro quando cliente tem compra confirmada e não tem conta.
 * Inclui formulário de registo e login.
 */
(function () {
  const WHATSAPP_VISITANTE_KEY = "ccs_whatsapp_visitante";
  const WHATSAPP_INFO_KEY = "ccs_cliente_info";

  // Recuperar WhatsApp que o cliente usou na última compra
  function getWhatsappGuardado() {
    try {
      const info = JSON.parse(localStorage.getItem(WHATSAPP_INFO_KEY) || "{}");
      return info.whatsapp || null;
    } catch { return null; }
  }

  function criarModalHTML() {
    const div = document.createElement("div");
    div.id = "modal-convite-cliente";
    div.className = "modal-convite-fundo";
    div.innerHTML = `
      <div class="modal-convite-box">
        <button class="modal-convite-fechar" aria-label="Fechar">×</button>

        <!-- Ecrã 1: Convite -->
        <div class="modal-convite-ecra" data-ecra="convite">
          <div class="convite-icone">🎁</div>
          <h2>Bem-vindo de volta!</h2>
          <p class="convite-texto">
            A tua compra foi <strong>confirmada</strong> com sucesso. 
            Cria a tua conta gratuita e recebe <strong>descontos exclusivos</strong> em todas as próximas compras.
          </p>
          <div class="convite-beneficios">
            <div class="beneficio"><span>🥈</span> 5% na 2ª compra</div>
            <div class="beneficio"><span>🥇</span> 7% na 3ª compra</div>
            <div class="beneficio"><span>💎</span> 10% em compras frequentes</div>
          </div>
          <button class="btn btn-primario btn-grande" id="btn-quero-conta" style="width:100%">Criar conta grátis</button>
          <button class="btn btn-secundario" id="btn-ja-tenho-conta" style="width:100%;margin-top:10px">Já tenho conta</button>
        </div>

        <!-- Ecrã 2: Registo -->
        <div class="modal-convite-ecra" data-ecra="registo" style="display:none">
          <button class="modal-voltar" data-voltar="convite">← Voltar</button>
          <h2>Criar Conta</h2>
          <p class="convite-texto" style="font-size:.85rem">
            A tua conta será associada ao WhatsApp <strong id="reg-whatsapp"></strong>
          </p>
          <form id="form-registo" class="form-admin">
            <div>
              <label>Email</label>
              <input type="email" id="reg-email" required />
            </div>
            <div>
              <label>Palavra-passe</label>
              <input type="password" id="reg-password" required minlength="8" placeholder="Mín. 8 caracteres, 1 maiúscula, 1 número" />
            </div>
            <div>
              <label>Confirmar palavra-passe</label>
              <input type="password" id="reg-password2" required />
            </div>
            <button type="submit" class="btn btn-primario" style="width:100%;margin-top:12px" id="btn-criar-conta">
              Criar Conta
            </button>
            <p id="reg-erro" style="color:#ff5252;font-size:.85rem;margin-top:10px;text-align:center"></p>
          </form>
        </div>

        <!-- Ecrã 3: Login -->
        <div class="modal-convite-ecra" data-ecra="login" style="display:none">
          <button class="modal-voltar" data-voltar="convite">← Voltar</button>
          <h2>Entrar</h2>
          <form id="form-login-cliente" class="form-admin">
            <div>
              <label>Email</label>
              <input type="email" id="log-email" required />
            </div>
            <div>
              <label>Palavra-passe</label>
              <input type="password" id="log-password" required />
            </div>
            <button type="submit" class="btn btn-primario" style="width:100%;margin-top:12px" id="btn-entrar-cliente">
              Entrar
            </button>
            <p id="log-erro" style="color:#ff5252;font-size:.85rem;margin-top:10px;text-align:center"></p>
          </form>
        </div>

        <!-- Ecrã 4: Sucesso -->
        <div class="modal-convite-ecra" data-ecra="sucesso" style="display:none">
          <div class="convite-icone">✅</div>
          <h2>Conta Criada!</h2>
          <p class="convite-texto" id="sucesso-mensagem">
            Bem-vindo à família CLEYTON CASANOVA. Já podes usufruir dos descontos exclusivos.
          </p>
          <div class="convite-beneficios" id="sucesso-beneficios"></div>
          <button class="btn btn-primario btn-grande" id="btn-sucesso-fechar" style="width:100%">Começar a comprar</button>
        </div>
      </div>
    `;
    return div;
  }

  function mostrarEcra(nome) {
    document.querySelectorAll(".modal-convite-ecra").forEach(el => {
      el.style.display = el.dataset.ecra === nome ? "block" : "none";
    });
  }

  function abrir() {
    let modal = document.getElementById("modal-convite-cliente");
    if (!modal) {
      modal = criarModalHTML();
      document.body.appendChild(modal);
      ligarEventos(modal);
    }
    modal.classList.add("aberto");
    mostrarEcra("convite");
  }

  function fechar() {
    const modal = document.getElementById("modal-convite-cliente");
    if (modal) modal.classList.remove("aberto");
    // Marcar como visto no servidor
    const wa = getWhatsappGuardado();
    if (wa) window.CCS_Cliente.verificarNotificacao(wa).catch(() => {});
  }

  function ligarEventos(modal) {
    modal.querySelector(".modal-convite-fechar").addEventListener("click", fechar);
    modal.addEventListener("click", (e) => { if (e.target === modal) fechar(); });
    document.querySelectorAll("[data-voltar]").forEach(b => {
      b.addEventListener("click", () => mostrarEcra(b.dataset.voltar));
    });

    // Registar
    modal.querySelector("#btn-quero-conta").addEventListener("click", () => {
      const wa = getWhatsappGuardado();
      if (!wa) { alert("Erro: WhatsApp não encontrado."); return; }
      modal.querySelector("#reg-whatsapp").textContent = wa;
      mostrarEcra("registo");
    });

    modal.querySelector("#btn-ja-tenho-conta").addEventListener("click", () => mostrarEcra("login"));

    modal.querySelector("#form-registo").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = modal.querySelector("#btn-criar-conta");
      const errEl = modal.querySelector("#reg-erro");
      const email = modal.querySelector("#reg-email").value.trim();
      const pw = modal.querySelector("#reg-password").value;
      const pw2 = modal.querySelector("#reg-password2").value;
      if (pw !== pw2) { errEl.textContent = "As palavras-passe não coincidem."; return; }
      btn.disabled = true; btn.textContent = "A criar conta…"; errEl.textContent = "";
      try {
        await window.CCS_Cliente.registar({
          whatsapp: getWhatsappGuardado(), email, password: pw, nome: ""
        });
        // Fazer login automático
        const info = await window.CCS_Cliente.login(email, pw);
        mostrarEcra("sucesso");
        modal.querySelector("#sucesso-mensagem").textContent =
          `Bem-vindo! Estás no nível ${info.nivel}.`;
        modal.querySelector("#sucesso-beneficios").innerHTML = `
          <div class="beneficio"><span>🎁</span> ${info.desconto_percent}% de desconto activo</div>
          <div class="beneficio"><span>📊</span> ${info.compras} compra(s) confirmada(s)</div>
        `;
      } catch (err) {
        errEl.textContent = err.message || "Erro ao criar conta.";
        btn.disabled = false; btn.textContent = "Criar Conta";
      }
    });

    // Login
    modal.querySelector("#form-login-cliente").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = modal.querySelector("#btn-entrar-cliente");
      const errEl = modal.querySelector("#log-erro");
      const email = modal.querySelector("#log-email").value.trim();
      const pw = modal.querySelector("#log-password").value;
      btn.disabled = true; btn.textContent = "A entrar…"; errEl.textContent = "";
      try {
        const info = await window.CCS_Cliente.login(email, pw);
        mostrarEcra("sucesso");
        modal.querySelector("#sucesso-mensagem").textContent =
          `Bem-vindo de volta! Nível ${info.nivel}.`;
        modal.querySelector("#sucesso-beneficios").innerHTML = `
          <div class="beneficio"><span>🎁</span> ${info.desconto_percent}% de desconto activo</div>
          <div class="beneficio"><span>📊</span> ${info.compras} compra(s) confirmada(s)</div>
        `;
      } catch (err) {
        errEl.textContent = err.message || "Email ou palavra-passe incorrectos.";
        btn.disabled = false; btn.textContent = "Entrar";
      }
    });

    modal.querySelector("#btn-sucesso-fechar").addEventListener("click", () => {
      fechar();
      // Recarregar para actualizar o desconto
      location.reload();
    });
  }

  // ---------- Verificação automática ao carregar a página ----------
  document.addEventListener("DOMContentLoaded", async () => {
    await new Promise(r => setTimeout(r, 800));

    // Se já tem sessão válida → não mostra modal
    const sessao = await window.CCS_Cliente.verificarSessao();
    if (sessao) return;

    // Se tem WhatsApp guardado → verificar notificação
    const wa = getWhatsappGuardado();
    if (!wa) return;

    const notif = await window.CCS_Cliente.verificarNotificacao(wa);
    if (notif && notif.tipo === "convite_cadastro") {
      setTimeout(abrir, 1500);
    }
  });

  // Expor função abrir manualmente
  window.CCS_MostrarConvite = abrir;
})();