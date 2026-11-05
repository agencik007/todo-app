"""
Generate a VAPID key pair for Web Push.

Usage: python -m scripts.generate_vapid_keys

Prints VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (URL-safe base64, no padding) for
docker/docker.env. Keep the private key secret and the pair stable: changing it
invalidates every existing browser subscription.
"""

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def generate_keys() -> tuple[str, str]:
    """Return (public key, private key) of a new P-256 pair, base64url, unpadded."""
    private = ec.generate_private_key(ec.SECP256R1())
    private_bytes = private.private_numbers().private_value.to_bytes(32, "big")
    public_bytes = private.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    return _b64(public_bytes), _b64(private_bytes)


if __name__ == "__main__":
    public_key, private_key = generate_keys()
    print(f"VAPID_PUBLIC_KEY={public_key}")
    print(f"VAPID_PRIVATE_KEY={private_key}")
