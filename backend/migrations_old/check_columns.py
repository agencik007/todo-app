"""
Script to check columns in todos table
"""
import os
from sqlalchemy import create_engine, inspect
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://todo_user:todo_password@localhost:5432/todo_db")

engine = create_engine(DATABASE_URL)
inspector = inspect(engine)

try:
    columns = inspector.get_columns('todos')
    print("Columns in 'todos' table:")
    for col in columns:
        print(f"  - {col['name']}: {col['type']}")
    
    column_names = [col['name'] for col in columns]
    if 'is_public' in column_names:
        print("\n[OK] Column 'is_public' EXISTS")
    else:
        print("\n[ERROR] Column 'is_public' DOES NOT EXIST")
finally:
    engine.dispose()

