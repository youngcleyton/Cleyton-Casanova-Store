// supabase/functions/customer-status/index.ts
// Deploy: supabase functions deploy customer-status --no-verify-jwt
// Retorna: notificação pendente + estado de fidelização de um cliente
// Uso: { whatsapp: "258841234567" } para ver notificações
//      { token: "..." } para verificar sessão

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { whatsapp, token } = await req.json();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ---------- Modo 1: verificar sessão por token ----------
    if (token) {
      const encoder = new TextEncoder();
      const hashBuf = await crypto.subtle.digest("SHA-256", encoder.encode(token));
      const tokenHash = Array.from(new Uint8Array(hashBuf))
        .map(b => b.toString(16).padStart(2, "0")).join("");

      const { data: sessao } = await admin
        .from("customer_sessions")
        .select("customer_id, expira_em, revogado")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (!sessao || sessao.revogado || new Date(sessao.expira_em) < new Date()) {
        return json({ ok: false, erro: "Sessão inválida ou expirada." }, 401);
      }

      const { data: info } = await admin
        .rpc("calcular_desconto_cliente", { p_customer_id: sessao.customer_id });

      const { data: conta } = await admin
        .from("customer_accounts")
        .select("email, email_verificado")
        .eq("customer_id", sessao.customer_id)
        .maybeSingle();

      return json({
        ok: true,
        autenticado: true,
        cliente: {
          customer_id: sessao.customer_id,
          email: conta?.email,
          email_verificado: conta?.email_verificado || false,
          nivel: info?.[0]?.nivel || "Bronze",
          desconto_percent: info?.[0]?.desconto || 0,
          compras: info?.[0]?.compras || 0
        }
      }, 200);
    }

    // ---------- Modo 2: verificar notificações por WhatsApp ----------
    if (whatsapp) {
      const wa = String(whatsapp).replace(/\D/g, "");
      const { data: cust } = await admin
        .from("customers")
        .select("id, total_compras")
        .eq("whatsapp", wa)
        .maybeSingle();

      if (!cust) return json({ ok: true, notificacao: null, tem_conta: false }, 200);

      // Contar compras confirmadas
      const { data: compras } = await admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", cust.id)
        .in("estado", ["confirmado", "concluido"]);

      const temComprasConfirmadas = (compras?.count || 0) >= 1;

      // Ver se já tem conta
      const { data: conta } = await admin
        .from("customer_accounts")
        .select("id")
        .eq("customer_id", cust.id)
        .maybeSingle();

      // Só mostra convite se: tem compra confirmada E não tem conta
      if (temComprasConfirmadas && !conta) {
        const { data: notif } = await admin
          .from("customer_notifications")
          .select("id, visto, criado_em")
          .eq("customer_id", cust.id)
          .eq("tipo", "convite_cadastro")
          .maybeSingle();

        if (notif && !notif.visto) {
          return json({
            ok: true,
            notificacao: {
              tipo: "convite_cadastro",
              mensagem: "Bem-vindo de volta! Cria a tua conta e recebe descontos exclusivos.",
              id: notif.id
            },
            tem_conta: false,
            whatsapp: wa
          }, 200);
        }
      }

      return json({
        ok: true,
        notificacao: null,
        tem_conta: !!conta
      }, 200);
    }

    return json({ ok: false, erro: "Envia whatsapp ou token." }, 400);

  } catch (e) {
    console.error(e);
    return json({ ok: false, erro: e.message || "Erro interno" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}