"""Regression tests for the ingestion / retrieval / agent / auth fixes.

Run with:
    python -m unittest tests.test_pipeline_fixes

No network, credentials, or database: Supabase, embeddings and the LLM are
replaced with in-memory fakes. Requires the packages in requirements.txt.
"""

import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from docx import Document
from fastapi import HTTPException

from ingest.chunker import _extract_property_name, chunk_document
from ingest.loader import _detect_doc_type, load_document
import rag.agent as agent
import rag.generator as generator
import rag.property_resolver as resolver
import rag.retriever as retriever


class DocTypeDetectionTests(unittest.TestCase):
    def test_real_filenames_from_production(self):
        cases = {
            "[Executed] Ollies - Lease, 2010 - Copy.docx": "lease",
            "1-Woodcrest Short Term LEASE.docx": "lease",
            "[Executed] Ollies - Amendment, 2010 - Copy (1).docx": "amendment",
            "[Executed] Ollies - Amend 1, 2015 - Copy.docx": "amendment",
            "TMT SM Work Order Quote418 (2).pdf": "work_order",
            "New Ductwork Invoice (1).pdf": "invoice",
            "HVAC Inspection  (1).pdf": "inspection",
        }
        for filename, expected in cases.items():
            with self.subTest(filename=filename):
                self.assertEqual(_detect_doc_type(filename, ""), expected)

    def test_wo_no_longer_matches_inside_words(self):
        # "wo" used to match Woodcrest, ductwork, two and network.
        self.assertEqual(_detect_doc_type("scan.pdf", "Woodcrest has two network ducts"), "unknown")
        self.assertEqual(_detect_doc_type("scan.pdf", "WO #4471 replace compressor"), "work_order")

    def test_filename_beats_content(self):
        self.assertEqual(_detect_doc_type("Main Lease.docx", "see attached work order"), "lease")

    def test_separators_in_filename(self):
        self.assertEqual(_detect_doc_type("HVAC_Inspection.pdf", ""), "inspection")


class DocxChunkingTests(unittest.TestCase):
    def test_docx_sections_become_separate_chunks(self):
        doc = Document()
        doc.add_paragraph("COMMERCIAL LEASE AGREEMENT")
        doc.add_paragraph("Property: Maple Ridge Plaza, Austin TX")
        doc.add_paragraph("1. BASE RENT")
        doc.add_paragraph("Tenant shall pay Base Rent of $4,250.00 per month.")
        doc.add_paragraph("2. HVAC MAINTENANCE")
        doc.add_paragraph("Tenant is responsible for routine HVAC maintenance.")
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "Lease.docx")
            doc.save(path)
            loaded = load_document(path)

        chunks = chunk_document(loaded)
        sections = [c["section"] for c in chunks]
        self.assertIn("Base Rent", sections)
        self.assertIn("Hvac Maintenance", sections)
        hvac = next(c for c in chunks if c["section"] == "Hvac Maintenance")
        self.assertIn("routine HVAC maintenance", hvac["content"])
        self.assertNotIn("$4,250.00", hvac["content"])
        self.assertEqual(chunks[0]["property_name"], "Maple Ridge Plaza")

    def test_property_name_requires_a_proper_name(self):
        self.assertIsNone(_extract_property_name("Tenant pays property taxes and insurance."))
        self.assertEqual(_extract_property_name("Property: Akers Center\nnext"), "Akers Center")


PROPERTIES = [
    {"id": "p-akers", "name": "Akers Center", "city": "Gastonia", "state": "NC"},
    {"id": "p-parkplace", "name": "Parkplace Plaza", "city": "Dallas", "state": "TX"},
    {"id": "p-parkcenter", "name": "Park Place Center", "city": "Plano", "state": "TX"},
    {"id": "p-northmont", "name": "Northmont Plaza", "city": "Dayton", "state": "OH"},
    {"id": "p-cockrell", "name": "Cockrell Drive", "city": "Tyler", "state": "TX"},
    {"id": "p-belle", "name": "Belle Park Plaza", "city": "Mobile", "state": "AL"},
    {"id": "p-pine", "name": "Pine Plaza Shopping Center", "city": "Ames", "state": "IA"},
]


