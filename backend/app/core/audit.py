import json
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("emocare.audit")


def log_event(
    action: str,
    user_id: Optional[str] = None,
    role: Optional[str] = None,
    target_id: Optional[str] = None,
    ip: Optional[str] = None,
    detail: Optional[dict] = None,
):
    entry = {
        "ts":        datetime.now(timezone.utc).isoformat(),
        "action":    action,
        "user_id":   user_id,
        "role":      role,
        "target_id": target_id,
        "ip":        ip,
        "detail":    detail or {},
    }
    logger.info(json.dumps(entry))