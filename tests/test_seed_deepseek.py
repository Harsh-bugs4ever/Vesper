"""The demo seeder must use DeepSeek only when explicitly enabled."""
import json
from types import SimpleNamespace

import pytest

from scripts import seed


def test_deepseek_json_uses_the_json_chat_endpoint(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    captured = {}

    def post(url, *, headers, json, timeout):
        captured.update(url=url, headers=headers, body=json, timeout=timeout)
        return SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: {"choices": [{"message": {"content": '{"tasks": []}'}}]},
        )

    monkeypatch.setattr(seed.httpx, "post", post)
    assert seed._deepseek_json("Return JSON tasks") == {"tasks": []}
    assert captured["url"] == "https://api.deepseek.com/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["body"]["model"] == seed.DEEPSEEK_MODEL
    assert captured["body"]["response_format"] == {"type": "json_object"}
    assert captured["body"]["thinking"] == {"type": "disabled"}


def test_missing_key_and_empty_response_do_not_fake_ai_success(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="DEEPSEEK_API_KEY"):
        seed._deepseek_json("Return JSON tasks")

    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(seed.httpx, "post", lambda *args, **kwargs: SimpleNamespace(
        raise_for_status=lambda: None,
        json=lambda: {"choices": [{"message": {"content": ""}}]},
    ))
    with pytest.raises(RuntimeError, match="empty JSON"):
        seed._deepseek_json("Return JSON tasks")


def test_old_provider_cache_is_replaced_and_failures_are_not_hidden(monkeypatch):
    class Cache:
        parent = SimpleNamespace(mkdir=lambda **kwargs: None)

        def __init__(self):
            self.content = json.dumps({"model": "old-provider", "tasks": [{"title": "old"}]})

        def exists(self):
            return True

        def read_text(self, **kwargs):
            return self.content

        def write_text(self, content, **kwargs):
            self.content = content

    cache = Cache()
    monkeypatch.setattr(seed, "AI_CACHE", cache)
    generated = {"model": seed.DEEPSEEK_MODEL, "tasks": [{"title": "new"}]}
    monkeypatch.setattr(seed, "_generate_ai_content", lambda: generated)

    assert seed._load_ai_content(use_deepseek=True, refresh_ai=False) == generated
    assert json.loads(cache.read_text()) == generated

    monkeypatch.setattr(seed, "_generate_ai_content", lambda: (_ for _ in ()).throw(
        RuntimeError("DeepSeek unavailable")))
    with pytest.raises(RuntimeError, match="DeepSeek unavailable"):
        seed._load_ai_content(use_deepseek=True, refresh_ai=True)
    assert seed._load_ai_content(use_deepseek=False, refresh_ai=False) == generated
