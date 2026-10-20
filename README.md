# Meu Eixo

Meu Eixo não será apenas um aplicativo para anotar despesas. Ele será seu gestor pessoal, que compara o planejado com o realizado, aprende com seu histórico e ajuda você a tomar decisões melhores.

*Organize hoje. Viva com mais leveza.*

Site estático (HTML, CSS e JavaScript) com Supabase para banco de dados, login e sincronização em tempo real, publicado na Vercel.

## Estrutura

| Arquivo | Função |
|---|---|
| `index.html` | Estrutura da página |
| `estilo.css` | Identidade visual (branco, verde-sálvia, azul, tema claro e escuro) |
| `app.js` | Telas, cálculos financeiros e acesso ao banco |
| `config.js` | Endereço e chave pública do Supabase |
| `metas.js` | Saldo das dívidas com juros, plano de quitação e prazo |
| `supabase/schema.sql` | Tabelas, regras de acesso (RLS) e funções do banco |
| `vercel.json` | Cabeçalhos de segurança da hospedagem |

## Instalação

### 1. Supabase
1. Crie o projeto (região São Paulo).
2. **SQL Editor › New query**: cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**. Deve aparecer *Success*.
3. **Authentication › URL Configuration**:
   - *Site URL*: o endereço da Vercel (ex.: `https://meu-eixo.vercel.app`)
   - *Redirect URLs*: o mesmo endereço seguido de `/**`
4. **Project Settings › API**: copie *Project URL* e a chave *anon public* (ou *publishable*) para `config.js`.

### 2. Vercel
1. **Add New › Project › Import** o repositório `meu-eixo` do GitHub.
2. *Framework Preset*: **Other**. Sem comando de build. Clique em **Deploy**.
3. Cada alteração enviada ao GitHub é publicada automaticamente.

## Segurança
- Cada pessoa só lê e grava dados dos espaços dos quais é membro (Row Level Security no banco).
- O espaço pessoal é criado automaticamente no cadastro e não pode ser compartilhado nem excluído separadamente.
- Espaços compartilhados recebem membros por código de convite, que pode ser trocado a qualquer momento.
- A chave `anon` é pública por natureza. **Nunca** coloque a chave `service_role` / secret neste projeto.

## Etapas
1–3 ✔ Identidade, banco, receitas, despesas, parcelas, recorrências, dias 10 e 20, orçamento, contas e espaços compartilhados
4 Leitura de comprovantes · 5 a 8 (alimentação, cardápios, lista de compras, despensa) retirados do site em 19/10/2026; dados mantidos no banco · 9 Cupom do mercado → despesas por categoria · 10 ✔ Metas: quitar dívidas e reduzir o crédito (atualização `007_dividas_metas.sql`) · 11 Relatório mensal automático · 12 Testes finais
