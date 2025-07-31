#!/usr/bin/env python3
"""
Database cleanup script using Render internal URL
"""

import sys
import os

# Add the backend directory to Python path
sys.path.append('/mnt/c/Users/jdabl/SyllabAI/backend')

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Internal Render database URL (should work better)
DATABASE_URL = "postgresql://syllaai:gtOX4WcmHynsOKRPwUNKHg7dIshSkUPm@dpg-d1ne60umcj7s73f39nag-a/syllaai_dev"

def cleanup_database():
    """Clean up database for student-only app conversion"""
    print("🧹 Starting database cleanup using Render internal URL...")
    
    try:
        # Create engine with minimal config for internal connection
        print("📡 Connecting to Render database internally...")
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
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
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
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
    print("🚀 SyllabAI Database Cleanup Script (Render Internal)")
    print("   Converting from professor-student to student-only app")
    print("   This will WIPE ALL DATA from the database!")
    
    # Auto-confirm for script execution (user requested database cleanup)
    print("\n⚠️  Auto-confirming database cleanup as requested...")
    confirm = 'yes'
    
    # Run cleanup
    if cleanup_database():
        verify_cleanup()
        print("\n🎉 Database is now ready for student-only app!")
        print("   Ready to start building the Grade Projector feature!")
    else:
        print("\n❌ Cleanup failed - check the error messages above")