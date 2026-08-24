"""
Markova OS — Sales Specialist Agent
"""

from typing import Optional


class SalesAgent:
    def __init__(self, name: str = "Sales Advisor"):
        self.name = name
        self.role = "Sales & Pricing Specialist"
        self.goal = "Provide accurate product pricing in Ethiopian Birr, discounts, and lead capture."

    def execute(self, transcript: str, rag_context: Optional[str] = None) -> str:
        if rag_context:
            return f"የምርቱን ዝርዝር መረጃ እና ዋጋ ከካታሎጋችን አረጋግጬልዎታለሁ፡ {rag_context[:100]}... ተጨማሪ መረጃ ወይም የክፍያ ሁኔታ ማወቅ ይፈልጋሉ?"
        return "ስለ ምርቶቻችን ዋጋ እና የክፍያ አማራጮች ዝርዝር ልነግርዎ እችላለሁ። የትኛውን ዕቃ ወይም አገልግሎት ማወቅ ይፈልጋሉ?"


sales_agent = SalesAgent()