class _PropertiesTable:
    def select(self, *_):
        return self

    def execute(self):
        return SimpleNamespace(data=PROPERTIES)


class PropertyResolverTests(unittest.TestCase):
    def resolve(self, name):
        fake = SimpleNamespace(table=lambda _name: _PropertiesTable())
        with patch.object(resolver, "get_supabase", return_value=fake):
            return resolver.resolve_property(name)

    def test_real_property_found(self):
        result = self.resolve("Akers")
        self.assertEqual(result["status"], "found")
        self.assertEqual(result["property"]["id"], "p-akers")

    def test_tenant_and_vendor_names_are_not_ambiguous_properties(self):
        # Live, these returned "ambiguous" with three unrelated properties.
        for name in ("Ollie's", "TMT", "Sunset Mall"):
            with self.subTest(name=name):
                self.assertEqual(self.resolve(name)["status"], "not_found")

    def test_close_runner_up_is_ambiguous_even_in_high_band(self):
        result = self.resolve("Park Place")
        self.assertEqual(result["status"], "ambiguous")
        self.assertEqual(
            {c["id"] for c in result["candidates"]}, {"p-parkplace", "p-parkcenter"}
        )


class RetrieverTests(unittest.TestCase):
    def retrieve(self, rows, **kwargs):
        rpc = SimpleNamespace(execute=lambda: SimpleNamespace(data=rows))
        fake = SimpleNamespace(rpc=lambda *_args: rpc)
        with patch.object(retriever, "_embed_query", return_value=[0.0] * 1536), \
             patch.object(retriever, "get_supabase", return_value=fake):
            return retriever.retrieve("question", **kwargs)

    def test_returns_only_top_k(self):
        rows = [{"id": i, "similarity": 0.01 + i / 1000} for i in range(15)]
        result = self.retrieve(rows, top_k=5)
        self.assertEqual([c["id"] for c in result["chunks"]], [14, 13, 12, 11, 10])

    def test_confidence_bands_follow_rrf_math(self):
        one_list_top = 1 / 61                # best possible single-search hit
        both_lists_top = 1 / 61 + 1 / 61     # #1 in vector and keyword search
        both_lists_mid = 1 / 75 + 1 / 75
        self.assertEqual(retriever._confidence_level(one_list_top), "low")
        self.assertEqual(retriever._confidence_level(both_lists_mid), "medium")
        self.assertEqual(retriever._confidence_level(both_lists_top), "high")

    def test_no_rows_is_out_of_scope(self):
        self.assertTrue(self.retrieve([])["out_of_scope"])


class GeneratorTests(unittest.TestCase):
    CHUNKS = {"out_of_scope": False, "chunks": [{"doc_name": "a.pdf", "content": "x", "confidence": "medium"}]}

    def test_llm_refusal_is_not_found(self):
        with patch.object(generator, "_call_llm",
                          return_value="I could not find this specific information in the provided chunks."):
            result = generator.generate_answer("capital of France?", self.CHUNKS)
        self.assertFalse(result["found_in_documents"])
        self.assertEqual(result["overall_confidence"], "none")
        self.assertEqual(result["sources"], [])

    def test_partial_answer_keeps_sources(self):
        long_answer = "Rent is $4,250.00 per month. " * 12 + \
            "I could not find this specific information in the provided chunks for the deposit."
        with patch.object(generator, "_call_llm", return_value=long_answer):
            result = generator.generate_answer("rent and deposit?", self.CHUNKS)
        self.assertTrue(result["found_in_documents"])
        self.assertEqual(len(result["sources"]), 1)


