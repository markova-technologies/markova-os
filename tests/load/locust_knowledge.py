"""
Locust load test for Markova Knowledge Service.
Simulates concurrent document searches to benchmark the asyncpg database connection pool.
"""
from locust import HttpUser, task, between
import os
import random

TEST_COMPANY_ID = os.getenv("LOAD_TEST_COMPANY_ID", "11111111-1111-1111-1111-111111111111")
TEST_JWT = os.getenv("LOAD_TEST_JWT", "")

# Mock queries for vector search simulation
SEARCH_QUERIES = [
    "What is the refund policy?",
    "How do I reset my password?",
    "Where is the nearest branch?",
    "What are your working hours?",
    "How can I speak to a human?"
]

class KnowledgeUser(HttpUser):
    wait_time = between(1.0, 3.0)
    
    @task(5)
    def search_documents(self):
        """Simulate a vector search query."""
        query = random.choice(SEARCH_QUERIES)
        self.client.post(
            "/search",
            headers={
                "Authorization": f"Bearer {TEST_JWT}", 
                "x-company-id": TEST_COMPANY_ID
            },
            json={
                "query": query,
                "top_k": 3
            }
        )
        
    @task(1)
    def get_document_list(self):
        """Simulate a dashboard listing documents."""
        self.client.get(
            "/documents",
            headers={
                "Authorization": f"Bearer {TEST_JWT}", 
                "x-company-id": TEST_COMPANY_ID
            }
        )

# Run with:
# locust -f tests/load/locust_knowledge.py --host https://your-knowledge.onrender.com
# --users 50 --spawn-rate 5 --run-time 60s
