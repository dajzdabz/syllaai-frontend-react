#!/usr/bin/env python3
"""
Database cleanup script for SyllabAI professor removal
Wipes all data and converts to student-only app
"""

import os
import sys
import asyncpg
import asyncio

# Database connection string from CLAUDE.md
DATABASE_URL = "postgresql://syllaai.user:QsBkr7vJdU1QQ4UtnyCtRHCvZoQy8VRz@dpg-cr9vj7rtq21c73cmq2vg-a.oregon-postgres.render.com/syllaai"

async def cleanup_database():
    """Clean up database for student-only app conversion"""
    print("🧹 Starting database cleanup for student-only app conversion...")
    
    try:
        # Connect to database
        print("📡 Connecting to production database...")
        conn = await asyncpg.connect(DATABASE_URL)
        
        # Start transaction for safety
        async with conn.transaction():
            print("🗑️  Truncating all tables...")
            
            # Truncate all tables (CASCADE removes foreign key constraints)
            await conn.execute("TRUNCATE courses, course_events, student_course_links, users CASCADE;")
            print("✅ All data cleared")
            
            # Update any remaining user roles (if any data survived)
            print("👤 Converting any remaining STUDENT roles to USER...")
            result = await conn.execute("UPDATE users SET role = 'user' WHERE role = 'student';")
            print(f"   Updated {result.split()[-1]} student records")
            
            # Remove any professor accounts
            print("🚫 Removing any professor accounts...")
            result = await conn.execute("DELETE FROM users WHERE role = 'professor';")
            print(f"   Removed {result.split()[-1]} professor records")
            
            print("✅ Database cleanup completed successfully!")
            
    except Exception as e:
        print(f"❌ Database cleanup failed: {e}")
        return False
        
    finally:
        await conn.close()
        print("📡 Database connection closed")
    
    return True

async def verify_cleanup():
    """Verify the cleanup was successful"""
    print("\n🔍 Verifying cleanup...")
    
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        
        # Check table counts
        tables = ['users', 'courses', 'course_events', 'student_course_links']
        for table in tables:
            count = await conn.fetchval(f"SELECT COUNT(*) FROM {table};")
            print(f"   {table}: {count} records")
        
        # Check user roles if any users exist
        roles = await conn.fetch("SELECT role, COUNT(*) FROM users GROUP BY role;")
        if roles:
            print("   User roles:")
            for role_row in roles:
                print(f"     {role_row['role']}: {role_row['count']} users")
        else:
            print("   No users in database")
            
        await conn.close()
        print("✅ Verification complete!")
        
    except Exception as e:
        print(f"❌ Verification failed: {e}")

if __name__ == "__main__":
    print("🚀 SyllabAI Database Cleanup Script")
    print("   Converting from professor-student to student-only app")
    print("   This will WIPE ALL DATA from the production database!")
    
    # Confirmation prompt
    confirm = input("\n⚠️  Are you sure you want to proceed? Type 'yes' to continue: ")
    if confirm.lower() != 'yes':
        print("❌ Cleanup cancelled")
        sys.exit(0)
    
    # Run cleanup
    asyncio.run(cleanup_database())
    asyncio.run(verify_cleanup())
    
    print("\n🎉 Database is now ready for student-only app!")
    print("   You can now test the updated application")