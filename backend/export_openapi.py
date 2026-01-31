import json
import os
import sys

# Add the current directory to sys.path to allow importing the app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import app

def export_openapi():
    # Use the app's openapi method to get the schema
    openapi_schema = app.openapi()
    
    # Define the output path
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "openapi.json")
    
    # Save the schema to a file
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(openapi_schema, f, indent=2)
    
    print(f"OpenAPI schema exported to {output_path}")

if __name__ == "__main__":
    export_openapi()
