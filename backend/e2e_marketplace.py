"""
E2E in-process do ciclo completo do Marketplace P2P contra o Atlas REAL.

Padrão: httpx + ASGITransport(app) + override de get_firebase_user /
get_optional_firebase_user (ator comutável por uid). Modera com ADMIN_UIDS
forçado em memória. Cria dados reais e LIMPA tudo no fim (try/finally).

Correr a partir de backend/:  .venv/Scripts/python.exe e2e_marketplace.py
"""
from __future__ import annotations

import asyncio
import sys
import uuid

# Consola Windows é cp1252 e rebenta em '★'/'€'; força UTF-8 nos prints.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import httpx
from bson import ObjectId
from httpx import ASGITransport

from app.main import app
from app.api.deps import get_firebase_user, get_optional_firebase_user, get_database
from app.core.config import settings
from app.db.mongo import get_db_client

# --- atores (uids Firebase simulados) -------------------------------------
SELLER = "e2e_seller_" + uuid.uuid4().hex[:8]
BUYER = "e2e_buyer_" + uuid.uuid4().hex[:8]
REP2 = "e2e_rep2_" + uuid.uuid4().hex[:8]
REP3 = "e2e_rep3_" + uuid.uuid4().hex[:8]
ADMIN = "e2e_admin_" + uuid.uuid4().hex[:8]
TEST_UIDS = [SELLER, BUYER, REP2, REP3, ADMIN]

TOKEN = "e2etok" + uuid.uuid4().hex[:10]  # marcador único para isolar a pesquisa nos meus anúncios

_ACTOR = {"sub": None}


def act(uid):
    _ACTOR["sub"] = uid


async def _override_required():
    return {"sub": _ACTOR["sub"]}


async def _override_optional():
    return {"sub": _ACTOR["sub"]} if _ACTOR["sub"] else None


# --- relatório ------------------------------------------------------------
results: list[tuple[bool, str, str]] = []


def check(name: str, ok: bool, detail: str = ""):
    results.append((bool(ok), name, detail))
    mark = "PASS" if ok else "FAIL"
    line = f"[{mark}] {name}"
    if detail and not ok:
        line += f"  -> {detail}"
    print(line, flush=True)


def listing_payload(title_suffix, *, condition, listing_type, price_cents):
    return {
        "title": f"{TOKEN} Painel {title_suffix}",
        "description": "Anuncio de teste e2e automatizado. Painel solar em bom estado, descricao real.",
        "category_id": "paineis-monocristalinos",
        "category_path": ["Painéis solares", "Monocristalinos"],
        "condition": condition,
        "attributes": {
            "marca": "E2E", "modelo": "X450", "potencia_w": 450,
            "eficiencia_pct": 21, "tecnologia": "Mono PERC",
            "num_celulas": 144, "tempo_uso": "Novo (nunca usado)",
        },
        "price_cents": price_cents,
        "currency": "eur",
        "listing_type": listing_type,
        "stock": 1,
        "delivery_pickup": True,
        "delivery_shipping": False,
        "postal_code": "1000-001",
        "city": "Lisboa",
        "image_urls": [],
    }


