#!/usr/bin/env python3
"""
Script to query the production database for the specific course and its events.
This uses the backend's database configuration.
"""

import sys
import os
sys.path.append('/mnt/c/Users/jdabl/SyllabAI/backend')

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Use the production database URL directly
DATABASE_URL = "postgresql://syllaai.user:QsBkr7vJdU1QQ4UtnyCtRHCvZoQy8VRz@dpg-cr9vj7rtq21c73cmq2vg-a.oregon-postgres.render.com/syllaai"

def query_course_and_events():
    """Query the database for the specific course and its events."""
    
    # Create engine with SSL configuration
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args={
            "connect_timeout": 60,
            "application_name": "syllaai-query-script",
            "sslmode": "require"
        }
    )
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    try:
        # Create a session
        with SessionLocal() as session:
            print("Successfully connected to the database!")
            
            # Test connection
            result = session.execute(text("SELECT version();"))
            version = result.fetchone()
            print(f"PostgreSQL version: {version[0]}")
            
            # Query 1: Search for the course by title and user email
            print("\n=== SEARCHING FOR COURSE BY TITLE AND USER ===")
            course_query = text("""
                SELECT id, title, course_type, semester, created_by, school_id, created_at 
                FROM courses 
                WHERE title = :title AND created_by = :email
            """)
            
            result = session.execute(course_query, {
                "title": "Production & Operations Management",
                "email": "jdabliz1@gmail.com"
            })
            course_result = result.fetchone()
            
            if course_result:
                course_id = course_result[0]
                print(f"Course found:")
                print(f"  ID: {course_result[0]}")
                print(f"  Title: {course_result[1]}")
                print(f"  Type: {course_result[2]}")
                print(f"  Semester: {course_result[3]}")
                print(f"  Created by: {course_result[4]}")
                print(f"  School ID: {course_result[5]}")
                print(f"  Created at: {course_result[6]}")
                
                # Query events for this course
                print(f"\n=== EVENTS FOR COURSE ID: {course_id} ===")
                events_query = text("""
                    SELECT id, title, description, start_time, end_time, event_source, created_at
                    FROM course_events 
                    WHERE course_id = :course_id
                    ORDER BY start_time
                """)
                
                events_result = session.execute(events_query, {"course_id": course_id})
                events = events_result.fetchall()
                
                print(f"Number of events found: {len(events)}")
                
                if events:
                    print("\nEvent details:")
                    for i, event in enumerate(events, 1):
                        print(f"  Event {i}:")
                        print(f"    ID: {event[0]}")
                        print(f"    Title: {event[1]}")
                        print(f"    Description: {event[2]}")
                        print(f"    Start time: {event[3]}")
                        print(f"    End time: {event[4]}")
                        print(f"    Event source: {event[5]}")
                        print(f"    Created at: {event[6]}")
                        print()
                else:
                    print("No events found for this course.")
                    
            else:
                print("Course not found with the specified title and user email.")
                
            # Query 2: Search by the provided course ID
            print("\n=== SEARCHING BY PROVIDED COURSE ID ===")
            course_id_query = text("""
                SELECT id, title, course_type, semester, created_by, school_id, created_at 
                FROM courses 
                WHERE id = :course_id
            """)
            
            result = session.execute(course_id_query, {
                "course_id": "508ed4f4-bb12-42da-b525-24a11d7877b0"
            })
            course_by_id = result.fetchone()
            
            if course_by_id:
                course_id = course_by_id[0]
                print(f"Course found by ID:")
                print(f"  ID: {course_by_id[0]}")
                print(f"  Title: {course_by_id[1]}")
                print(f"  Type: {course_by_id[2]}")
                print(f"  Semester: {course_by_id[3]}")
                print(f"  Created by: {course_by_id[4]}")
                print(f"  School ID: {course_by_id[5]}")
                print(f"  Created at: {course_by_id[6]}")
                
                # Query events for this course
                print(f"\n=== EVENTS FOR COURSE FOUND BY ID: {course_id} ===")
                events_result = session.execute(events_query, {"course_id": course_id})
                events = events_result.fetchall()
                
                print(f"Number of events found: {len(events)}")
                
                if events:
                    print("\nEvent details:")
                    for i, event in enumerate(events, 1):
                        print(f"  Event {i}:")
                        print(f"    ID: {event[0]}")
                        print(f"    Title: {event[1]}")
                        print(f"    Description: {event[2]}")
                        print(f"    Start time: {event[3]}")
                        print(f"    End time: {event[4]}")
                        print(f"    Event source: {event[5]}")
                        print(f"    Created at: {event[6]}")
                        print()
                else:
                    print("No events found for this course.")
            else:
                print("Course not found by the provided course ID either.")
                
            # Query 3: Get all courses for the user
            print("\n=== ALL COURSES FOR USER jdabliz1@gmail.com ===")
            all_courses_query = text("""
                SELECT id, title, course_type, semester, created_at 
                FROM courses 
                WHERE created_by = :email
                ORDER BY created_at DESC
            """)
            
            result = session.execute(all_courses_query, {"email": "jdabliz1@gmail.com"})
            all_courses = result.fetchall()
            
            print(f"Total courses found for user: {len(all_courses)}")
            
            if all_courses:
                print("\nAll courses:")
                for i, course in enumerate(all_courses, 1):
                    print(f"  Course {i}:")
                    print(f"    ID: {course[0]}")
                    print(f"    Title: {course[1]}")
                    print(f"    Type: {course[2]}")
                    print(f"    Semester: {course[3]}")
                    print(f"    Created at: {course[4]}")
                    print()
                    
                    # Quick count of events for each course
                    events_count_query = text("""
                        SELECT COUNT(*) FROM course_events WHERE course_id = :course_id
                    """)
                    count_result = session.execute(events_count_query, {"course_id": course[0]})
                    event_count = count_result.fetchone()[0]
                    print(f"    Events: {event_count}")
                    print()
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    query_course_and_events()