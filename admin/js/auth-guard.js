/**
 * AUTH-GUARD.JS — Protege as páginas do admin usando o Supabase Auth nativo.
 */
(async function () {
  // Vai buscar a sessão ativa
  const { data: { session } } = await window.sb.auth.getSession();
  
  // Se não estiver logado, manda de volta para o login
  if (!session) {
    location.href = "cleytonadmin.html";
    return;
  }

  // Mostrar o email na sidebar
  const emailEl = document.getElementById("admin-email");
  if (emailEl) {
    emailEl.textContent = session.user.email;
  }

  // Botão de logout
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await window.sb.auth.signOut();
      location.href = "cleytonadmin.html";
    });
  }
})();