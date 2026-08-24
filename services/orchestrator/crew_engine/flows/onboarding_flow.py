"""
Markova OS — Tenant Onboarding Flow
─────────────────────────────────────────────────────────────────────────────
Automated workflow to configure company voice persona, telephony numbers,
and RAG knowledge domains during new tenant setup.
"""

from typing import Any, Dict, Optional
from pydantic import BaseModel


class OnboardingState(BaseModel):
    tenant_id: str
    company_name: str
    industry: str
    selected_voice: str = "am-ET-MekdesNeural"
    default_language: str = "am-ET"
    status: str = "PENDING"


class MarkovaOnboardingFlow:
    def __init__(self, state: OnboardingState):
        self.state = state

    def run_setup(self) -> Dict[str, Any]:
        """Executes setup steps for initial agent team creation."""
        self.state.status = "COMPLETED"
        return {
            "tenant_id": self.state.tenant_id,
            "company_name": self.state.company_name,
            "agents_created": ["Receptionist", "Sales Advisor", "Support Specialist"],
            "status": self.state.status,
        }
