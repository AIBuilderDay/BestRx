#!/usr/bin/env python3
"""Generate a VAPID keypair and store it in Secrets Manager.

Run once, after `terraform apply` has created the (empty) secret.

The private key is written straight to Secrets Manager and never printed, never committed, and never
placed in Terraform state or a Lambda environment variable. The public key is printed because the
frontend needs it to subscribe.

    uv run python scripts/generate_vapid.py --secret-id bestrx/vapid

Re-running rotates the keypair, which invalidates every existing browser subscription — they must
resubscribe. Pass --force to confirm you mean it.
"""

from __future__ import annotations

import argparse
import base64
import json
import sys

import boto3
from botocore.exceptions import ClientError
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def _b64(raw: bytes) -> str:
    """URL-safe base64 without padding, which is what the Web Push spec expects."""
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def generate_keypair() -> tuple[str, str]:
    """Return (public_key, private_key) as URL-safe base64 strings."""
    private_key = ec.generate_private_key(ec.SECP256R1())

    public_numbers = private_key.public_key().public_numbers()
    # Uncompressed point format: 0x04 || X || Y — what pushManager.subscribe wants.
    public_raw = (
        b"\x04"
        + public_numbers.x.to_bytes(32, "big")
        + public_numbers.y.to_bytes(32, "big")
    )
    private_raw = private_key.private_numbers().private_value.to_bytes(32, "big")

    return _b64(public_raw), _b64(private_raw)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--secret-id", required=True, help="Secrets Manager secret id or ARN")
    parser.add_argument("--region", default="us-east-2")
    parser.add_argument("--profile", default="default")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite an existing keypair, invalidating all current subscriptions",
    )
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    client = session.client("secretsmanager")

    # describe_secret, not get_secret_value: an empty secret — exactly what Terraform creates, and
    # exactly the state this script exists to fill — raises ResourceNotFoundException from
    # get_secret_value, the same error code as a secret that genuinely is not there. Only
    # describe_secret tells the two apart.
    try:
        client.describe_secret(SecretId=args.secret_id)
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ResourceNotFoundException":
            raise
        print(f"Secret {args.secret_id} does not exist. Run `terraform apply` first.")
        return 1

    try:
        existing = client.get_secret_value(SecretId=args.secret_id)
        has_key = "privateKey" in json.loads(existing["SecretString"])
    except ClientError as exc:
        # The secret is there but has no version yet, which is the normal first-run case.
        if exc.response["Error"]["Code"] != "ResourceNotFoundException":
            raise
        has_key = False
    except (json.JSONDecodeError, KeyError):
        has_key = False

    if has_key and not args.force:
        print(
            f"{args.secret_id} already holds a keypair.\n"
            "Rotating invalidates every existing browser subscription. Pass --force to proceed."
        )
        return 1

    public_key, private_key = generate_keypair()
    client.put_secret_value(
        SecretId=args.secret_id,
        SecretString=json.dumps({"publicKey": public_key, "privateKey": private_key}),
    )

    print(f"Stored a new VAPID keypair in {args.secret_id}.\n")
    print("Public key (safe to expose — the browser needs it to subscribe):")
    print(f"  {public_key}\n")
    # The frontend fetches this from GET /push/public-key rather than reading an env var, so the
    # API is the only place it needs to be set.
    print("Next:")
    print("  1. Set VAPID_PUBLIC_KEY to that value in the Render service's environment.")
    print(f'  2. terraform -chdir=infra apply -var="vapid_public_key={public_key}"')
    return 0


if __name__ == "__main__":
    sys.exit(main())