async def run(client: httpx.AsyncClient):
    db = get_database()
    l1_id = l2_id = None
    room_id = None

    # 1) PUBLICAR --------------------------------------------------------
    act(SELLER)
    r = await client.post("/api/v1/listings/", json=listing_payload("Premium", condition="novo", listing_type="premium", price_cents=50000))
    ok = r.status_code == 201
    check("1. Publicar L1 (premium) -> 201", ok, f"{r.status_code} {r.text[:200]}")
    if ok:
        d = r.json()
        l1_id = d["id"]
        check("1b. L1 active=true & status=active", d.get("active") is True and d.get("status") == "active", str(d.get("active")) + "/" + str(d.get("status")))

    r = await client.post("/api/v1/listings/", json=listing_payload("Classico", condition="usado_como_novo", listing_type="classico", price_cents=30000))
    if r.status_code == 201:
        l2_id = r.json()["id"]
    check("1c. Publicar L2 (classico) -> 201", r.status_code == 201, f"{r.status_code} {r.text[:200]}")

    if not l1_id or not l2_id:
        check("ABORT: sem ids de listing, salto restante do fluxo", False, "criação falhou")
        return l1_id, l2_id, room_id

    # 2) DESCOBERTA / FILTROS / ORDENAÇÃO --------------------------------
    r = await client.get("/api/v1/listings/", params={"search": TOKEN, "sort": "recent"})
    items = r.json() if r.status_code == 200 else []
    ids = [i["id"] for i in items]
    check("2. Pesquisa por token devolve exatamente L1 e L2", set(ids) == {l1_id, l2_id}, f"ids={ids}")
    check("2b. Premium primeiro (sort=recent)", ids[:1] == [l1_id] if ids else False, f"ordem={ids}")

    r = await client.get("/api/v1/listings/", params={"search": TOKEN, "sort": "price_asc"})
    ids_asc = [i["id"] for i in r.json()]
    check("2c. sort=price_asc -> L2(300€) antes de L1(500€)", ids_asc == [l2_id, l1_id], f"ordem={ids_asc}")

    r = await client.get("/api/v1/listings/", params={"search": TOKEN, "sort": "price_desc"})
    ids_desc = [i["id"] for i in r.json()]
    check("2d. sort=price_desc -> L1 antes de L2", ids_desc == [l1_id, l2_id], f"ordem={ids_desc}")

    r = await client.get("/api/v1/listings/", params={"search": TOKEN, "condition": "novo"})
    ids_cond = [i["id"] for i in r.json()]
    check("2e. filtro condition=novo -> só L1", ids_cond == [l1_id], f"ids={ids_cond}")

    r = await client.get("/api/v1/listings/", params={"search": TOKEN, "category_id": "paineis-monocristalinos"})
    check("2f. filtro category_id -> contém L1 e L2", {i["id"] for i in r.json()} >= {l1_id, l2_id}, "")

    # 3) DETALHE ---------------------------------------------------------
    r = await client.get(f"/api/v1/listings/{l1_id}")
    check("3. Detalhe L1 -> 200 e id correto", r.status_code == 200 and r.json().get("id") == l1_id, f"{r.status_code}")

    # 3v) CONTADOR DE VISUALIZAÇÕES -------------------------------------
    act(BUYER)
    r = await client.post(f"/api/v1/listings/{l1_id}/view", json={})
    check("3v. Buyer regista view -> views_count=1", r.status_code == 200 and r.json().get("views_count") == 1, f"{r.status_code} {r.text[:120]}")
    r = await client.post(f"/api/v1/listings/{l1_id}/view", json={})
    check("3v-b. Mesmo viewer não duplica (continua 1)", r.json().get("views_count") == 1, str(r.json()))
    act(SELLER)
    r = await client.post(f"/api/v1/listings/{l1_id}/view", json={})
    check("3v-c. Owner não conta a própria view (continua 1)", r.json().get("views_count") == 1, str(r.json()))
    act(None)  # anónimo
    r = await client.post(f"/api/v1/listings/{l1_id}/view", json={"vid": "e2e-anon-1"})
    check("3v-d. View anónima (vid) conta -> 2", r.json().get("views_count") == 2, str(r.json()))
    r = await client.post(f"/api/v1/listings/{l1_id}/view", json={"vid": "e2e-anon-1"})
    check("3v-e. Mesma vid anónima não duplica (continua 2)", r.json().get("views_count") == 2, str(r.json()))
    r = await client.get(f"/api/v1/listings/{l1_id}")
    check("3v-f. Detalhe expõe views_count=2", r.json().get("views_count") == 2, str(r.json().get("views_count")))

    # 4) CHAT ------------------------------------------------------------
    act(SELLER)
    r = await client.post("/api/v1/chat/rooms", json={"listing_id": l1_id})
    check("4. Seller não pode abrir conversa no próprio anúncio -> 400", r.status_code == 400, f"{r.status_code}")

    act(BUYER)
    r = await client.post("/api/v1/chat/rooms", json={"listing_id": l1_id})
    ok = r.status_code == 201
    check("4b. Buyer abre conversa -> 201", ok, f"{r.status_code} {r.text[:200]}")
    if ok:
        room_id = r.json()["id"]

    if room_id:
        r = await client.post(f"/api/v1/chat/rooms/{room_id}/messages", json={"content": "Bom dia, o painel ainda está disponível?"})
        check("4c. Mensagem normal -> 201 sem warning", r.status_code == 201 and r.json().get("warning") is None, f"{r.status_code} warn={r.json().get('warning') if r.status_code==201 else ''}")

        r = await client.post(f"/api/v1/chat/rooms/{room_id}/messages", json={"content": "Liga-me 912345678 e paga por MBWay fora da plataforma"})
        warned = r.status_code == 201 and bool(r.json().get("warning"))
        check("4d. Mensagem-isco -> warning anti-golpe devolvido", warned, f"{r.status_code} {r.text[:150]}")

        r = await client.get(f"/api/v1/chat/rooms/{room_id}/messages")
        msgs = r.json() if r.status_code == 200 else []
        has_system = any(m.get("kind") == "system" for m in msgs)
        has_flagged = any(m.get("flagged") for m in msgs)
        check("4e. Mensagem de sistema (aviso) injetada na sala", has_system, f"kinds={[m.get('kind') for m in msgs]}")
        check("4f. Mensagem-isco marcada flagged", has_flagged, "")

        # notificação new_message ao seller
        act(SELLER)
        r = await client.get("/api/v1/notifications/")
        notes = r.json() if r.status_code == 200 else []
        check("4g. Seller recebeu notificação new_message", any(n.get("type") == "new_message" for n in notes), f"types={[n.get('type') for n in notes]}")

    # 5) FAVORITOS -------------------------------------------------------
    act(BUYER)
    r = await client.post("/api/v1/favorites/", json={"listing_id": l1_id})
    check("5. Buyer favorita L1 -> count=1", r.status_code == 201 and r.json().get("count") == 1, f"{r.status_code} {r.text[:150]}")

    r = await client.get(f"/api/v1/listings/{l1_id}")
    check("5b. favorites_count do anúncio = 1", r.json().get("favorites_count") == 1, str(r.json().get("favorites_count")))

    act(SELLER)
    r = await client.get("/api/v1/notifications/")
    check("5c. Seller recebeu notificação 'favorite' (anónima)", any(n.get("type") == "favorite" for n in r.json()), "")

    act(BUYER)
    r = await client.delete(f"/api/v1/favorites/{l1_id}")
    check("5d. Remover favorito -> count=0", r.status_code == 200 and r.json().get("count") == 0, f"{r.status_code}")
    r = await client.get(f"/api/v1/listings/{l1_id}")
    check("5e. favorites_count volta a 0", r.json().get("favorites_count") == 0, str(r.json().get("favorites_count")))

    # 6) AVALIAÇÕES ------------------------------------------------------
    act(REP2)  # rep2 nunca interagiu em chat -> gating
    r = await client.post(f"/api/v1/profiles/{SELLER}/ratings", json={"stars": 5})
    check("6. Avaliar sem interação prévia -> 403", r.status_code == 403, f"{r.status_code}")

    act(BUYER)  # buyer interagiu (sala criada)
    r = await client.post(f"/api/v1/profiles/{BUYER}/ratings", json={"stars": 5})
    check("6b. Auto-avaliação -> 400", r.status_code == 400, f"{r.status_code}")

    r = await client.post(f"/api/v1/profiles/{SELLER}/ratings", json={"stars": 4, "comment": "Bom vendedor"})
    check("6c. Buyer avalia seller -> 201", r.status_code == 201, f"{r.status_code} {r.text[:150]}")
    r = await client.post(f"/api/v1/profiles/{SELLER}/ratings", json={"stars": 4})  # repetir = upsert
    check("6d. Reavaliar = upsert (continua 1 por par)", r.status_code == 201, f"{r.status_code}")

    act(SELLER)
    r = await client.post(f"/api/v1/profiles/{BUYER}/ratings", json={"stars": 5, "comment": "Bom comprador"})
    check("6e. Seller avalia buyer -> 201", r.status_code == 201, f"{r.status_code}")

    # contagem de ratings do seller deve ser exatamente 1 (upsert)
    n_ratings = await db.ratings.count_documents({"rated_uid": SELLER})
    check("6f. Seller tem exatamente 1 rating (upsert dedup)", n_ratings == 1, f"count={n_ratings}")

    r = await client.get("/api/v1/profiles/summary", params={"uids": f"{SELLER},{BUYER}"})
    summ = r.json() if r.status_code == 200 else {}
    check("6g. summary reflete média do seller (4★) e buyer (5★)",
          summ.get(SELLER, {}).get("rating", {}).get("average") == 4.0 and summ.get(BUYER, {}).get("rating", {}).get("average") == 5.0,
          str(summ))

    act(BUYER)
    r = await client.get(f"/api/v1/profiles/{SELLER}")
    pub = r.json() if r.status_code == 200 else {}
    check("6h. Perfil público do seller: can_rate=true, my_rating presente", pub.get("can_rate") is True and pub.get("my_rating") is not None, str({k: pub.get(k) for k in ("can_rate", "my_rating", "rating")}))

    # buyer recebeu notificação de rating (do seller)
    r = await client.get("/api/v1/notifications/")
    check("6i. Buyer recebeu notificação 'rating'", any(n.get("type") == "rating" for n in r.json()), "")

    # 7) DENÚNCIAS / AUTO-FLAG ------------------------------------------
    act(SELLER)
    r = await client.post("/api/v1/reports/", json={"target_type": "listing", "target_id": l1_id, "reason": "fraude"})
    check("7. Denunciar próprio anúncio -> 400", r.status_code == 400, f"{r.status_code}")

    for i, uid in enumerate([BUYER, REP2, REP3], start=1):
        act(uid)
        r = await client.post("/api/v1/reports/", json={"target_type": "listing", "target_id": l1_id, "reason": "proibido", "detail": f"reporter {i}"})
        check(f"7{chr(96+i)}. Denúncia de reporter {i} -> 201", r.status_code == 201, f"{r.status_code} {r.text[:150]}")

    doc = await db.listings.find_one({"_id": ObjectId(l1_id)})
    check("7e. L1 auto-flagged (3 reporters distintos)", doc.get("flagged_for_review") is True, f"flag={doc.get('flagged_for_review')}")

    act(BUYER)
    r = await client.get("/api/v1/reports/mine")
    check("7f. /reports/mine inclui listing:L1", f"listing:{l1_id}" in r.json(), str(r.json())[:150])

    # denúncia em L2 (1 só) para testar dismiss
    act(BUYER)
    r = await client.post("/api/v1/reports/", json={"target_type": "listing", "target_id": l2_id, "reason": "spam"})
    check("7g. Denúncia única em L2 -> 201", r.status_code == 201, f"{r.status_code}")

    # 8) MODERAÇÃO -------------------------------------------------------
    act(BUYER)  # não-admin
    r = await client.get("/api/v1/reports/admin")
    check("8. Não-admin em /reports/admin -> 403", r.status_code == 403, f"{r.status_code}")

    act(ADMIN)
    r = await client.get("/api/v1/reports/admin")
    groups = r.json() if r.status_code == 200 else []
    g1 = next((g for g in groups if g.get("target_id") == l1_id), None)
    check("8b. Admin vê grupo de L1 com count>=3", bool(g1) and g1.get("count", 0) >= 3, f"group={g1}")

    r = await client.post("/api/v1/reports/admin/resolve", json={"target_type": "listing", "target_id": l1_id, "action": "remove"})
    check("8c. Resolver L1 com 'remove' -> 200", r.status_code == 200, f"{r.status_code} {r.text[:150]}")
    doc = await db.listings.find_one({"_id": ObjectId(l1_id)})
    check("8d. L1 active=false e flag limpa após remove", doc.get("active") is False and not doc.get("flagged_for_review"), f"active={doc.get('active')} flag={doc.get('flagged_for_review')}")
    n_open_l1 = await db.reports.count_documents({"target_type": "listing", "target_id": l1_id, "status": "open"})
    check("8e. Denúncias de L1 resolvidas (0 open)", n_open_l1 == 0, f"open={n_open_l1}")

    r = await client.post("/api/v1/reports/admin/resolve", json={"target_type": "listing", "target_id": l2_id, "action": "dismiss"})
    check("8f. Resolver L2 com 'dismiss' -> 200", r.status_code == 200, f"{r.status_code}")
    doc = await db.listings.find_one({"_id": ObjectId(l2_id)})
    check("8g. L2 continua active após dismiss", doc.get("active") is True, f"active={doc.get('active')}")

    return l1_id, l2_id, room_id


