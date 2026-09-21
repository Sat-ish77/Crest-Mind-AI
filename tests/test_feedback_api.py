"""Unit tests for the human-in-the-loop feedback API.

Run with:
    python -m unittest tests.test_feedback_api

The Supabase client is replaced with an in-memory fake, so these tests never
touch Woodcrest data or require credentials.
"""

import unittest
import sys
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError

# Keep this unit test focused on the API boundary. The ingestion/RAG modules
# have their own heavy document and model dependencies, none of which should
# be initialized just to test feedback validation and persistence.
sys.modules.setdefault("db.client", SimpleNamespace(get_supabase=lambda: None))
sys.modules.setdefault("dotenv", SimpleNamespace(load_dotenv=lambda: None))
sys.modules.setdefault("ingest.loader", SimpleNamespace(load_document=lambda *_args, **_kwargs: []))
sys.modules.setdefault("ingest.chunker", SimpleNamespace(chunk_document=lambda *_args, **_kwargs: []))
sys.modules.setdefault("ingest.embedder", SimpleNamespace(embed_and_store=lambda *_args, **_kwargs: None))
sys.modules.setdefault("rag.retriever", SimpleNamespace(retrieve=lambda *_args, **_kwargs: []))
sys.modules.setdefault("rag.generator", SimpleNamespace(generate_answer=lambda *_args, **_kwargs: {}))
sys.modules.setdefault("rag.agent", SimpleNamespace(run_agent=lambda *_args, **_kwargs: {}))

import api


class FakeQuery:
    def __init__(self, rows=None, fail=False):
        self.rows = rows or []
        self.fail = fail
        self.inserted = None
        self.calls = []

    def insert(self, payload):
        self.inserted = payload
        self.calls.append(("insert", payload))
        return self

    def select(self, columns):
        self.calls.append(("select", columns))
        return self

    def order(self, column, desc=False):
        self.calls.append(("order", column, desc))
        return self

    def limit(self, value):
        self.calls.append(("limit", value))
        return self

    def eq(self, column, value):
        self.calls.append(("eq", column, value))
        return self

    def execute(self):
        if self.fail:
            raise RuntimeError("database unavailable")
        if self.inserted is not None:
            return SimpleNamespace(data=[{"id": "feedback-123"}])
        return SimpleNamespace(data=self.rows)


class FakeSupabase:
    def __init__(self, query):
        self.query = query
        self.table_name = None

    def table(self, name):
        self.table_name = name
        return self.query


class FeedbackApiTests(unittest.TestCase):
    def make_request(self, **overrides):
        payload = {
            "query": " When does the lease expire? ",
            "answer": " The lease expires in 2030. ",
            "action": "flagged",
            "overall_confidence": "medium",
            "username": " Property Manager ",
            "note": " Wrong renewal date ",
            "sources": [{
                "doc_name": "Lease.pdf",
                "section": "Renewal",
                "page_number": 4,
                "confidence": "medium",
                "chunk_text": "Renewal language",
            }],
        }
        payload.update(overrides)
        return api.FeedbackRequest(**payload)

    def test_submit_feedback_stores_trimmed_snapshot(self):
        query = FakeQuery()
        client = FakeSupabase(query)

        with patch.object(api, "get_supabase", return_value=client):
            result = api.submit_feedback(self.make_request())

        self.assertEqual(result, {"success": True, "id": "feedback-123"})
        self.assertEqual(client.table_name, "audit_logs")
        self.assertEqual(query.inserted["query"], "When does the lease expire?")
        self.assertEqual(query.inserted["answer"], "The lease expires in 2030.")
        self.assertEqual(query.inserted["username"], "Property Manager")
        self.assertEqual(query.inserted["note"], "Wrong renewal date")
        self.assertEqual(query.inserted["sources"][0]["doc_name"], "Lease.pdf")

    def test_invalid_action_is_rejected_by_schema(self):
        with self.assertRaises(ValidationError):
            self.make_request(action="liked")

    def test_blank_query_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            api.submit_feedback(self.make_request(query="   "))
        self.assertEqual(raised.exception.status_code, 400)

    def test_more_than_25_sources_is_rejected(self):
        source = {"doc_name": "Lease.pdf", "page_number": 1}
        with self.assertRaises(HTTPException) as raised:
            api.submit_feedback(self.make_request(sources=[source] * 26))
        self.assertEqual(raised.exception.status_code, 400)

    def test_list_feedback_filters_and_orders(self):
        rows = [{
            "id": "feedback-123",
            "created_at": "2026-09-17T12:00:00+00:00",
            "username": "Manager",
            "query": "Question",
            "answer": "Answer",
            "overall_confidence": "high",
            "sources": [],
            "action": "flagged",
            "note": "Incorrect date",
        }]
        query = FakeQuery(rows=rows)

        with patch.object(api, "get_supabase", return_value=FakeSupabase(query)):
            result = api.list_feedback(action="flagged", limit=25)

        self.assertEqual(result["logs"], rows)
        self.assertIn(("order", "created_at", True), query.calls)
        self.assertIn(("limit", 25), query.calls)
        self.assertIn(("eq", "action", "flagged"), query.calls)

    def test_database_errors_do_not_leak_details(self):
        with patch.object(api, "get_supabase", return_value=FakeSupabase(FakeQuery(fail=True))):
            with self.assertRaises(HTTPException) as raised:
                api.submit_feedback(self.make_request())

        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.detail, "Feedback storage is temporarily unavailable")
        self.assertNotIn("database unavailable", raised.exception.detail)


if __name__ == "__main__":
    unittest.main()
