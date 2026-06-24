"""Tests for the media public-URL logic (robust to BACKEND_PUBLIC_URL config)."""

import unittest
from types import SimpleNamespace

from app.api.v1.media import _public_base
from app.core.config import settings


def _req(headers=None, scheme="http", netloc="internal:8000"):
    return SimpleNamespace(headers=headers or {}, url=SimpleNamespace(scheme=scheme, netloc=netloc))


class TestPublicBase(unittest.TestCase):
    def setUp(self):
        self._orig = settings.BACKEND_PUBLIC_URL

    def tearDown(self):
        settings.BACKEND_PUBLIC_URL = self._orig

    def test_uses_configured_public_url(self):
        settings.BACKEND_PUBLIC_URL = "https://reisolari-backend.onrender.com/"
        self.assertEqual(_public_base(_req()), "https://reisolari-backend.onrender.com")

    def test_derives_https_from_proxy_when_localhost(self):
        settings.BACKEND_PUBLIC_URL = "http://localhost:8000"
        req = _req(headers={"x-forwarded-proto": "https", "x-forwarded-host": "app.onrender.com"})
        self.assertEqual(_public_base(req), "https://app.onrender.com")

    def test_derives_from_request_when_unset(self):
        settings.BACKEND_PUBLIC_URL = ""
        req = _req(headers={"host": "myhost.com"}, scheme="https")
        self.assertEqual(_public_base(req), "https://myhost.com")

    def test_never_returns_localhost_when_proxy_present(self):
        settings.BACKEND_PUBLIC_URL = "http://localhost:8000"
        req = _req(headers={"x-forwarded-proto": "https", "host": "live.example.pt"})
        self.assertNotIn("localhost", _public_base(req))


if __name__ == "__main__":
    unittest.main()
