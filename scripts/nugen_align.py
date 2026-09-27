"""Upload Vesper's domain corpus and start a Nugen alignment project.

Usage: set VESPER_NUGEN_API_KEY, then `python scripts/nugen_align.py`.
Resume a document with --document-id, or inspect/deploy a project with --alignment-id.
"""
from __future__ import annotations

import os
import argparse
from pathlib import Path

import httpx


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--document-id", help="Resume a processed upload without creating another document")
    parser.add_argument("--alignment-id", help="Inspect alignment status and deploy when ready")
    parser.add_argument("--model-id", help="Verify deployment and run one domain inference")
    args = parser.parse_args()
    key = os.getenv("VESPER_NUGEN_API_KEY")
    if not key:
        raise SystemExit("Set VESPER_NUGEN_API_KEY in your shell; do not commit it.")
    headers = {"Authorization": f"Bearer {key}"}
    with httpx.Client(timeout=60) as client:
        if args.model_id:
            status = client.get(f"https://api.nugen.in/api/v3/models/{args.model_id}/deployment/status", headers=headers)
            status.raise_for_status()
            deployment = status.json()
            print("Deployment status:", deployment.get("status"), deployment.get("error"))
            if deployment.get("status") != "DEPLOYED":
                return
            sample = client.post("https://api.nugen.in/api/v3/inference/chat/completions",
                headers=headers, json={"model": args.model_id, "messages": [
                    {"role": "system", "content": "You are a resort operations analyst trained for Vesper. State uncertainty."},
                    {"role": "user", "content": "A hotel has 90 booked rooms, rain of 35 mm, eight F&B staff and low beverage stock. What should the general manager check first?"},
                ], "max_tokens": 120, "temperature": 0.2, "stream": False})
            sample.raise_for_status()
            print("Aligned model response:", sample.json()["choices"][0]["message"]["content"])
            return
        if args.alignment_id:
            response = client.get(f"https://api.nugen.in/api/v3/alignment-projects/{args.alignment_id}", headers=headers)
            response.raise_for_status()
            project = response.json()
            print("Alignment status:", project.get("status"), "progress:", project.get("progress"))
            if project.get("error"):
                print("Nugen error:", project["error"])
            if project.get("status") != "READY":
                return
            model_id = project.get("model_id") or args.alignment_id
            deployed = client.post(f"https://api.nugen.in/api/v3/models/{model_id}/deployment", headers=headers)
            if deployed.status_code not in (200, 202):
                print("Deployment response:", deployed.status_code, deployed.text[:500])
                return
            print("Deployment requested for model:", model_id)
            print("When deployment status is READY, set VESPER_NUGEN_ALIGNED_MODEL_ID to this model ID.")
            return
        if args.document_id:
            ids = [args.document_id]
        else:
            corpus = Path(__file__).resolve().parents[1] / "docs" / "nugen-resort-operations.txt"
            uploaded = client.post("https://api.nugen.in/api/v3/documents/create",
                headers=headers, files={"files": (corpus.name, corpus.read_bytes(), "text/plain")})
            if uploaded.status_code == 409 and isinstance(uploaded.json().get("detail"), dict):
                existing = uploaded.json()["detail"].get("document_id")
                ids = [existing] if existing else []
            elif uploaded.is_error:
                raise SystemExit(f"Nugen upload failed ({uploaded.status_code}): {uploaded.text[:1000]}")
            else:
                ids = uploaded.json().get("document_ids") or uploaded.json().get("documents")
            if not ids:
                raise SystemExit("Nugen upload returned no document ID. Inspect the API response in your account.")
            print("Uploaded domain document IDs:", ids)
        # Avoid creating a duplicate training project while document processing is pending.
        ready = True
        for document_id in ids:
            status = client.get(f"https://api.nugen.in/api/v3/documents/{document_id}/status", headers=headers)
            status.raise_for_status()
            state = status.json().get("status", "unknown")
            print(document_id, state)
            ready &= state == "READY"
        if not ready:
            raise SystemExit("Document is processing. Retry with --document-id using the ID printed above.")
        aligned = client.post("https://api.nugen.in/api/v3/alignment-projects/create",
            headers=headers, json={"alignment_name": "Vesper Resort Operations",
                "base_model_id": os.getenv("VESPER_NUGEN_BASE_MODEL_ID", "qwen-v2p5-0p5b-instruct"),
                "document_ids": ids, "description": "Weather-aware resort department decisions with explicit uncertainty"})
        aligned.raise_for_status()
        print("Alignment:", aligned.json())


if __name__ == "__main__":
    main()
