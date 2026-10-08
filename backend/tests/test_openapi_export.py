"""
Tests for the OpenAPI export used by `npm run generate-api`.

The frontend client is generated from the exported schema, so file upload
fields must reach the generator as `format: binary` - otherwise the avatar
upload is typed as a string and sent without multipart FormData.
"""

import copy
import json

from main import app
from openapi.export_openapi import restore_binary_format


def test_restore_binary_format_rewrites_upload_fields():
    """UploadFile fields lose contentMediaType and get format: binary."""
    schema = copy.deepcopy(app.openapi())

    restore_binary_format(schema)

    upload_body = schema["components"]["schemas"][
        "Body_upload_avatar_users_me_avatar_post"
    ]
    assert upload_body["properties"]["file"] == {
        "type": "string",
        "title": "File",
        "format": "binary",
    }
    assert "contentMediaType" not in json.dumps(schema)


def test_restore_binary_format_leaves_other_fields_alone():
    """Only octet-stream string fields are rewritten."""
    node = {
        "a": {"type": "string", "contentMediaType": "image/png"},
        "b": [{"type": "integer"}],
    }
    expected = copy.deepcopy(node)

    restore_binary_format(node)

    assert node == expected
