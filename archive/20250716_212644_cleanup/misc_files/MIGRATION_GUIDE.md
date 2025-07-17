# Database Migration Guide

## Problem
The `courses` table is missing the `school_id` column, causing the error:
```
column courses.school_id does not exist
```

## Solution Options

### Option 1: Run Python Migration Script (Recommended)

1. **Get your production database URL from Render:**
   - Log in to your Render dashboard
   - Go to your PostgreSQL database service
   - Copy the "External Database URL" (it looks like: `postgresql://user:password@host:port/database`)

2. **Run the migration script:**
   ```bash
   cd backend
   python run_migration.py
   ```
   - When prompted, paste your production database URL
   - The script will safely add the missing `school_id` column

### Option 2: Use Render Console (Alternative)

1. **Access your Render service:**
   - Go to your Render dashboard
   - Select your web service
   - Click "Console" or "Shell"

2. **Run the migration command:**
   ```bash
   alembic upgrade head
   ```

### Option 3: Manual SQL (If other options fail)

1. **Connect to your database using a PostgreSQL client**
2. **Run the SQL from `fix_missing_school_id.sql`:**
   ```sql
   DO $$
   BEGIN
       IF NOT EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'courses' 
           AND column_name = 'school_id'
       ) THEN
           ALTER TABLE courses ADD COLUMN school_id INTEGER;
           ALTER TABLE courses ADD CONSTRAINT fk_courses_school_id 
           FOREIGN KEY (school_id) REFERENCES schools(id);
           RAISE NOTICE 'Added school_id column to courses table';
       ELSE
           RAISE NOTICE 'school_id column already exists in courses table';
       END IF;
   END $$;
   ```

## After Migration

Once the migration is complete, your application should work without the `school_id` error. The course enrollment functionality will be restored.

## Files Created

- `run_migration.py` - Python script to run the migration
- `fix_missing_school_id.sql` - Raw SQL for manual execution
- `MIGRATION_GUIDE.md` - This guide

## Need Help?

If you encounter any issues:
1. Check that your database URL is correct
2. Verify you have network access to your database
3. Ensure the `schools` table exists before running the migration