async def cleanup():
    db = get_database()
    summary = {}
    # rooms criadas pelos atores -> recolher ids para apagar mensagens
    room_ids = [r["_id"] async for r in db.chat_rooms.find({"$or": [{"buyer_uid": {"$in": TEST_UIDS}}, {"seller_uid": {"$in": TEST_UIDS}}]})]
    summary["chat_messages"] = (await db.chat_messages.delete_many({"room_id": {"$in": room_ids}})).deleted_count if room_ids else 0
    summary["chat_rooms"] = (await db.chat_rooms.delete_many({"$or": [{"buyer_uid": {"$in": TEST_UIDS}}, {"seller_uid": {"$in": TEST_UIDS}}]})).deleted_count
    listing_ids = [d["_id"] async for d in db.listings.find({"owner_id": {"$in": TEST_UIDS}}, {"_id": 1})]
    summary["listing_views"] = (await db.listing_views.delete_many({"listing_id": {"$in": listing_ids}})).deleted_count if listing_ids else 0
    summary["listings"] = (await db.listings.delete_many({"owner_id": {"$in": TEST_UIDS}})).deleted_count
    summary["favorites"] = (await db.favorites.delete_many({"user_uid": {"$in": TEST_UIDS}})).deleted_count
    summary["notifications"] = (await db.notifications.delete_many({"user_uid": {"$in": TEST_UIDS}})).deleted_count
    summary["ratings"] = (await db.ratings.delete_many({"$or": [{"rater_uid": {"$in": TEST_UIDS}}, {"rated_uid": {"$in": TEST_UIDS}}]})).deleted_count
    summary["reports"] = (await db.reports.delete_many({"reporter_uid": {"$in": TEST_UIDS}})).deleted_count
    summary["user_profiles"] = (await db.user_profiles.delete_many({"_id": {"$in": TEST_UIDS}})).deleted_count
    print("\n--- CLEANUP (docs apagados) ---", flush=True)
    for k, v in summary.items():
        print(f"  {k}: {v}", flush=True)
    # verificação: nada deve sobrar com os uids de teste
    leftover = (
        await db.listings.count_documents({"owner_id": {"$in": TEST_UIDS}})
        + await db.chat_rooms.count_documents({"$or": [{"buyer_uid": {"$in": TEST_UIDS}}, {"seller_uid": {"$in": TEST_UIDS}}]})
        + await db.favorites.count_documents({"user_uid": {"$in": TEST_UIDS}})
        + await db.ratings.count_documents({"$or": [{"rater_uid": {"$in": TEST_UIDS}}, {"rated_uid": {"$in": TEST_UIDS}}]})
        + await db.reports.count_documents({"reporter_uid": {"$in": TEST_UIDS}})
        + await db.notifications.count_documents({"user_uid": {"$in": TEST_UIDS}})
    )
    check("9. Cleanup completo (0 docs de teste a sobrar)", leftover == 0, f"sobraram={leftover}")


async def main():
    settings.ADMIN_UIDS = ADMIN  # desbloqueia get_admin_user só para o ator ADMIN
    app.dependency_overrides[get_firebase_user] = _override_required
    app.dependency_overrides[get_optional_firebase_user] = _override_optional
    transport = ASGITransport(app=app)
    print(f"== E2E Marketplace (Atlas real) | token={TOKEN} ==", flush=True)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test", follow_redirects=True, timeout=30) as client:
            await run(client)
    except Exception as exc:  # noqa: BLE001
        import traceback
        check("EXCEÇÃO não tratada durante o fluxo", False, repr(exc))
        traceback.print_exc()
    finally:
        try:
            await cleanup()
        except Exception as exc:  # noqa: BLE001
            check("Cleanup falhou", False, repr(exc))
            import traceback
            traceback.print_exc()
        get_db_client().close()

    passed = sum(1 for ok, _, _ in results if ok)
    failed = [name for ok, name, _ in results if not ok]
    print(f"\n==== RESUMO: {passed}/{len(results)} PASS ====", flush=True)
    if failed:
        print("FALHAS:", flush=True)
        for name in failed:
            print(f"  - {name}", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
