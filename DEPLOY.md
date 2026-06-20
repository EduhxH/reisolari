# Deploy — Reisolari

Arquitetura: **frontend Next.js 14** + **backend FastAPI** + **MongoDB** + **Redis**.
A autenticação usa **Firebase** (o backend só precisa do *project id* público — verifica
os tokens contra as chaves da Google, sem service-account).

---

## 1. Dados / segredos necessários

Preenche `backend/.env` (a partir de `backend/.env.example`) e o `.env` da raiz
(a partir de `.env.example`). Checklist:

| Variável | Onde | Obrigatório | Notas |
|---|---|---|---|
| `MAPBOX_TOKEN` / `NEXT_PUBLIC_MAPBOX_TOKEN` | backend + raiz | **Sim** | Mesmo token. Mapa do telhado. |
| `FIREBASE_PROJECT_ID` | backend | **Sim** | Já `reisolari-92630`. |
| `JWT_SECRET` | backend | **Sim** | `openssl rand -hex 32`. |
| `GROQ_API_KEY` | backend | Recomendado | Lê a fatura (visão) + prosa dos agentes. |
| `SERPAPI_API_KEY` | backend | Recomendado | Painéis reais + fotos do catálogo. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | backend | Só p/ loja | Checkout. |
| `FRONTEND_PUBLIC_URL` / `BACKEND_PUBLIC_URL` | backend | **Sim** | URLs públicas reais (CORS + links/PDF). |
| `NEXT_PUBLIC_BACKEND_URL` | raiz | **Sim** | URL do backend (build-time do frontend). |

> **Sem mocks:** Mapbox e (idealmente) Groq + SerpAPI têm de estar configurados para
> a app funcionar com dados reais (mapa, leitura de fatura, painéis e fotos reais).

### Passos externos (uma vez)
- **Firebase → Authentication → Settings → Authorized domains:** adiciona o domínio
  do frontend (ex. `app.reisolari.pt`), senão o login Google/GitHub é bloqueado.
- **Stripe → Webhooks:** cria um endpoint para `…/api/v1/payments/...` e copia o
  *signing secret* para `STRIPE_WEBHOOK_SECRET` (só se usares a loja/pagamentos).

---

## 2. Deploy com Docker (VPS / self-host) — recomendado

Pré-requisitos: Docker + Docker Compose no servidor.

```bash
cp backend/.env.example backend/.env      # preencher
cp .env.example .env                       # preencher NEXT_PUBLIC_*
docker compose -f docker-compose.prod.yml up -d --build
```

Sobe 4 serviços: `mongodb`, `redis`, `backend` (porta 8000) e `frontend` (porta 3000),
com volumes persistentes (`mongodb_data`, `redis_data`, `uploads_data`). O catálogo de
painéis é semeado automaticamente no arranque.

Verificar:
```bash
curl http://localhost:8000/health        # {"status":"ok",...}
docker compose -f docker-compose.prod.yml ps
```

### TLS / domínio (reverse proxy)
Coloca um reverse proxy à frente para HTTPS. Exemplo **Caddy** (`/etc/caddy/Caddyfile`),
servindo tudo num só domínio (assim `NEXT_PUBLIC_BACKEND_URL` pode ficar vazio → sem CORS):

```
app.reisolari.pt {
    @api path /api/* /media/* /ws/* /health
    handle @api {
        reverse_proxy localhost:8000
    }
    handle {
        reverse_proxy localhost:3000
    }
}
```

Se preferires domínios separados (`app.` e `api.`), define `NEXT_PUBLIC_BACKEND_URL=https://api.…`
e `CORS_ORIGINS=https://app.…` no backend.

---

## 3. Plataformas geridas (alternativa)

Os `Dockerfile` de cada serviço funcionam tal e qual em **Render**, **Railway** ou **Fly.io**:

- **Backend:** serviço Docker a partir de `./backend`. Define todas as variáveis do
  `backend/.env`. Usa **MongoDB Atlas** (`MONGO_URI=mongodb+srv://…`) e um Redis gerido.
  Monta um disco persistente em `/app/uploads`. Health check: `GET /health`.
- **Frontend:** serviço Docker a partir de `./frontend`, passando os **build-args**
  `NEXT_PUBLIC_BACKEND_URL` e `NEXT_PUBLIC_MAPBOX_TOKEN`.
- **Vercel (frontend):** também funciona sem Docker — define as duas `NEXT_PUBLIC_*`
  nas Environment Variables do projeto; o backend tem de ir para outro host.

---

## 4. Notas operacionais

- **Uploads** (faturas + imagens de anúncios) vivem em `/app/uploads` → exige volume/disco
  persistente; caso contrário perdem-se em cada redeploy.
- **Workers:** a imagem corre 1 processo uvicorn (seguro para os WebSockets). Para escalar,
  corre várias réplicas atrás do proxy (o estado partilhado vai por Redis).
- **Backups:** faz dump regular do MongoDB (`mongodump`) e do volume `uploads_data`.
- **CORS:** em `ENVIRONMENT=production` só são aceites `FRONTEND_PUBLIC_URL` + `CORS_ORIGINS`.
