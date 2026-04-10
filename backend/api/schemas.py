from typing import List, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., description="角色: user 或 assistant")
    content: str = Field(..., description="消息内容")


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(default_factory=list, description="对话历史")
    session_id: Optional[str] = Field(default="default", description="会话ID，用于区分不同用户")
    is_auto_chat: bool = Field(default=False, description="是否为主动对话模式")


class TTSAlignment(BaseModel):
    """
    ElevenLabs 返回的字符级时间戳。
    前端可以用它做逐字显示，或作为将来更精细口型同步的基础数据。
    """
    characters: List[str] = Field(default_factory=list)
    character_start_times_seconds: List[float] = Field(default_factory=list)
    character_end_times_seconds: List[float] = Field(default_factory=list)


class ChatTTSResponse(BaseModel):
    session_id: str = Field(..., description="当前对话会话ID")
    raw_text: str = Field(..., description="LLM原始输出，仍包含动作/表情标签")
    display_text: str = Field(..., description="前端展示文本，已去掉控制标签")
    speech_text: str = Field(..., description="送入TTS的净化文本")
    audio_base64: str = Field(..., description="Base64 编码音频数据")
    audio_format: str = Field(..., description="音频格式，例如 mp3_44100_128")
    mime_type: str = Field(..., description="音频 MIME 类型")
    action: Optional[str] = Field(default=None, description="动作标签，例如 wave / dance")
    expression: Optional[str] = Field(default=None, description="表情标签，例如 happy")
    alignment: Optional[TTSAlignment] = Field(default=None, description="原始文本字符级时间戳")
    normalized_alignment: Optional[TTSAlignment] = Field(default=None, description="规范化文本字符级时间戳")
    duration_hint_seconds: Optional[float] = Field(default=None, description="根据时间戳估算的音频时长")


class ChatTextResponse(BaseModel):
    session_id: str = Field(..., description="当前对话会话ID")
    raw_text: str = Field(..., description="LLM原始输出，仍包含动作/表情标签")
    display_text: str = Field(..., description="前端展示文本，已去掉控制标签")
    speech_text: str = Field(..., description="原本用于 TTS 的净化文本")
    action: Optional[str] = Field(default=None, description="动作标签，例如 wave / dance")
    expression: Optional[str] = Field(default=None, description="表情标签，例如 happy")
