import sys
import os

# Add the parent directory to sys.path to allow imports from backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from config.database import SessionLocal
from models.user import User
from services.auth_service import hash_password


def seed_data():
    db: Session = SessionLocal()
    try:
        # Check if admin user exists
        admin_email = "admin@example.com"
        existing_user = db.query(User).filter(User.email == admin_email).first()

        if not existing_user:
            print(f"Creating default user: {admin_email}")
            user = User(
                email=admin_email,
                hashed_password=hash_password("admin123"),
                is_active=True,
                is_verified=True,
                language="en",
            )
            db.add(user)
            db.commit()
            print("User created successfully!")
        else:
            print("User already exists.")

    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
