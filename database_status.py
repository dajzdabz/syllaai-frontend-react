#!/usr/bin/env python3
"""
Database status checker for SyllabAI
"""

import sys
import os

# Add the backend directory to Python path
sys.path.append('/mnt/c/Users/jdabl/SyllabAI/backend')

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Try both database URLs
URLS = {
    "Production": "postgresql://syllaai.user:QsBkr7vJdU1QQ4UtnyCtRHCvZoQy8VRz@dpg-cr9vj7rtq21c73cmq2vg-a.oregon-postgres.render.com/syllaai",
    "Internal": "postgresql://syllaai:gtOX4WcmHynsOKRPwUNKHg7dIshSkUPm@dpg-d1ne60umcj7s73f39nag-a/syllaai_dev"
}

def check_database_status():
    """Check current database status"""
    print("🔍 Checking SyllabAI database status...")
    
    for name, url in URLS.items():
        print(f"\n📡 Trying {name} URL...")
        try:
            engine = create_engine(url, pool_pre_ping=True)
            Session = sessionmaker(bind=engine)
            session = Session()
            
            # Test connection
            session.execute(text("SELECT 1"))
            print(f"✅ {name} connection successful!")
            
            # Check table counts
            tables = ['users', 'courses', 'course_events', 'student_course_links']
            print("   Current data:")
            for table in tables:
                try:
                    result = session.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    count = result.scalar()
                    print(f"     {table}: {count} records")
                except Exception as e:
                    print(f"     {table}: Error - {e}")
            
            # Check user roles
            try:
                result = session.execute(text("SELECT role, COUNT(*) FROM users GROUP BY role"))
                roles = result.fetchall()
                if roles:
                    print("   User roles:")
                    for role, count in roles:
                        print(f"     {role}: {count} users")
                else:
                    print("   No users in database")
            except Exception as e:
                print(f"   User roles: Error - {e}")
                
            session.close()
            print(f"✅ {name} status check complete")
            return True  # Successfully connected with one URL
            
        except Exception as e:
            print(f"❌ {name} connection failed: {e}")
            continue
    
    print("\n❌ All database connections failed")
    return False

if __name__ == "__main__":
    print("🚀 SyllabAI Database Status Checker")
    check_database_status()