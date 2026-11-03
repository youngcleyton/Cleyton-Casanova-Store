/**
 * SUPABASE.JS — versão UMD (sem ESM, sem build step)
 * Requer no <head>: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 */
(function () {
  const cfg = window.CCS_CONFIG;
  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("SEU-PROJECTO")) {
    console.warn("[Supabase] Credenciais em falta em js/config.js");
  }
  window.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "ccs_auth" }
  });

  window.CCS_uploadImagem = async function (file, pasta = "produtos") {
    const ext = file.name.split(".").pop().toLowerCase();
    const nome = `${pasta}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await window.sb.storage.from("product-images")
      .upload(nome, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) throw error;
    const { data } = window.sb.storage.from("product-images").getPublicUrl(nome);
    return data.publicUrl;
  };
})();