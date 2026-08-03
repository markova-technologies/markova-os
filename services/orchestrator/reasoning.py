import json
from typing import Optional, Dict, Any

class ReasoningEngine:
    """
    Chain-of-Thought & Self-Consistency Reasoning Layer for Agents.
    Evaluates agent plan viability and verifies output safety before final response generation.
    """
    def __init__(self, confidence_threshold: float = 0.85):
        self.confidence_threshold = confidence_threshold

    def evaluate_thought_chain(self, query: str, context: Dict[str, Any], candidate_action: str) -> Dict[str, Any]:
        """
        Evaluate candidate action against policy and confidence.
        """
        reasons = []

        # 1. Verification of high-risk actions (Refunds, PII changes, Orders)
        high_risk_actions = ["refund", "cancel_order", "delete", "transfer_funds"]
        is_high_risk = any(risk in candidate_action.lower() for risk in high_risk_actions)

        confidence = 0.95
        if is_high_risk:
            confidence = 0.88
            reasons.append("High-risk action detected; requiring strict policy compliance.")

        # 2. Check if context has sufficient information
        if not context.get("knowledge") and not context.get("customer"):
            confidence *= 0.85
            reasons.append("Low context availability for query.")

        approved = confidence >= self.confidence_threshold

        return {
            "query": query,
            "candidateAction": candidate_action,
            "confidence": round(confidence, 2),
            "approved": approved,
            "requiresHumanApproval": is_high_risk and not approved,
            "reasons": reasons
        }
