# Chá de Casa Nova · Carol & Ray
Next.js 14 + TypeScript + Supabase (Postgres, Auth, RLS).

## 1. Banco e login (Supabase)
1. Crie um projeto em supabase.com (plano gratuito serve).
2. SQL Editor → cole e rode `supabase/schema.sql` (tabelas, regras de segurança, funções e 57 presentes).
3. Authentication → Users → Add user (seu e-mail + senha forte; desmarque cadastro público em Settings → Auth → "Allow new users to sign up").
4. Rode no SQL Editor: `insert into admins select id from auth.users where email='SEU_EMAIL';`
5. Settings → API: copie *Project URL* e a chave *anon public*. **Nunca** use a service_role no site.

## 2. Rodar local
`cp .env.example .env.local` → preencha → `npm install` → `npm run dev` → http://localhost:3000 (painel em /admin).

## 3. Publicar (Vercel)
Suba a pasta para um repositório no GitHub → vercel.com → Import → adicione as 3 variáveis do `.env.example` → Deploy. Domínio próprio: Project → Settings → Domains.

## 4. Pix
Chave telefone em `NEXT_PUBLIC_PIX_KEY` (só números). O site copia a chave e mostra o valor; **não confirma pagamento**: você confirma em /admin → "Confirmar Pix". QR Code/copia-e-cola automáticos exigem provedor (Mercado Pago, Asaas, etc.) com credenciais e webhook — não incluído.

## Privacidade
- `gifts` só é lido/escrito por quem está na tabela `admins` (RLS). Convidados usam apenas funções que devolvem "disponível/indisponível".
- Índice único impede dois convidados no mesmo item; reserva sem "Já fiz o Pix" expira em 30 min.
- Teste: no console do navegador, `supabase.from('gifts').select()` como convidado deve retornar vazio.

## Testar o fluxo
Escolha item → nome → copie chave → "Já fiz o Pix" → recado → /admin: aparece pendente → "Confirmar Pix" → item some da lista pública como "Já escolhido".
