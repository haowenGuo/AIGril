import json
import math
import uuid
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.models.db_models import CommerceEntitlement, CreditLedgerEntry

settings = get_settings()


CATALOG: list[dict[str, Any]] = [
    {
        "id": "ailis-starter-character",
        "type": "character_pack",
        "title": "AILIS Origin Character",
        "subtitle": "默认角色、基础表情、欢迎动作和桌面运行时入口。",
        "priceLabel": "免费账号内置",
        "includedCredits": {"llm": settings.AILIS_STARTER_LLM_CREDITS, "tts": settings.AILIS_STARTER_TTS_CREDITS},
        "assetKey": "character:ailis-origin",
        "capabilities": ["default_vrm", "persona", "basic_motion", "local_runtime"],
    },
    {
        "id": "ailis-luminous-skin",
        "type": "skin_pack",
        "title": "Luminous Skin Pack",
        "subtitle": "面向正式商店的皮肤包示例，可绑定 Stripe Price 后售卖。",
        "priceLabel": "待绑定价格",
        "includedCredits": {"llm": 5, "tts": 2},
        "assetKey": "skin:luminous",
        "capabilities": ["skin", "expression_palette"],
    },
    {
        "id": "ailis-official-llm-credits",
        "type": "llm_credit_pack",
        "title": "Official LLM Credits",
        "subtitle": "通过 AILIS 官方流式网关消耗，不暴露供应商密钥。",
        "priceLabel": "积分包",
        "includedCredits": {"llm": 100, "tts": 0},
        "assetKey": "credits:llm",
        "capabilities": ["official_gateway", "stream_forwarding"],
    },
    {
        "id": "ailis-official-tts-credits",
        "type": "tts_credit_pack",
        "title": "Official TTS Credits",
        "subtitle": "用于后续 ElevenLabs / 官方语音网关结算。",
        "priceLabel": "积分包",
        "includedCredits": {"llm": 0, "tts": 50},
        "assetKey": "credits:tts",
        "capabilities": ["official_gateway", "voice"],
    },
    {
        "id": "ailis-membership",
        "type": "membership",
        "title": "AILIS Membership",
        "subtitle": "账号、会员、Stripe Checkout 和模型/TTS API 权限的上线基础。",
        "priceLabel": "Stripe Checkout",
        "includedCredits": {"llm": 0, "tts": 0},
        "assetKey": "membership:ailis",
        "capabilities": ["account", "stripe_checkout", "customer_portal"],
    },
]


