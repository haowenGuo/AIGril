from sqlalchemy import Column, ForeignKey, Integer, String, Text, DateTime, UniqueConstraint, func
from backend.core.database import Base


class Conversation(Base):
    """会话表：存储长期记忆"""
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, comment="会话ID，前端可传，默认default")
    role = Column(String, comment="角色: user / assistant")
    content = Column(Text, comment="消息内容")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Document(Base):
    """RAG文档表：存储上传的知识库文档"""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, comment="文件名")
    content = Column(Text, comment="文档内容")
    chunk_id = Column(String, comment="向量库中的Chunk ID")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AppUser(Base):
    """产品账号：用于 AILIS 会员、权益和积分体系。"""

    __tablename__ = "app_users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    display_name = Column(String(120), nullable=False, default="")
    password_hash = Column(String(512), nullable=False)
    stripe_customer_id = Column(String(255), nullable=False, default="", index=True)
    membership_status = Column(String(32), nullable=False, default="free", index=True)
    membership_plan = Column(String(32), nullable=False, default="free")
    membership_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AppSession(Base):
    """产品账号登录会话。"""

    __tablename__ = "app_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(255), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AppPayment(Base):
    """Stripe Checkout Session 与产品账号的绑定记录。"""

    __tablename__ = "app_payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False, index=True)
    stripe_session_id = Column(String(255), nullable=False, unique=True, index=True)
    stripe_customer_id = Column(String(255), nullable=False, default="", index=True)
    stripe_subscription_id = Column(String(255), nullable=False, default="", index=True)
    mode = Column(String(32), nullable=False, default="subscription")
    status = Column(String(64), nullable=False, default="")
    payment_status = Column(String(64), nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AppApiUsage(Base):
    """会员 API 用量记录，用于额度、运营和风控。"""

    __tablename__ = "app_api_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False, index=True)
    endpoint = Column(String(80), nullable=False, index=True)
    units = Column(Integer, nullable=False, default=1)
    period_key = Column(String(16), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="accepted", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class AppAdminAuditLog(Base):
    """后台人工操作审计记录。"""

    __tablename__ = "app_admin_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    admin_user_id = Column(ForeignKey("app_users.id", ondelete="SET NULL"), nullable=True, index=True)
    target_user_id = Column(ForeignKey("app_users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(80), nullable=False, index=True)
    detail = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class CommerceEntitlement(Base):
    """用户已拥有的角色、皮肤、语音、场景等资产权益。"""

    __tablename__ = "commerce_entitlements"
    __table_args__ = (
        UniqueConstraint("user_id", "product_id", "asset_key", name="uq_commerce_entitlement_asset"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(120), nullable=False, index=True)
    product_type = Column(String(60), nullable=False, index=True)
    title = Column(String(180), nullable=False, default="")
    asset_key = Column(String(180), nullable=False, default="", index=True)
    status = Column(String(32), nullable=False, default="active", index=True)
    source = Column(String(80), nullable=False, default="system")
    metadata_json = Column(Text, nullable=False, default="{}")
    granted_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)


class CreditLedgerEntry(Base):
    """积分账本流水：只追加，不覆盖，用于 LLM/TTS 官方网关结算。"""

    __tablename__ = "credit_ledger_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False, index=True)
    credit_type = Column(String(32), nullable=False, index=True)
    action = Column(String(32), nullable=False, index=True)
    amount = Column(Integer, nullable=False, default=0)
    reference_id = Column(String(160), nullable=False, default="", index=True)
    detail_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
