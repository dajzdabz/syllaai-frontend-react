-- Fix missing school_id column in courses table
-- This script adds the missing school_id column if it doesn't exist

-- First, check if the column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'courses' 
        AND column_name = 'school_id'
    ) THEN
        -- Add the school_id column
        ALTER TABLE courses ADD COLUMN school_id INTEGER;
        
        -- Add the foreign key constraint to schools table
        ALTER TABLE courses ADD CONSTRAINT fk_courses_school_id 
        FOREIGN KEY (school_id) REFERENCES schools(id);
        
        RAISE NOTICE 'Added school_id column to courses table';
    ELSE
        RAISE NOTICE 'school_id column already exists in courses table';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'courses' 
AND column_name = 'school_id';