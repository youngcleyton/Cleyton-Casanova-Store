// supabase/functions/criar-pedido/index.ts — VERSÃO ACTUALIZADA
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
    const body = await req.json();
    const { codigo, client_id, nome, whatsapp, itens, token_cliente } = body;

    if (!codigo || !nome || !whatsapp || !Array.isArray(itens) || !itens.length) {
      return json({ ok: false, erro: "Dados incompletos" }, 400);
    }
    const waLimpo = String(whatsapp).replace(/\D/g, "");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ----- Buscar produtos reais -----
    const ids = itens.map((i: any) => i.produto_id);
    const { data: produtos, error: prodErr } = await admin
      .from("products")
      .select("id, nome, preco_original, preco_promocional, stock, activo")
      .in("id", ids);
    if (prodErr) throw prodErr;
    const mapa = new Map((produtos || []).map((p: any) => [p.id, p]));

    // ----- Recalcular linhas com preços REAIS -----
    const linhas: any[] = [];
    let subtotal = 0;
    for (const item of itens) {
      const p: any = mapa.get(item.produto_id);
      if (!p) return json({ ok: false, erro: `Produto ${item.produto_id} não encontrado` }, 400);
      if (!p.activo) return json({ ok: false, erro: `Produto ${p.nome} indisponível` }, 400);
      const qtd = Math.max(1, Math.min(Number(item.quantidade) || 1, p.stock));
      if (qtd < Number(item.quantidade)) {
        return json({ ok: false, erro: `Stock insuficiente para ${p.nome}` }, 400);
      }
      const preco = Number(p.preco_promocional ?? p.preco_original);
      const linhaSubtotal = preco * qtd;
      subtotal += linhaSubtotal;
      linhas.push({ produto_id: p.id, nome: p.nome, preco_unitario: preco, quantidade: qtd, subtotal: linhaSubtotal });
    }

    // ----- Encontrar/criar customer -----
    let customerId: string | null = null;
    const { data: custExistente } = await admin
      .from("customers")
      .select("id")
      .or(`client_id.eq.${client_id || ""},whatsapp.eq.${waLimpo}`)
      .maybeSingle();

    if (custExistente) {
      customerId = custExistente.id;
    } else {
      const { data: novoCust, error: custErr } = await admin
        .from("customers")
        .insert({
          client_id: client_id || null,
          nome, whatsapp: waLimpo,
          total_compras: 0, total_gasto: 0, desconto_atual: 0
        })
        .select("id").single();
      if (custErr) throw custErr;
      customerId = novoCust.id;
    }

    // ----- DESCONTO RÍGIDO (calculado APENAS no servidor) -----
    let descontoPercent = 0;
    if (customerId) {
      // 1) Se cliente enviou token válido → usar esse customer
      let customerParaDesconto = customerId;
      if (token_cliente) {
        const encoder = new TextEncoder();
        const hashBuf = await crypto.subtle.digest("SHA-256", encoder.encode(token_cliente));
        const tokenHash = Array.from(new Uint8Array(hashBuf))
          .map(b => b.toString(16).padStart(2, "0")).join("");

        const { data: sessao } = await admin
          .from("customer_sessions")
          .select("customer_id, expira_em, revogado")
          .eq("token_hash", tokenHash)
          .maybeSingle();

        if (sessao && !sessao.revogado && new Date(sessao.expira_em) > new Date()) {
          customerParaDesconto = sessao.customer_id;
        }
      }

      // 2) Calcular desconto com base em compras CONFIRMADAS + conta verificada
      const { data: infoDesc } = await admin
        .rpc("calcular_desconto_cliente", { p_customer_id: customerParaDesconto });

      descontoPercent = infoDesc?.[0]?.desconto || 0;
    }

    // REGRA FINAL: nunca mais de 15% (limite de segurança)
    if (descontoPercent > 15) descontoPercent = 15;
    if (descontoPercent < 0) descontoPercent = 0;

    const descontoValor = +(subtotal * (descontoPercent / 100)).toFixed(2);
    const total = +(subtotal - descontoValor).toFixed(2);

    // ----- Criar order -----
    const { data: order, error: ordErr } = await admin.from("orders").insert({
      codigo, customer_id: customerId, client_id: client_id || null,
      nome_cliente: nome, whatsapp: waLimpo,
      subtotal, desconto_percent: descontoPercent,
      desconto_valor: descontoValor, total,
      estado: "pendente"
    }).select("id, codigo").single();

    if (ordErr) throw ordErr;

    // ----- Criar order_items -----
    const itensInsert = linhas.map((l: any) => ({ ...l, order_id: order.id }));
    const { error: itemsErr } = await admin.from("order_items").insert(itensInsert);
    if (itemsErr) throw itemsErr;

    return json({
      ok: true, codigo: order.codigo,
      subtotal, desconto_percent: descontoPercent,
      desconto_valor: descontoValor, total, linhas
    }, 200);

  } catch (e) {
    console.error(e);
    return json({ ok: false, erro: e.message || "Erro interno" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}