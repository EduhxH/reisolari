# Deploy — Reisolari

**Stack escolhida:** frontend na **Vercel** · backend no **Render** · base de dados **MongoDB Atlas** · Redis gerido no Render.

A autenticação usa **Firebase** (o backend só precisa do *project id* público — verifica
os tokens contra as chaves da Google, sem service-account).

---

## 0. Segredos / dados necessários (checklist)

| Variável | Onde se define | Obrigatório | Notas |
|---|---|---|---|
| `MONGO_URI` | Render | **Sim** | Connection string do Atlas (`mongodb+srv://…`). |
| `MAPBOX_TOKEN` | Render | **Sim** | Mapa do telhado. |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Vercel | **Sim** | O mesmo token do Mapbox. |
| `NEXT_PUBLIC_BACKEND_URL` | Vercel | **Sim** | URL do Render (ex.: `https://reisolari-backend.onrender.com`). |
| `FRONTEND_PUBLIC_URL` | Render | **Sim** | URL da Vercel (ex.: `https://reisolari.vercel.app`). |
| `BACKEND_PUBLIC_URL` | Render | **Sim** | O próprio URL do Render. |
| `FIREBASE_PROJECT_ID` | Render | **Sim** | Já preenchido: `reisolari-92630`. |
| `JWT_SECRET` | Render | **Sim** | O `render.yaml` gera-o automaticamente. |
| `GROQ_API_KEY` | Render | Recomendado | Lê a fatura (visão) + prosa dos agentes. |
| `SERPAPI_API_KEY` | Render | Recomendado | Painéis reais + fotos do catálogo. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Render | Só p/ loja | Checkout/pagamentos. |

> **O que preciso de ti:** as chaves acima (Mapbox, Groq, SerpAPI, Stripe se usares loja) e,
> depois de criares os projetos, os URLs finais da Vercel e do Render para cruzar (CORS + backend URL).

---

## 1. MongoDB Atlas

1. cria um cluster gratuito **M0** (https://www.mongodb.com/atlas).
2. **Database Access:** cria um utilizador com password.
3. **Network Access:** permite `0.0.0.0/0` (ou os IPs do Render).
4. copia a connection string (`mongodb+srv://user:pass@cluster.xxx.mongodb.net/?retryWrites=true&w=majority`).
   Não é preciso indicar o nome da BD — o código usa `solar_p2p`.

## 2. Backend no Render

Usa o **Blueprint** já incluído (`render.yaml`), que cria o web service (Docker) + um Redis gerido:

1. Render → **New → Blueprint** → seleciona o repositório `EduhxH/reisolari`.
2. O Render lê `render.yaml`. Preenche no dashboard as variáveis marcadas (`sync:false`):
   `MONGO_URI`, `FRONTEND_PUBLIC_URL`, `BACKEND_PUBLIC_URL`, `MAPBOX_TOKEN`, `GROQ_API_KEY`,
   `SERPAPI_API_KEY`, `STRIPE_*` (`CORS_ORIGINS` é opcional). `JWT_SECRET` e `REDIS_URL` são automáticos.
3. Deploy. Verifica: `https://<backend>.onrender.com/health` → `{"status":"ok"}`.

> **Uploads:** no plano *free* o disco é efémero (faturas/imagens de anúncios perdem-se em cada
> redeploy; o catálogo é re-semeado no arranque). Para persistir, muda `plan` para `starter` e
> descomenta o bloco `disk:` no `render.yaml`.

## 3. Frontend na Vercel

1. Vercel → **Add New → Project** → importa `EduhxH/reisolari`.
2. **Root Directory = `frontend`** (a Vercel deteta o Next.js automaticamente).
3. **Environment Variables:**
   - `NEXT_PUBLIC_BACKEND_URL` = o URL do Render (passo 2).
   - `NEXT_PUBLIC_MAPBOX_TOKEN` = o token Mapbox.
4. Deploy → obténs o URL (ex.: `https://reisolari.vercel.app`).

## 4. Cruzar os URLs (importante)

Depois de ambos estarem online:
- No **Render**, mete `FRONTEND_PUBLIC_URL` = URL da Vercel (libera o CORS) e
  `BACKEND_PUBLIC_URL` = URL do Render. Re-deploy do backend.
- Na **Vercel**, confirma `NEXT_PUBLIC_BACKEND_URL` = URL do Render. (Mudar uma `NEXT_PUBLIC_*`
  exige novo build → faz *Redeploy*.)

## 5. Passos externos (uma vez)

- **Firebase → Authentication → Settings → Authorized domains:** adiciona o domínio da Vercel,
  senão o login Google/GitHub é bloqueado.
- **Stripe → Webhooks** (só se usares loja): endpoint para `…/api/v1/payments/...` e copia o
  *signing secret* para `STRIPE_WEBHOOK_SECRET` no Render.

---

## Alternativa: tudo em Docker (self-host / VPS)

Continua disponível para correr o stack completo num só servidor:

```bash
cp backend/.env.example backend/.env   # preencher (MONGO_URI pode ser Atlas ou o mongo do compose)
cp .env.example .env                    # NEXT_PUBLIC_*
docker compose -f docker-compose.prod.yml up -d --build
```

Sobe `mongodb`, `redis`, `backend` (:8000), `frontend` (:3000) com volumes persistentes.
Coloca um reverse proxy (Caddy/Nginx) à frente para TLS.

---

## Notas

- **CORS:** em `ENVIRONMENT=production` o backend só aceita `FRONTEND_PUBLIC_URL` + `CORS_ORIGINS`.
  Os *preview deployments* da Vercel têm URLs próprios — adiciona-os a `CORS_ORIGINS` se precisares de os testar.
- **WebSockets:** o frontend deriva `wss://` automaticamente do `NEXT_PUBLIC_BACKEND_URL` (o Render suporta WS).
- **Backups:** o Atlas tem snapshots; em self-host, faz `mongodump` + backup do volume `uploads_data`.
