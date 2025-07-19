#!/usr/bin/env python3
"""
Script to query course information via the backend API.
Since direct database connection is failing due to SSL issues,
we'll use the backend's endpoints to get the information.
"""

import requests
import json
import sys

# Backend URL
BACKEND_URL = "http://localhost:8001"

def get_auth_token():
    """
    For this debug script, we'll need to mock authentication.
    In a real scenario, we'd need proper OAuth flow.
    """
    # This is a debug query, so we'll try to call the protected endpoints
    # and see what happens
    return None

def query_courses_via_api():
    """Query courses via the backend API."""
    
    try:
        # First check if backend is running
        health_response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if health_response.status_code != 200:
            print("❌ Backend is not running or not healthy")
            return
            
        print("✅ Backend is running and healthy")
        
        # Try to get courses for the user
        # Since this requires authentication, let's check what endpoints are available
        
        # Let's try the OpenAPI/docs endpoint to see available endpoints
        try:
            docs_response = requests.get(f"{BACKEND_URL}/docs", timeout=10)
            print(f"📖 API docs available at: {BACKEND_URL}/docs")
        except:
            pass
            
        # Let's try to make a request to the courses endpoint without auth
        # to see what kind of error we get
        print("\n=== Attempting to access courses endpoint ===")
        
        try:
            courses_response = requests.get(f"{BACKEND_URL}/courses", timeout=10)
            print(f"Courses endpoint status: {courses_response.status_code}")
            print(f"Response: {courses_response.text[:500]}")
        except Exception as e:
            print(f"Error accessing courses endpoint: {e}")
            
        # Let's try to access the specific course by ID if there's an endpoint for it
        target_course_id = "508ed4f4-bb12-42da-b525-24a11d7877b0"
        
        try:
            course_response = requests.get(f"{BACKEND_URL}/courses/{target_course_id}", timeout=10)
            print(f"\nSpecific course endpoint status: {course_response.status_code}")
            print(f"Response: {course_response.text[:500]}")
        except Exception as e:
            print(f"Error accessing specific course endpoint: {e}")
            
        # Let's try to access events endpoint
        try:
            events_response = requests.get(f"{BACKEND_URL}/events", timeout=10)
            print(f"\nEvents endpoint status: {events_response.status_code}")
            print(f"Response: {events_response.text[:500]}")
        except Exception as e:
            print(f"Error accessing events endpoint: {e}")
            
        print(f"\n=== SUMMARY ===")
        print(f"The backend is running and accessible at {BACKEND_URL}")
        print(f"However, the course and events endpoints require authentication.")
        print(f"To get the course data, you would need to:")
        print(f"1. Authenticate via Google OAuth")
        print(f"2. Use the JWT token to access protected endpoints")
        print(f"3. Or run a direct database query from an environment that can connect to Render")
        
        print(f"\n=== RECOMMENDATION ===")
        print(f"Since the SSL connection to the production database is failing from this WSL environment,")
        print(f"you have a few options:")
        print(f"1. Use a different environment (like the production server itself) to run database queries")
        print(f"2. Implement a debug endpoint in the backend that doesn't require auth")
        print(f"3. Use the frontend application to query the course and check the browser's network tab")
        print(f"4. Check if the backend logs show any relevant information about this course")
        
    except Exception as e:
        print(f"Error querying via API: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    query_courses_via_api()