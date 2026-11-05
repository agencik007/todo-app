"""
Which push service endpoints the backend is willing to call.

A subscription endpoint is a URL the server POSTs to, so accepting any https URL
would let a user make the server reach internal hosts (SSRF). Browsers only
hand out endpoints of their vendor's push service, so only those are allowed.
"""

from urllib.parse import urlparse

# Hosts matched exactly...
ALLOWED_PUSH_HOSTS = (
    "fcm.googleapis.com",  # Chrome, Edge, Opera, Brave (FCM)
    "updates.push.services.mozilla.com",  # Firefox
    "push.services.mozilla.com",  # Firefox (older endpoints)
)
# ...and as a domain suffix (any subdomain, including the leading dot).
ALLOWED_PUSH_HOST_SUFFIXES = (
    ".push.apple.com",  # Safari / iOS web push (web.push.apple.com)
    ".notify.windows.com",  # Windows Notification Service (legacy Edge)
)


def is_allowed_push_endpoint(endpoint: str) -> bool:
    """
    Whether an endpoint is an https URL on a known push service's default port.

    Args:
        endpoint: The subscription endpoint.

    Returns:
        bool: True if the backend may POST to it.
    """
    try:
        parsed = urlparse(endpoint)
        host = (parsed.hostname or "").lower().rstrip(".")
        port = parsed.port
    except ValueError:
        return False
    if parsed.scheme != "https" or port not in (None, 443) or parsed.username:
        return False
    return host in ALLOWED_PUSH_HOSTS or host.endswith(ALLOWED_PUSH_HOST_SUFFIXES)
