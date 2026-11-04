/**
 * AUTH-GUARD.JS — Protecção simples sem Supabase
 */
(function () {
  // Verifica se o utilizador passou pelo login
  if (localStorage.getItem("admin_logado") !== "sim") {
    // Se não passou, manda de volta para o login
    location.href = "cleytonadmin.html";
    return;
  }

  // Botão de logout
  document.addEventListener("DOMContentLoaded", () => {
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
      // Remove o evento antigo (se houver) para não duplicar
      const novoBtn = btnLogout.cloneNode(true);
      btnLogout.parentNode.replaceChild(novoBtn, btnLogout);
      
      novoBtn.addEventListener("click", () => {
        localStorage.removeItem("admin_logado");
        location.href = "cleytonadmin.html";
      });
    }
  });
})();