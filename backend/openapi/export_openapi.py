import json
import os
import sys
from typing import Any

# Get the absolute path of the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Get the backend directory (parent of SCRIPT_DIR)
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)

# Add the backend directory to sys.path to allow importing the app
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Change working directory to backend so relative paths in main.py (like .env and uploadedFiles) work correctly
os.chdir(BACKEND_DIR)

try:
    from main import app
except ImportError as e:
    print(
        f"Error: Could not import 'app' from 'main'. Make sure main.py is in {BACKEND_DIR}"
    )
    print(f"Import error: {e}")
    sys.exit(1)


def _mark_binary_uploads(node: Any) -> None:
    """
    Rewrite OpenAPI 3.1 file fields into the `format: binary` form.

    FastAPI describes `UploadFile` as `contentMediaType: application/octet-stream`,
    which openapi-generator's typescript-angular client turns into a plain string
    sent without multipart/form-data - breaking uploads such as the avatar.
    """
    if isinstance(node, dict):
        if node.get("contentMediaType") == "application/octet-stream":
            del node["contentMediaType"]
            node["format"] = "binary"
        for value in node.values():
            _mark_binary_uploads(value)
    elif isinstance(node, list):
        for item in node:
            _mark_binary_uploads(item)


def export_openapi():
    # Use the app's openapi method to get the schema
    openapi_schema = app.openapi()
    _mark_binary_uploads(openapi_schema)

    # Define the output path (in the same folder as this script)
    output_path = os.path.join(SCRIPT_DIR, "openapi.json")

    # Save the schema to a file
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(openapi_schema, f, indent=2)

    print(f"OpenAPI schema exported to {output_path}")


if __name__ == "__main__":
    export_openapi()
