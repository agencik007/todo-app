"""
Migration script to add is_public column to todos table.
Run this script once to update existing database schema.
"""
import os
import sys
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://todo_user:todo_password@localhost:5432/todo_db")

def check_column_exists(engine, table_name, column_name):
    """Check if a column exists in a table"""
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns

def add_is_public_column():
    """Add is_public column to todos table if it doesn't exist"""
    engine = create_engine(DATABASE_URL)
    
    try:
        with engine.begin() as conn:
            # Check if column already exists
            if check_column_exists(engine, 'todos', 'is_public'):
                print("[OK] Column 'is_public' already exists in 'todos' table")
                return
            
            # Add column
            print("Adding 'is_public' column to 'todos' table...")
            conn.execute(text("""
                ALTER TABLE todos 
                ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE
            """))
            print("[OK] Successfully added 'is_public' column to 'todos' table")
            
    except Exception as e:
        print(f"[ERROR] Error adding column: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        engine.dispose()

if __name__ == "__main__":
    print("Running migration: add_is_public_column")
    add_is_public_column()
    print("Migration completed!")

