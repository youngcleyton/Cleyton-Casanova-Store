# CLEYTON CASANOVA STORE

Plataforma de portfólio + e-commerce com Supabase + WhatsApp.

## 1. Configuração Supabase

1. Cria um projecto em https://supabase.com
2. **SQL Editor** → cola e executa `supabase/schema.sql`
3. **SQL Editor** → cola e executa `supabase/policies.sql`
4. **Storage** → verifica que existe o bucket público `product-images`
5. **Authentication** → Users → Add user → cria o utilizador admin (email + password)
6. Copia `SUPABASE_URL` e `SUPABASE_ANON_KEY` de **Project Settings → API**
7. Cola em `js/config.js`

## 2. Edge Function (obrigatória para criar pedidos)

```bash
npm i -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy criar-pedido --no-verify-jwt