<div align="center">

# REISOLARI

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)
[![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com/)
[![Mapbox](https://img.shields.io/badge/Mapbox-000000?style=for-the-badge&logo=mapbox&logoColor=white)](https://www.mapbox.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

*A peer-to-peer solar energy marketplace and photovoltaic simulation platform for Portugal — combining scientifically rigorous physical calculations, a real multi-agent AI system, geospatial mapping, and Stripe Connect payments.*

[![Status](https://img.shields.io/badge/Status-In%20Development-orange?style=for-the-badge)]()

🇺🇸 This project is documented and implemented entirely in English.

</div>

---

> [!WARNING]
> **This project is still under active development.**
> The architecture and core modules are being built. No mocked data, fake APIs, or placeholder logic will ever be introduced — every feature is implemented against real production APIs and real scientific formulas.

---

> [!NOTE]
> **Academic context:** Reisolari was developed as a project for the FQ (Física e Química) curriculum. The scientific evaluator will assess the physical accuracy of every photovoltaic calculation, the correct application of physics formulas, and the integrity of the multi-agent AI orchestration system.

---

## Table of Contents

- [About](#-about)
- [Features](#-features)
- [Tech Stack](#️-tech-stack)
- [Scientific Engine](#-scientific-engine-the-fq-core)
- [Multi-Agent AI System](#-multi-agent-ai-system)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
- [Configuration](#️-configuration)
- [Project Structure](#-project-structure)
- [Architecture Overview](#️-architecture-overview)
- [Roadmap](#-roadmap)
- [Known Limitations](#️-known-limitations)
- [What I Learned](#-what-i-learned)

---

## 🧩 About

Reisolari is a full-stack B2B solar energy platform built for Portugal (Continental, Madeira, and Açores). It allows property owners and businesses to simulate the photovoltaic potential of a rooftop drawn directly on a satellite map, receive a scientifically grounded energy production report, and list or purchase solar systems through a peer-to-peer marketplace with Stripe Connect split payments.

The platform is built around a real **Multi-Agent AI system** — an Orchestrator agent that dispatches three specialist sub-agents in parallel (Physical-Chemical Analyst, Financial & Fiscal Specialist, and Sustainable Viability Consultant) and consolidates their responses into a structured JSON report. Every analysis is grounded in real data: solar irradiation from the **PVGIS API** (European Commission), geographic detection via **GeoIP**, and area measurements from **Turf.js** applied to Mapbox polygons.

Zero mocking. Zero placeholders. Every number is real.

---

## ✨ Features

| Component / Feature                   | Description                                                                                                                                                        | Status         |
|---------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------|
| 🗺️ **Satellite Map + Roof Drawing**    | Mapbox GL JS satellite view with Mapbox GL Draw tools; users draw their rooftop polygon and Turf.js computes the exact area in m².                                | 🔨 In progress |
| ☀️ **PVGIS Integration**               | Real EU Commission PVGIS API called asynchronously with `httpx.AsyncClient` to retrieve annual irradiation (E_y) for the roof's exact coordinates.                | 🔨 In progress |
| ⚡ **Physical Energy Formula**         | `E = A × r × H × PR` computed with real constants: panel efficiency r = 20.5%, Performance Ratio PR = 75%, irradiation H from PVGIS.                              | 🔨 In progress |
| 🤖 **Multi-Agent AI Orchestrator**     | Async Python agent pipeline (OpenAI + LangChain/LangGraph): Orchestrator + 3 specialist sub-agents running in parallel, output validated by a strict Pydantic schema. | 🔨 In progress |
| 💳 **Stripe Connect Marketplace**      | P2P split payments with `application_fee_amount` (8% platform fee) and `transfer_data.destination` to the seller's connected account. Full webhook validation.     | 🔨 In progress |
| 🏦 **Portuguese Fiscal Engine**        | Exact VAT logic: 6% / 5% / 4% (panels) and 23% / 22% / 16% (batteries) for Continente, Madeira, and Açores. Tarifa Social de Energia discount of 33.8%.           | 🔨 In progress |
| 💬 **Real-time P2P Chat**              | FastAPI WebSocket endpoint integrated with Redis Pub/Sub; messages atomically persisted to MongoDB using the `$push` operator.                                      | 🔨 In progress |
| 🗄️ **MongoDB Atlas + ACID**            | Geospatial 2dsphere indexes, GeoJSON Point/Polygon schemas, and native MongoDB ACID transactions for atomic listing updates and invoice creation.                   | 🔨 In progress |
| 🔐 **Auth + GDPR Consent**             | bcrypt password hashing via passlib; explicit GDPR consent checkbox for IP and rooftop coordinate storage before any data is persisted.                            | 🔨 In progress |
| 📊 **AI Analysis Dashboard**           | Next.js dashboard displaying raw physics results alongside the individual textual analyses from each sub-agent and the consolidated Orchestrator report.            | 🔨 In progress |

---

## 🛠️ Tech Stack

| Technology              | Role                                                              |
|-------------------------|-------------------------------------------------------------------|
| Next.js 14 (App Router) | Frontend framework with server and client components              |
| TypeScript              | Type-safe frontend and API contracts                              |
| Tailwind CSS            | Utility-first UI styling                                          |
| Mapbox GL JS            | Satellite map rendering and geospatial interaction                |
| Mapbox GL Draw          | Rooftop polygon drawing tool on the map                           |
| Turf.js                 | Client-side geospatial area calculation in m²                     |
| React-Map-GL            | React wrapper for Mapbox GL JS                                    |
| FastAPI                 | Async Python backend API framework                                |
| Motor                   | Async MongoDB driver for Python                                   |
| MongoDB Atlas           | Cloud database with 2dsphere geospatial indexes and transactions  |
| Redis                   | Pub/Sub broker for real-time WebSocket chat                       |
| OpenAI API              | LLM inference for all AI agents (JSON Mode enforced)              |
| LangChain / LangGraph   | Multi-agent orchestration and parallel sub-agent dispatch         |
| Stripe Connect          | P2P marketplace split payments and webhook event handling         |
| httpx                   | Async HTTP client for PVGIS and GeoIP API calls                  |
| Pydantic v2             | Strict data validation and agent output schema enforcement        |
| passlib + bcrypt        | Secure password hashing                                           |
| pydantic-settings       | Environment variable management                                   |

---

## 🔬 Scientific Engine (The FQ Core)

The energy production estimate uses the standard photovoltaic conversion formula:

```
E = A × r × H × PR
```

Where each variable has a precise physical meaning:

| Variable | Meaning                                               | Source / Value              |
|----------|-------------------------------------------------------|-----------------------------|
| `A`      | Rooftop area in m²                                    | Turf.js from Mapbox polygon |
| `r`      | Photovoltaic panel efficiency (monocrystalline)       | 20.5% (0.205)               |
| `H`      | Annual global irradiation on a fixed surface (kWh/m²) | PVGIS API — EU Commission   |
| `PR`     | Performance Ratio (system losses, wiring, inverter)   | 75% (0.75) — IEC standard   |
| `E`      | Estimated annual energy production in kWh/year        | Calculated result            |

**Fiscal logic** is applied post-calculation using Portugal's exact VAT differentiation by region and product type, with a specific branch for Tarifa Social de Energia beneficiaries (33.8% electricity discount applied to payback period).

---

## 🤖 Multi-Agent AI System

The AI pipeline is a fully async Python system built with LangChain/LangGraph:

```
User Input (area, coordinates, region)
          │
          ▼
  Orchestrator Agent
  (receives raw physics output + geographic context)
          │
    ┌─────┼──────┐
    ▼     ▼      ▼    (parallel dispatch)
  Agent 1  Agent 2  Agent 3
  │        │        │
  Physical- Financial  Sustainable
  Chemical  & Fiscal   Viability
  Analyst   Specialist Consultant
    │     │      │
    └─────┴──────┘
          │
          ▼
  Orchestrator consolidates all three responses
  into a single Pydantic-validated JSON
          │
          ▼
  Persisted to MongoDB Atlas
```

| Agent | Role |
|-------|------|
| **Orchestrator** | Receives physics inputs, dispatches sub-agents in parallel, consolidates output into a strict Pydantic schema |
| **Sub-Agent 1 — Physical-Chemical Analyst** | Analyses thermal behaviour of panels, temperature-induced efficiency losses for the detected Portuguese region, and photovoltaic cell conversion science |
| **Sub-Agent 2 — Financial & Fiscal Specialist** | Calculates payback period against liberalised electricity tariffs, validates reduced VAT applicability, and quantifies the Tarifa Social impact |
| **Sub-Agent 3 — Sustainable Viability Consultant** | Computes CO₂ equivalent avoidance in tonnes, and designs a personalised "Solar Window" strategy for shifting household energy consumption to peak irradiation hours |

All agent responses are forced into **OpenAI JSON Mode** and validated by a strict Pydantic v2 schema before being written to the database.

---

## 📦 Prerequisites

- Node.js 20+
- Python 3.11+
- MongoDB Atlas cluster (with a user that has read/write access)
- Redis instance (local or hosted)
- Mapbox account with a public token
- OpenAI API key
- Stripe account with Connect enabled (secret key + webhook secret)
- `pnpm` recommended for the frontend

---

## 🚀 Getting Started

**1. Clone the repository**

```bash
git clone https://github.com/EduhxH/reisolari.git
cd reisolari
```

**2. Backend setup**

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # fill in all keys
uvicorn app.main:app --reload
```

**3. Frontend setup**

```bash
cd ../frontend
pnpm install
cp .env.example .env.local      # fill in all keys
pnpm dev
```

**4. Stripe webhook (local)**

```bash
stripe listen --forward-to localhost:8000/api/v1/payments/webhook
```

---

## ⚙️ Configuration

**`backend/.env`**

```env
# App
ENVIRONMENT=development
SECRET_KEY=your_secret_key

# MongoDB Atlas
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/reisolari

# Redis
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=sk-...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**`frontend/.env.local`**

```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 📁 Project Structure

```
reisolari/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI entry point
│   │   ├── core/
│   │   │   ├── config.py            # pydantic-settings environment config
│   │   │   ├── database.py          # Motor async MongoDB connection + 2dsphere index setup
│   │   │   └── security.py          # bcrypt password hashing (passlib)
│   │   ├── agents/
│   │   │   ├── orchestrator.py      # Orchestrator agent — parallel dispatch + consolidation
│   │   │   ├── physical_analyst.py  # Sub-Agent 1: physical-chemical analysis
│   │   │   ├── financial_analyst.py # Sub-Agent 2: financial & fiscal analysis
│   │   │   ├── sustainability.py    # Sub-Agent 3: CO₂ impact + Solar Window strategy
│   │   │   └── schemas.py           # Pydantic v2 schemas for agent output (JSON Mode)
│   │   ├── api/
│   │   │   ├── simulation.py        # POST /api/v1/simulate — physics + agent pipeline
│   │   │   ├── listings.py          # CRUD for solar system marketplace listings
│   │   │   ├── payments.py          # Stripe Checkout Session + webhook handler
│   │   │   ├── chat.py              # WebSocket endpoint + Redis Pub/Sub
│   │   │   └── auth.py              # User registration / login
│   │   ├── models/
│   │   │   ├── user.py              # User Pydantic schema (GeoJSON Point)
│   │   │   ├── listing.py           # Listing schema (electrical specs + GeoJSON Polygon)
│   │   │   └── simulation.py        # Simulation result schema
│   │   └── services/
│   │       ├── pvgis.py             # httpx async call to PVGIS EU Commission API
│   │       ├── geoip.py             # ipapi.co GeoIP with X-Forwarded-For handling
│   │       └── physics.py           # E = A × r × H × PR engine + fiscal logic
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # Landing page
│   │   ├── simulate/
│   │   │   └── page.tsx             # Map + simulation form
│   │   └── dashboard/
│   │       └── page.tsx             # AI analysis dashboard
│   ├── components/
│   │   ├── RoofMapDrawer.tsx        # Mapbox GL Draw + Turf.js area calculator
│   │   ├── SimulationDashboard.tsx  # Physics results + per-agent AI analysis cards
│   │   ├── GdprConsentCheckbox.tsx  # Explicit GDPR consent before data capture
│   │   └── ChatWidget.tsx           # P2P real-time WebSocket chat
│   ├── lib/
│   │   └── api.ts                   # Typed fetch client for all backend endpoints
│   ├── package.json
│   └── .env.example
└── README.md
```

---

## 🏗️ Architecture Overview

```
Browser (Next.js 14)
      │
      ├── Mapbox GL JS + Turf.js  →  rooftop polygon + area in m²
      ├── REST (fetch)            →  POST /api/v1/simulate
      └── WebSocket               →  /ws/chat/{listing_id}
                    │
                    ▼
          FastAPI Backend
                    │
     ┌──────────────┼────────────────┐
     ▼              ▼                ▼
  GeoIP API      PVGIS API       Stripe Connect
  (ipapi.co)  (EU Commission)   (split payments)
                    │
                    ▼
         Physics Engine
         E = A × r × H × PR
         + Fiscal logic (PT)
                    │
                    ▼
      AI Orchestrator (LangGraph)
      ┌──────┬──────────┬───────┐
      ▼      ▼          ▼
   Agent1  Agent2    Agent3  (parallel)
      └──────┴──────────┘
                    │ consolidated JSON
                    ▼
          MongoDB Atlas
          (2dsphere indexes + ACID transactions)
                    │
          Redis Pub/Sub
          (WebSocket chat broker)
```

---

## 🗺️ Roadmap

- [x] Monorepo structure (`backend/` + `frontend/`)
- [ ] Motor + MongoDB Atlas connection with 2dsphere indexes
- [ ] GeoIP detection with `X-Forwarded-For` parsing
- [ ] PVGIS async integration with `httpx.AsyncClient`
- [ ] Physics engine: `E = A × r × H × PR` with fiscal branches
- [ ] Sub-Agent 1: Physical-Chemical Analyst
- [ ] Sub-Agent 2: Financial & Fiscal Specialist
- [ ] Sub-Agent 3: Sustainable Viability Consultant
- [ ] Orchestrator with parallel dispatch and Pydantic JSON Mode output
- [ ] Stripe Connect Checkout Session (8% platform fee split)
- [ ] Stripe webhook with ACID MongoDB transaction
- [ ] WebSocket chat with Redis Pub/Sub + MongoDB `$push`
- [ ] Mapbox satellite map with GL Draw polygon tool
- [ ] Turf.js area calculation and coordinate extraction
- [ ] GDPR consent checkbox before data capture
- [ ] AI analysis dashboard (physics data + per-agent cards)
- [ ] bcrypt authentication with passlib

---

## ⚠️ Known Limitations

- **Early development** — only the monorepo scaffold exists so far; all modules are being built.
- **PVGIS rate limits** — the EU Commission's PVGIS API is a public service with no authentication; request frequency should be kept reasonable.
- **Stripe Connect onboarding** — sellers must complete Stripe's Connect onboarding flow before receiving split payments; this requires a real Stripe account in test or live mode.
- **MongoDB Atlas free tier** — the free M0 cluster has storage and connection limits; for heavy development use, an M10 or higher is recommended.
- **GeoIP accuracy** — `ipapi.co` free tier has 1,000 requests/day and may not resolve VPN or shared office IPs to the correct Portuguese region.

---

## 🧠 What I Learned

- **PVGIS API and photovoltaic science** — understanding the physical meaning of irradiation (kWh/m²/year), Performance Ratio, and panel efficiency, and integrating real EU Commission solar data into a production application.
- **Multi-agent AI orchestration** — designing an async Python pipeline where a manager agent dispatches specialist sub-agents in parallel and consolidates structured outputs using LangGraph and Pydantic JSON Mode.
- **Geospatial data in MongoDB** — working with GeoJSON Point and Polygon schemas, creating 2dsphere indexes, and running geospatial queries in Atlas.
- **Stripe Connect split payments** — implementing `application_fee_amount` and `transfer_data.destination` for marketplace fee collection, and validating webhook signatures for production-safe event handling.
- **ACID transactions in MongoDB** — using `session.start_transaction()` to atomically update a listing status and create an invoice within a single consistent operation.
- **Redis Pub/Sub for WebSockets** — building a scalable real-time chat system where FastAPI WebSocket handlers subscribe to Redis channels, decoupled from each other and from the HTTP layer.
- **Portuguese fiscal complexity** — mapping the exact VAT rates across three tax regions (Continente, Madeira, Açores) for two product categories, and applying the Tarifa Social de Energia discount correctly in payback calculations.

---

## 🤝 Contributing

Contributions are welcome. If you find a bug or want to propose a feature, open an issue first so we can discuss it before any code is written. When submitting a pull request, keep the scope focused — one fix or feature per PR.

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

---

<div align="center">
  Made with 💜 by <a href="https://github.com/EduhxH">EduhxH</a>
</div>
