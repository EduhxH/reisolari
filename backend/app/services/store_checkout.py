"""Direct Stripe Checkout for the Reisolari store (platform is the merchant).

Unlike the P2P Connect flow in ``stripe_service.py``, the store sells its own
catalog, so we use a plain Checkout Session with no ``transfer_data``. Prices are
always recomputed here from server-trusted net prices; the client cart is never
trusted for amounts. VAT follows the Portuguese reduced rate for PV modules,
reused from the fiscal service so the store and the simulator stay consistent.
"""

from typing import Optional

import stripe
from pydantic import BaseModel

from app.core.config import settings
from app.services.fiscal import RegionType, get_vat_rates
from app.schemas.order import FLAT_SHIPPING_CENTS, FREE_SHIPPING_THRESHOLD_CENTS

stripe.api_key = settings.STRIPE_SECRET_KEY


class PricedItem(BaseModel):
    name: str
    unit_price_net_cents: int
    quantity: int


class OrderPricing(BaseModel):
    vat_rate: float
    subtotal_net_cents: int
    vat_cents: int
    shipping_cents: int
    total_cents: int
    stripe_line_items: list[dict]


def compute_pricing(items: list[PricedItem], region: RegionType, currency: str = "eur") -> OrderPricing:
    """Compute the order totals and the matching Stripe line items.

    Each product line is charged VAT-inclusive (net price grossed up by the
    regional PV VAT rate) so the Stripe total equals ``total_cents`` exactly.
    """
    vat_rate, _battery_rate = get_vat_rates(region)

    subtotal_net = 0
    subtotal_gross = 0
    line_items: list[dict] = []
    for item in items:
        gross_unit = round(item.unit_price_net_cents * (1 + vat_rate))
        subtotal_net += item.unit_price_net_cents * item.quantity
        subtotal_gross += gross_unit * item.quantity
        line_items.append(
            {
                "price_data": {
                    "currency": currency,
                    "product_data": {"name": item.name},
                    "unit_amount": gross_unit,
                },
                "quantity": item.quantity,
            }
        )

    vat_cents = subtotal_gross - subtotal_net
    shipping_cents = 0 if subtotal_net >= FREE_SHIPPING_THRESHOLD_CENTS else FLAT_SHIPPING_CENTS
    if shipping_cents > 0:
        line_items.append(
            {
                "price_data": {
                    "currency": currency,
                    "product_data": {"name": "Portes de envio (IVA incl.)"},
                    "unit_amount": shipping_cents,
                },
                "quantity": 1,
            }
        )

    return OrderPricing(
        vat_rate=vat_rate,
        subtotal_net_cents=subtotal_net,
        vat_cents=vat_cents,
        shipping_cents=shipping_cents,
        total_cents=subtotal_gross + shipping_cents,
        stripe_line_items=line_items,
    )


def create_checkout_session(
    *,
    order_number: str,
    line_items: list[dict],
    customer_email: str,
    success_url: str,
    cancel_url: str,
) -> stripe.checkout.Session:
    """Create a Stripe Checkout Session. Raises stripe.error.StripeError on failure."""
    return stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        line_items=line_items,
        customer_email=customer_email,
        locale="pt",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"order_number": order_number, "kind": "store_order"},
        payment_intent_data={"metadata": {"order_number": order_number, "kind": "store_order"}},
    )


def retrieve_session(session_id: str) -> Optional[stripe.checkout.Session]:
    try:
        return stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError:
        return None
