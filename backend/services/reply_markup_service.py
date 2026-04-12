import re
from dataclasses import dataclass


CONTROL_TAG_PATTERN = re.compile(r"\[(motion|action|expression):(.*?)\]")
MULTI_SPACE_PATTERN = re.compile(r"[ \t]+")
MOTION_CATEGORIES = {
    "idle",
    "walk",
    "run",
    "dance",
    "fight",
    "sports",
    "zombie",
    "superhero",
}
INTENSITY_LEVELS = {"low", "medium", "high"}
EXPRESSION_NAMES = {
    "happy",
    "sad",
    "angry",
    "relaxed",
    "surprised",
    "blinkRight",
    "neutral",
}


@dataclass
class ParsedReply:
    """
    将 LLM 的原始输出拆成三层语义：
    1. raw_text: 模型原始回复，方便调试
    2. display_text: 给前端显示的文字
    3. speech_text: 给 ElevenLabs 朗读的文字
    """

    raw_text: str
    display_text: str
    speech_text: str
    action: str | None = None
    legacy_action: str | None = None
    motion_category: str | None = None
    motion_intensity: str | None = None
    expression: str | None = None
    expression_intensity: str | None = None


def _normalize_lines(text: str) -> list[str]:
    normalized_lines: list[str] = []
    for line in text.splitlines():
        clean_line = MULTI_SPACE_PATTERN.sub(" ", line).strip()
        if clean_line:
            normalized_lines.append(clean_line)
    return normalized_lines


def _parse_key_value_body(raw_value: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for part in re.split(r"[;,]", raw_value or ""):
        clean_part = part.strip()
        if not clean_part or "=" not in clean_part:
            continue
        key, value = clean_part.split("=", 1)
        key = key.strip().lower()
        value = value.strip()
        if key and value:
            fields[key] = value
    return fields


def _normalize_motion_category(value: str | None) -> str | None:
    normalized = (value or "").strip().lower()
    return normalized if normalized in MOTION_CATEGORIES else None


def _normalize_intensity(value: str | None) -> str | None:
    normalized = (value or "").strip().lower()
    return normalized if normalized in INTENSITY_LEVELS else None


def _normalize_expression_name(value: str | None) -> str | None:
    normalized = (value or "").strip()
    return normalized if normalized in EXPRESSION_NAMES else None


def _parse_motion_tag(kind: str, raw_value: str) -> tuple[str | None, str | None, str | None, str | None]:
    trimmed_value = (raw_value or "").strip()
    if not trimmed_value:
        return None, None, None, None

    if "=" not in trimmed_value:
        motion_category = _normalize_motion_category(trimmed_value)
        legacy_action = trimmed_value if kind == "action" else None
        return motion_category or trimmed_value, legacy_action, motion_category, None

    fields = _parse_key_value_body(trimmed_value)
    motion_category = _normalize_motion_category(
        fields.get("category")
        or fields.get("motion")
        or fields.get("name")
        or fields.get("value")
    )
    motion_intensity = _normalize_intensity(fields.get("intensity"))
    legacy_action = (fields.get("legacy") or fields.get("action") or "").strip() or None
    action = motion_category or legacy_action
    return action, legacy_action, motion_category, motion_intensity


def _parse_expression_tag(raw_value: str) -> tuple[str | None, str | None]:
    trimmed_value = (raw_value or "").strip()
    if not trimmed_value:
        return None, None

    if "=" not in trimmed_value:
        return _normalize_expression_name(trimmed_value), None

    fields = _parse_key_value_body(trimmed_value)
    expression_name = _normalize_expression_name(
        fields.get("name")
        or fields.get("expression")
        or fields.get("value")
    )
    expression_intensity = _normalize_intensity(fields.get("intensity"))
    return expression_name, expression_intensity


def parse_reply_markup(raw_text: str) -> ParsedReply:
    """
    统一处理 LLM 输出里的控制标签。
    同时兼容旧协议 `[action:wave]` 和新协议
    `[motion:category=dance;intensity=high]`。
    """

    text = raw_text or ""
    action = None
    legacy_action = None
    motion_category = None
    motion_intensity = None
    expression = None
    expression_intensity = None

    def replace_control_tag(match: re.Match[str]) -> str:
        nonlocal action, legacy_action, motion_category, motion_intensity
        nonlocal expression, expression_intensity

        kind = match.group(1)
        value = match.group(2)

        if kind in {"motion", "action"} and not action and not legacy_action and not motion_category:
            action, legacy_action, motion_category, motion_intensity = _parse_motion_tag(kind, value)
        elif kind == "expression" and not expression:
            expression, expression_intensity = _parse_expression_tag(value)

        return ""

    stripped_text = CONTROL_TAG_PATTERN.sub(replace_control_tag, text)
    normalized_lines = _normalize_lines(stripped_text)

    display_text = "\n".join(normalized_lines).strip()
    speech_text = " ".join(normalized_lines).strip()

    return ParsedReply(
        raw_text=text,
        display_text=display_text,
        speech_text=speech_text,
        action=action,
        legacy_action=legacy_action,
        motion_category=motion_category,
        motion_intensity=motion_intensity,
        expression=expression,
        expression_intensity=expression_intensity,
    )
