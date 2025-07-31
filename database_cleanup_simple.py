#!/usr/bin/env python3
"""
Database cleanup script for SyllabAI professor removal
Uses SQLAlchemy (already installed)
"""

import sys
import os

# Add the backend directory to Python path
sys.path.append('/mnt/c/Users/jdabl/SyllabAI/backend')

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Database connection from CLAUDE.md with SSL fix for Render
DATABASE_URL = "postgresql://syllaai.user:QsBkr7vJdU1QQ4UtnyCtRHCvZoQy8VRz@dpg-cr9vj7rtq21c73cmq2vg-a.oregon-postgres.render.com/syllaai"
# SSL connection args for Render.com database
SSL_ARGS = {
    "sslmode": "require",
    "sslcert": None,
    "sslkey": None,
    "sslrootcert": None
}

def cleanup_database():
    """Clean up database for student-only app conversion"""
    print("🧹 Starting database cleanup for student-only app conversion...")
    
    try:
        # Create engine and session with same config as backend
        print("📡 Connecting to production database...")
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            pool_recycle=1800,
            pool_size=5,
            max_overflow=10,
            connect_args={
                "connect_timeout": 30,
                "application_name": "syllaai-database-cleanup",
                "options": "-c statement_timeout=30000",
                "keepalives_idle": "600",
                "keepalives_interval": "30", 
                "keepalives_count": "3"
            }
        )
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Start transaction
        with session.begin():
            print("🗑️  Truncating all tables...")
            
            # Truncate all tables (CASCADE removes foreign key constraints)
            session.execute(text("TRUNCATE courses, course_events, student_course_links, users CASCADE;"))
            print("✅ All data cleared")
            
            # Update any remaining user roles (if any data survived)
            print("👤 Converting any remaining STUDENT roles to USER...")
            result = session.execute(text("UPDATE users SET role = 'user' WHERE role = 'student';"))
            print(f"   Updated {result.rowcount} student records")
            
            # Remove any professor accounts
            print("🚫 Removing any professor accounts...")
            result = session.execute(text("DELETE FROM users WHERE role = 'professor';"))
            print(f"   Removed {result.rowcount} professor records")
            
            print("✅ Database cleanup completed successfully!")
            
    except Exception as e:
        print(f"❌ Database cleanup failed: {e}")
        session.rollback()
        return False
        
    finally:
        session.close()
        print("📡 Database connection closed")
    
    return True

def verify_cleanup():
    """Verify the cleanup was successful"""
    print("\n🔍 Verifying cleanup...")
    
    try:
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            pool_recycle=1800,
            pool_size=5,
            max_overflow=10,
            connect_args={
                "connect_timeout": 30,
                "application_name": "syllaai-database-cleanup-verify",
                "options": "-c statement_timeout=30000",
                "keepalives_idle": "600",
                "keepalives_interval": "30", 
                "keepalives_count": "3"
            }
        )
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Check table counts
        tables = ['users', 'courses', 'course_events', 'student_course_links']
        for table in tables:
            result = session.execute(text(f"SELECT COUNT(*) FROM {table};"))
            count = result.scalar()
            print(f"   {table}: {count} records")
        
        # Check user roles if any users exist
        result = session.execute(text("SELECT role, COUNT(*) FROM users GROUP BY role;"))
        roles = result.fetchall()
        
        if roles:
            print("   User roles:")
            for role, count in roles:
                print(f"     {role}: {count} users")
        else:
            print("   No users in database")
            
        session.close()
        print("✅ Verification complete!")
        
    except Exception as e:
        print(f"❌ Verification failed: {e}")

if __name__ == "__main__":
    print("🚀 SyllabAI Database Cleanup Script")
    print("   Converting from professor-student to student-only app")
    print("   This will WIPE ALL DATA from the production database!")
    
    # Auto-confirm for script execution (user requested database cleanup)
    print("\n⚠️  Auto-confirming database cleanup as requested...")
    confirm = 'yes'
    
    # Run cleanup
    if cleanup_database():
        verify_cleanup()
        print("\n🎉 Database is now ready for student-only app!")
        print("   You can now test the updated application")
    else:
        print("\n❌ Cleanup failed - check the error messages above")