def _json_dumps(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _json_loads(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        loaded = json.loads(value)
        return loaded if isinstance(loaded, dict) else {}
    except json.JSONDecodeError:
        return {}


def estimate_llm_credits(text: str, chars_per_credit: int | None = None) -> int:
    chars = max(len(text or ""), 1)
    unit = max(int(chars_per_credit or settings.AILIS_GATEWAY_LLM_CHARS_PER_CREDIT or 3000), 1)
    return max(math.ceil(chars / unit), 1)


def make_reference(prefix: str) -> str:
    return f"{prefix}:{uuid.uuid4().hex}"


class CommerceService:
    def __init__(self, db: AsyncSession | None):
        self.db = db

    def catalog(self) -> list[dict[str, Any]]:
        return CATALOG

    def serialize_entitlement(self, entitlement: CommerceEntitlement) -> dict[str, Any]:
        return {
            "id": entitlement.id,
            "productId": entitlement.product_id,
            "productType": entitlement.product_type,
            "title": entitlement.title,
            "assetKey": entitlement.asset_key,
            "status": entitlement.status,
            "source": entitlement.source,
            "metadata": _json_loads(entitlement.metadata_json),
            "grantedAt": entitlement.granted_at.isoformat() if entitlement.granted_at else None,
            "expiresAt": entitlement.expires_at.isoformat() if entitlement.expires_at else None,
        }

    def serialize_ledger_entry(self, entry: CreditLedgerEntry) -> dict[str, Any]:
        return {
            "id": entry.id,
            "creditType": entry.credit_type,
            "action": entry.action,
            "amount": entry.amount,
            "referenceId": entry.reference_id,
            "detail": _json_loads(entry.detail_json),
            "createdAt": entry.created_at.isoformat() if entry.created_at else None,
        }

    async def ensure_starter_profile(self, user_id: int) -> None:
        await self.grant_entitlement(
            user_id=user_id,
            product_id="ailis-starter-character",
            product_type="character_pack",
            title="AILIS Origin Character",
            asset_key="character:ailis-origin",
            source="starter",
            metadata={"runtime": "local", "commercialBoundary": "asset_entitlement"},
            commit=False,
        )
        await self.grant_credit_once(
            user_id=user_id,
            credit_type="llm",
            amount=max(int(settings.AILIS_STARTER_LLM_CREDITS or 0), 0),
            reference_id=f"starter:{user_id}:llm",
            detail={"reason": "starter official gateway credits"},
            commit=False,
        )
        await self.grant_credit_once(
            user_id=user_id,
            credit_type="tts",
            amount=max(int(settings.AILIS_STARTER_TTS_CREDITS or 0), 0),
            reference_id=f"starter:{user_id}:tts",
            detail={"reason": "starter official voice credits"},
            commit=False,
        )
        await self.db.commit()

    async def grant_entitlement(
        self,
        *,
        user_id: int,
        product_id: str,
        product_type: str,
        title: str,
        asset_key: str,
        source: str,
        metadata: dict[str, Any] | None = None,
        commit: bool = True,
    ) -> CommerceEntitlement:
        stmt = (
            select(CommerceEntitlement)
            .where(
                CommerceEntitlement.user_id == int(user_id),
                CommerceEntitlement.product_id == product_id,
                CommerceEntitlement.asset_key == asset_key,
            )
            .limit(1)
        )
        existing = (await self.db.execute(stmt)).scalar_one_or_none()
        if existing:
            return existing

        entitlement = CommerceEntitlement(
            user_id=int(user_id),
            product_id=product_id,
            product_type=product_type,
            title=title,
            asset_key=asset_key,
            source=source,
            metadata_json=_json_dumps(metadata or {}),
        )
        self.db.add(entitlement)
        if commit:
            await self.db.commit()
            await self.db.refresh(entitlement)
        return entitlement

    async def grant_credit_once(
        self,
        *,
        user_id: int,
        credit_type: str,
        amount: int,
        reference_id: str,
        detail: dict[str, Any] | None = None,
        commit: bool = True,
    ) -> CreditLedgerEntry | None:
        if amount <= 0:
            return None
        stmt = (
            select(CreditLedgerEntry)
            .where(
                CreditLedgerEntry.user_id == int(user_id),
                CreditLedgerEntry.reference_id == reference_id,
                CreditLedgerEntry.action == "grant",
            )
            .limit(1)
        )
        existing = (await self.db.execute(stmt)).scalar_one_or_none()
        if existing:
            return existing
        return await self.add_credit_entry(
            user_id=user_id,
            credit_type=credit_type,
            action="grant",
            amount=amount,
            reference_id=reference_id,
            detail=detail or {},
            commit=commit,
        )

    async def add_credit_entry(
        self,
        *,
        user_id: int,
        credit_type: str,
        action: str,
        amount: int,
        reference_id: str,
        detail: dict[str, Any] | None = None,
        commit: bool = True,
    ) -> CreditLedgerEntry:
        entry = CreditLedgerEntry(
            user_id=int(user_id),
            credit_type=credit_type,
            action=action,
            amount=int(amount),
            reference_id=reference_id,
            detail_json=_json_dumps(detail or {}),
        )
        self.db.add(entry)
        if commit:
            await self.db.commit()
            await self.db.refresh(entry)
        return entry

    async def get_credit_balance(self, user_id: int, credit_type: str) -> int:
        stmt = select(func.coalesce(func.sum(CreditLedgerEntry.amount), 0)).where(
            CreditLedgerEntry.user_id == int(user_id),
            CreditLedgerEntry.credit_type == credit_type,
        )
        result = await self.db.execute(stmt)
        return int(result.scalar_one() or 0)

    async def list_entitlements(self, user_id: int) -> list[CommerceEntitlement]:
        stmt = (
            select(CommerceEntitlement)
            .where(CommerceEntitlement.user_id == int(user_id))
            .order_by(CommerceEntitlement.granted_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def recent_ledger_entries(self, user_id: int, limit: int = 20) -> list[CreditLedgerEntry]:
        stmt = (
            select(CreditLedgerEntry)
            .where(CreditLedgerEntry.user_id == int(user_id))
            .order_by(CreditLedgerEntry.created_at.desc())
            .limit(min(max(int(limit or 20), 1), 100))
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def credit_summary(self, user_id: int) -> dict[str, Any]:
        return {
            "balances": {
                "llm": await self.get_credit_balance(user_id, "llm"),
                "tts": await self.get_credit_balance(user_id, "tts"),
            },
            "recentLedger": [
                self.serialize_ledger_entry(entry)
                for entry in await self.recent_ledger_entries(user_id, limit=12)
            ],
        }

    async def reserve_credits(
        self,
        *,
        user_id: int,
        credit_type: str,
        amount: int,
        reference_id: str,
        detail: dict[str, Any] | None = None,
    ) -> None:
        amount = max(int(amount or 0), 1)
        balance = await self.get_credit_balance(user_id, credit_type)
        if balance < amount:
            raise ValueError(f"{credit_type} credits are not enough.")
        await self.add_credit_entry(
            user_id=user_id,
            credit_type=credit_type,
            action="reserve",
            amount=-amount,
            reference_id=reference_id,
            detail=detail or {},
        )

    async def settle_reservation(
        self,
        *,
        user_id: int,
        credit_type: str,
        reference_id: str,
        reserved_amount: int,
        spent_amount: int,
        detail: dict[str, Any] | None = None,
    ) -> None:
        reserved_amount = max(int(reserved_amount or 0), 0)
        spent_amount = min(max(int(spent_amount or 0), 0), reserved_amount)
        await self.add_credit_entry(
            user_id=user_id,
            credit_type=credit_type,
            action="settle",
            amount=0,
            reference_id=reference_id,
            detail={**(detail or {}), "reserved": reserved_amount, "spent": spent_amount},
        )
        refund = reserved_amount - spent_amount
        if refund > 0:
            await self.add_credit_entry(
                user_id=user_id,
                credit_type=credit_type,
                action="refund",
                amount=refund,
                reference_id=reference_id,
                detail={"reason": "unused_reserved_credits"},
            )

    async def refund_reservation(
        self,
        *,
        user_id: int,
        credit_type: str,
        reference_id: str,
        reserved_amount: int,
        reason: str,
    ) -> None:
        if reserved_amount <= 0:
            return
        await self.add_credit_entry(
            user_id=user_id,
            credit_type=credit_type,
            action="refund",
            amount=int(reserved_amount),
            reference_id=reference_id,
            detail={"reason": reason},
        )


class OfficialGatewayError(RuntimeError):
    pass


class OfficialLLMGatewayService:
    def _provider_config(self) -> tuple[str, str, str]:
        api_base = settings.AILIS_OFFICIAL_LLM_API_BASE or settings.LLM_API_BASE
        api_key = settings.AILIS_OFFICIAL_LLM_API_KEY or settings.LLM_API_KEY
        model = settings.AILIS_OFFICIAL_LLM_MODEL or settings.LLM_MODEL_NAME
        return api_base.strip(), api_key.strip(), model.strip()

    def is_configured(self) -> bool:
        api_base, api_key, model = self._provider_config()
        return bool(api_base and api_key and model)

    async def stream_chat(
        self,
        *,
        messages: list[dict[str, str]],
        system_prompt: str = "",
        model: str = "",
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ):
        api_base, api_key, default_model = self._provider_config()
        if not api_base or not api_key or not default_model:
            raise OfficialGatewayError("Official LLM gateway is not configured.")

        endpoint = api_base.rstrip("/")
        if not endpoint.endswith("/chat/completions"):
            endpoint = f"{endpoint}/chat/completions"

        normalized_messages: list[dict[str, str]] = []
        if system_prompt.strip():
            normalized_messages.append({"role": "system", "content": system_prompt.strip()})
        normalized_messages.extend(messages)

        request_payload = {
            "model": (model or default_model).strip() or default_model,
            "messages": normalized_messages,
            "temperature": float(temperature),
            "max_tokens": max(int(max_tokens or 1024), 1),
            "stream": True,
        }
        timeout = httpx.Timeout(
            float(settings.AILIS_GATEWAY_TIMEOUT_SECONDS or 120),
            connect=20.0,
            read=float(settings.AILIS_GATEWAY_TIMEOUT_SECONDS or 120),
            write=20.0,
            pool=20.0,
        )
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", endpoint, headers=headers, json=request_payload) as response:
                if response.status_code >= 400:
                    await response.aread()
                    raise OfficialGatewayError(f"Provider returned HTTP {response.status_code}.")

                async for line in response.aiter_lines():
                    line = (line or "").strip()
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        payload = json.loads(data)
                    except json.JSONDecodeError:
                        continue

                    choice = (payload.get("choices") or [{}])[0]
                    delta = choice.get("delta") or {}
                    text = delta.get("content") or choice.get("text") or ""
                    if text:
                        yield text
