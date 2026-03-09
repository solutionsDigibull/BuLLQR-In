"""Seed initial data for Cable Assembly Production Tracker."""
import sys
from pathlib import Path

# Add src to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from src.database import SessionLocal
from src.models import ProductionStage, Operator, ReworkCost
from src.auth.password import hash_password, verify_password
import uuid


def seed_production_stages(db):
    """
    Seed 5 production stages in sequence.

    Stages:
    1. Cutting
    2. Stripping
    3. Crimping
    4. Testing
    5. Final Inspection
    """
    stages = [
        {"stage_name": "Cutting", "stage_sequence": 1, "description": "Cable cutting stage"},
        {"stage_name": "Stripping", "stage_sequence": 2, "description": "Wire stripping stage"},
        {"stage_name": "Crimping", "stage_sequence": 3, "description": "Connector crimping stage"},
        {"stage_name": "Testing", "stage_sequence": 4, "description": "Electrical testing stage"},
        {"stage_name": "Final Inspection", "stage_sequence": 5, "description": "Final quality inspection stage"},
    ]

    for stage_data in stages:
        # Check if stage already exists
        existing = db.query(ProductionStage).filter_by(stage_name=stage_data["stage_name"]).first()
        if not existing:
            stage = ProductionStage(id=uuid.uuid4(), **stage_data)
            db.add(stage)

    db.commit()
    print("✓ Created 5 production stages")


def seed_admin_user(db):
    """
    Create default admin user.

    Credentials:
    - Username: admin
    - Password: changeme
    - Role: admin

    IMPORTANT: Change password after first login!
    """
    # Check if admin already exists
    existing = db.query(Operator).filter_by(username="admin").first()
    if not existing:
        admin = Operator(
            id=uuid.uuid4(),
            username="admin",
            password_hash=hash_password("changeme"),
            full_name="System Administrator",
            role="admin",
            is_active=True
        )
        db.add(admin)
        db.commit()
        print("Created admin user (username: admin, password: changeme)")
    else:
        # Fix admin password if it was hashed with incompatible library
        try:
            if not verify_password("changeme", existing.password_hash):
                existing.password_hash = hash_password("changeme")
                db.commit()
                print("Fixed admin password hash (password reset to: changeme)")
            else:
                print("Admin user already exists, password OK")
        except Exception:
            existing.password_hash = hash_password("changeme")
            db.commit()
            print("Fixed admin password hash (password reset to: changeme)")


def seed_rework_costs(db):
    """
    Create default rework costs ($0.00) for all stages.

    Costs are set to $0.00 initially and can be configured later via admin UI.
    """
    stages = db.query(ProductionStage).all()
    created_count = 0

    for stage in stages:
        # Check if cost config already exists
        existing = db.query(ReworkCost).filter_by(stage_id=stage.id).first()
        if not existing:
            cost = ReworkCost(
                id=uuid.uuid4(),
                stage_id=stage.id,
                cost_per_rework=0.00,
                currency="USD"
            )
            db.add(cost)
            created_count += 1

    db.commit()
    print(f"✓ Created default rework costs for {created_count} stages ($0.00 USD)")


def main():
    """Run all seed data functions."""
    print("=" * 70)
    print("Cable Assembly Production Tracker - Seed Data")
    print("=" * 70)
    print()

    db = SessionLocal()
    try:
        seed_production_stages(db)
        seed_admin_user(db)
        seed_rework_costs(db)

        print()
        print("=" * 70)
        print("✅ Seed data created successfully!")
        print("=" * 70)
        print()
        print("Next steps:")
        print("1. Change admin password (username: admin, password: changeme)")
        print("2. Create operator accounts via admin UI")
        print("3. Configure production targets and rework costs")
        print()

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
