/**
 * AUTH-GUARD.JS — bloqueia acesso não autenticado
 */
(async function () {
  const { data: { session } } = await window.sb.auth.getSession();
  if (!session) {
    location.href = "login.html";
    return;
  }
  // Preenche email na sidebar, se existir
  const emailEl = document.getElementById("admin-email");
  if (emailEl) emailEl.textContent = session.user.email;
  // Logout
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await window.sb.auth.signOut();
      location.href = "login.html";
    });
  }
})();