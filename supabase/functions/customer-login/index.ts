// supabase/functions/customer-login/index.ts
// Deploy: supabase functions deploy customer-login --no-verify-jwt

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
    const { email, password } = await req.json();
    const em = String(email || "").trim().toLowerCase();

    if (!em || !password) return json({ ok: false, erro: "Preenche email e palavra-passe." }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verificar credenciais
    const { data: contaId, error: vErr } = await admin
      .rpc("verificar_password_cliente", { p_email: em, p_password: password });

    if (vErr) throw vErr;
    if (!contaId) return json({ ok: false, erro: "Email ou palavra-passe incorrectos." }, 401);

    // Buscar dados do cliente + desconto REAL calculado no servidor
    const { data: conta } = await admin
      .from("customer_accounts")
      .select("id, customer_id, email, email_verificado, activo")
      .eq("id", contaId)
      .single();

    if (!conta || !conta.activo) return json({ ok: false, erro: "Conta desactivada." }, 403);

    const { data: descontoInfo, error: dErr } = await admin
      .rpc("calcular_desconto_cliente", { p_customer_id: conta.customer_id });

    if (dErr) throw dErr;

    // Actualizar último login
    await admin.from("customer_accounts")
      .update({ ultimo_login: new Date().toISOString() })
      .eq("id", conta.id);

    // Gerar token de sessão (32 bytes aleatórios, só hash fica na DB)
    const tokenBruto = crypto.randomUUID() + crypto.randomUUID();
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest("SHA-256", encoder.encode(tokenBruto));
    const tokenHash = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, "0")).join("");

    const expira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias

    await admin.from("customer_sessions").insert({
      customer_id: conta.customer_id,
      token_hash: tokenHash,
      expira_em: expira.toISOString()
    });

    return json({
      ok: true,
      token: tokenBruto, // cliente guarda isto no localStorage
      expira_em: expira.toISOString(),
      cliente: {
        email: conta.email,
        customer_id: conta.customer_id,
        nivel: descontoInfo?.[0]?.nivel || "Bronze",
        desconto_percent: descontoInfo?.[0]?.desconto || 0,
        compras: descontoInfo?.[0]?.compras || 0,
        tem_conta: true,
        conta_verificada: conta.email_verificado
      }
    }, 200);

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