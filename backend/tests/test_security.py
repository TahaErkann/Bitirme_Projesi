"""Şifre hashleme ve JWT üretim/doğrulama unit testleri."""
import pytest

from app.core.exceptions import AuthenticationException
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip():
    pwd = "Str0ngP@ss!"
    h = hash_password(pwd)
    assert h != pwd
    assert verify_password(pwd, h)
    assert not verify_password("wrong", h)


def test_access_token_roundtrip():
    token = create_access_token("user-123")
    payload = decode_token(token, expected_type="access")
    assert payload["sub"] == "user-123"


def test_refresh_token_type_check():
    refresh = create_refresh_token("user-123")
    with pytest.raises(AuthenticationException):
        decode_token(refresh, expected_type="access")
