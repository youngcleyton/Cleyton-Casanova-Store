// supabase/functions/customer-register/index.ts
// Deploy: supabase functions deploy customer-register --no-verify-jwt
// Registo de conta de cliente após 1ª compra confirmada.

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
    const { whatsapp, email, password, nome } = await req.json();
    const wa = String(whatsapp || "").replace(/\D/g, "");
    const em = String(email || "").trim().toLowerCase();

    // ---------- VALIDAÇÕES RÍGIDAS ----------
    if (!wa || wa.length < 9) return json({ ok: false, erro: "WhatsApp inválido." }, 400);
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return json({ ok: false, erro: "Email inválido." }, 400);
    if (!password || password.length < 8) return json({ ok: false, erro: "Palavra-passe mínima: 8 caracteres." }, 400);
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return json({ ok: false, erro: "Palavra-passe precisa de letra maiúscula e número." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ---------- REGRA 1: cliente tem de ter compra CONFIRMADA ----------
    const { data: cust, error: custErr } = await admin
      .from("customers")
      .select("id, nome, whatsapp")
      .eq("whatsapp", wa)
      .maybeSingle();

    if (custErr) throw custErr;
    if (!cust) return json({ ok: false, erro: "WhatsApp não encontrado. Faz primeiro uma compra." }, 403);

    const { data: compras } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", cust.id)
      .in("estado", ["confirmado", "concluido"]);

    if (!compras || compras.count === 0) {
      return json({ ok: false, erro: "É necessário ter pelo menos 1 compra confirmada para criar conta." }, 403);
    }

    // ---------- REGRA 2: não pode já ter conta ----------
    const { data: existente } = await admin
      .from("customer_accounts")
      .select("id")
      .eq("customer_id", cust.id)
      .maybeSingle();

    if (existente) return json({ ok: false, erro: "Já tens conta. Faz login." }, 409);

    // ---------- REGRA 3: email único globalmente ----------
    const { data: emailUsado } = await admin
      .from("customer_accounts")
      .select("id")
      .ilike("email", em)
      .maybeSingle();

    if (emailUsado) return json({ ok: false, erro: "Este email já está registado." }, 409);

    // ---------- CRIAR CONTA ----------
    const { data: novo, error: criarErr } = await admin
      .from("customer_accounts")
      .insert({
        customer_id: cust.id,
        email: em,
        // Hash via função SQL — nunca guardamos password em claro
        password_hash: "PENDING", // placeholder, corrigido abaixo
        email_verificado: true,   // simplificado: considera-se verificado (podes adicionar email real depois)
        activo: true
      })
      .select("id")
      .single();

    if (criarErr) {
      // Se falhar por email duplicado, tentar outra mensagem
      if (criarErr.message.includes("unique") || criarErr.message.includes("duplicate")) {
        return json({ ok: false, erro: "Email já registado." }, 409);
      }
      throw criarErr;
    }

    // Actualizar hash de password via SQL (pgcrypto)
    const { error: pwErr } = await admin.rpc("definir_password_cliente", {
      p_conta_id: novo.id,
      p_password: password
    });
    if (pwErr) throw pwErr;

    // Marcar notificação como clicada
    await admin.from("customer_notifications")
      .update({ clicado: true, visto: true })
      .eq("customer_id", cust.id)
      .eq("tipo", "convite_cadastro");

    return json({
      ok: true,
      mensagem: "Conta criada! Faz login para ver os teus descontos.",
      email: em,
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