class AgentTests(unittest.TestCase):
    def run_agent(self, retrieve_results, resolution):
        calls = []

        def fake_retrieve(**kwargs):
            calls.append(kwargs)
            return {"chunks": retrieve_results[len(calls) - 1]}

        def fake_llm(messages, temperature=0.0):
            return "Akers"

        answer = {"answer": "ok", "sources": [{"doc_name": "a"}], "overall_confidence": "high",
                  "found_in_documents": True}
        with patch.object(agent, "retrieve", side_effect=fake_retrieve), \
             patch.object(agent, "_llm_call", side_effect=fake_llm), \
             patch.object(agent, "resolve_property", return_value=resolution), \
             patch.object(generator, "generate_answer", return_value=answer):
            agent._agent = None
            result = agent.run_agent("What is the lease term at Akers?")
        return result, calls

    FOUND = {"status": "found", "confidence": 0.9, "candidates": [], "message": "",
             "property": {"id": "p-akers", "name": "Akers Center", "state": "NC"}}

    def test_category_is_never_used_as_doc_type_filter(self):
        _, calls = self.run_agent([[{"confidence": "high"}]], self.FOUND)
        self.assertEqual(len(calls), 1)
        self.assertIsNone(calls[0]["filter_doc_type"])   # was "Tenants"
        self.assertEqual(calls[0]["property_id"], "p-akers")

    def test_falls_back_to_all_documents_when_property_has_no_chunks(self):
        # Live: "Akers Center" resolved, then 0 documents, then not found.
        result, calls = self.run_agent([[], [{"confidence": "high"}]], self.FOUND)
        self.assertEqual([c["property_id"] for c in calls], ["p-akers", None])
        self.assertTrue(result["found_in_documents"])

    def test_not_found_message_never_says_none(self):
        no_property = {"status": "not_found", "confidence": 0.3, "candidates": [],
                       "message": "", "property": None}
        result, calls = self.run_agent([[]], no_property)
        self.assertEqual(len(calls), 1)  # nothing broader to try
        self.assertFalse(result["found_in_documents"])
        self.assertNotIn("None", result["answer"])


class AuthTests(unittest.TestCase):
    def request(self, method="POST", path="/ask", auth=None):
        headers = {"authorization": auth} if auth else {}
        return SimpleNamespace(method=method, url=SimpleNamespace(path=path), headers=headers)

    def test_token_enforced_when_configured(self):
        import api
        with patch.object(api, "API_AUTH_TOKEN", "s3cret"):
            api.require_api_token(self.request(auth="Bearer s3cret"))
            api.require_api_token(self.request(method="GET", path="/"))
            for auth in (None, "Bearer nope", "s3cret", "Basic s3cret"):
                with self.subTest(auth=auth), self.assertRaises(HTTPException) as ctx:
                    api.require_api_token(self.request(auth=auth))
                self.assertEqual(ctx.exception.status_code, 401)

    @staticmethod
    def mint(secret, username, expiry):
        import base64, hashlib, hmac
        user = base64.urlsafe_b64encode(username.encode()).decode().rstrip("=")
        payload = f"v1.{expiry}.{user}"
        return payload + "." + hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()

    def test_signed_user_tokens(self):
        import api
        good = self.mint("s3cret", "Jordan Lee", 2_000)
        self.assertEqual(api.verify_api_token(good, "s3cret", now=1_000), "Jordan Lee")
        self.assertIsNone(api.verify_api_token(good, "s3cret", now=2_001))       # expired
        self.assertIsNone(api.verify_api_token(good, "other", now=1_000))        # wrong key
        tampered = good.replace(good.split(".")[1], "9999999999")
        self.assertIsNone(api.verify_api_token(tampered, "s3cret", now=1_000))   # edited expiry
        self.assertEqual(api.verify_api_token("s3cret", "s3cret"), "service")

    def test_open_when_not_configured(self):
        import api
        with patch.object(api, "API_AUTH_TOKEN", ""):
            api.require_api_token(self.request())


if __name__ == "__main__":
    unittest.main()
