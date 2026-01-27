"""
Migration script to add user_id column to todos table.
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

def check_table_exists(engine, table_name):
    """Check if a table exists"""
    inspector = inspect(engine)
    return table_name in inspector.get_table_names()

def add_user_id_column():
    """Add user_id column to todos table if it doesn't exist"""
    engine = create_engine(DATABASE_URL)
    
    try:
        with engine.begin() as conn:
            # Check if users table exists
            if not check_table_exists(engine, 'users'):
                print("[ERROR] Table 'users' does not exist. Please create it first.")
                sys.exit(1)
            
            # Check if column already exists
            if check_column_exists(engine, 'todos', 'user_id'):
                print("[OK] Column 'user_id' already exists in 'todos' table")
                return
            
            # First, we need to set a default user_id for existing todos
            # But we can't do that without a user, so we'll make it nullable first
            # and then update it, or delete existing todos
            
            # Check if there are any todos
            result = conn.execute(text("SELECT COUNT(*) FROM todos"))
            todo_count = result.scalar()
            
            if todo_count > 0:
                print(f"[WARNING] Found {todo_count} existing todos. They will need a user_id.")
                print("Deleting existing todos without user_id...")
                conn.execute(text("DELETE FROM todos"))
            
            # Add column
            print("Adding 'user_id' column to 'todos' table...")
            conn.execute(text("""
                ALTER TABLE todos 
                ADD COLUMN user_id INTEGER NOT NULL
            """))
            
            # Add foreign key constraint
            print("Adding foreign key constraint...")
            conn.execute(text("""
                ALTER TABLE todos 
                ADD CONSTRAINT fk_todos_user_id 
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            """))
            
            # Add index
            print("Adding index on user_id...")
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_todos_user_id ON todos(user_id)
            """))
            
            print("[OK] Successfully added 'user_id' column to 'todos' table")
            
    except Exception as e:
        print(f"[ERROR] Error adding column: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        engine.dispose()

if __name__ == "__main__":
    print("Running migration: add_user_id_column")
    add_user_id_column()
    print("Migration completed!")

