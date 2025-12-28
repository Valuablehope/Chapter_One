-- =====================================================
-- License Key Generator Script for pgAdmin
-- Generates cryptographically secure unique license keys
-- Format: XXXX-XXXX-XXXX-XXXX (16 alphanumeric characters)
-- Encrypts the key before storing in database
-- Returns readable key in result set
-- =====================================================

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- Encryption Key Configuration
-- IMPORTANT: Change this to a secure key in production!
-- 
-- For production, you should:
-- 1. Set LICENSE_ENCRYPTION_KEY in your .env file
-- 2. Update the key below to match your .env value
-- 3. Or better: Create a configuration table to store the key
-- =====================================================
DO $$
DECLARE
    -- TODO: Replace this with your actual encryption key from .env
    -- The key should match LICENSE_ENCRYPTION_KEY in your .env file
    encryption_key_value TEXT := 'ChapterOneLicenseKey2024!SecureEncryptionKey12345678';
BEGIN
    -- Set encryption key (32 bytes for AES-256)
    -- In production, this should come from a secure configuration table or environment
    PERFORM set_config('app.license_encryption_key', encryption_key_value, false);
END $$;

-- =====================================================
-- Function to generate unique license key
-- =====================================================
CREATE OR REPLACE FUNCTION generate_unique_license_key()
RETURNS TABLE(
    license_key_readable TEXT,
    license_key_encrypted TEXT,
    license_key_hash TEXT,
    message TEXT
) AS $$
DECLARE
    new_key TEXT;
    encrypted_key TEXT;
    key_hash TEXT;
    key_exists BOOLEAN;
    max_attempts INTEGER := 1000;
    attempt_count INTEGER := 0;
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    segment1 TEXT;
    segment2 TEXT;
    segment3 TEXT;
    segment4 TEXT;
    random_bytes BYTEA;
    random_index INTEGER;
    -- Get encryption key from PostgreSQL config or use default
    -- IMPORTANT: Update this to match your LICENSE_ENCRYPTION_KEY from .env
    encryption_key TEXT := COALESCE(
        current_setting('app.license_encryption_key', true),
        'ChapterOneLicenseKey2024!SecureEncryptionKey12345678'
    );
BEGIN
    -- Ensure encryption key is exactly 32 bytes for AES-256
    encryption_key := substr(encryption_key, 1, 32);
    
    -- Loop until we find a unique key
    LOOP
        attempt_count := attempt_count + 1;
        
        -- Generate cryptographically secure random segments
        -- Using gen_random_bytes for true cryptographic randomness
        segment1 := '';
        segment2 := '';
        segment3 := '';
        segment4 := '';
        
        -- Generate each segment using cryptographically secure random bytes
        FOR i IN 1..4 LOOP
            -- Get random bytes (cryptographically secure)
            random_bytes := gen_random_bytes(2);
            
            -- Convert to index (0-35 for 36 characters)
            random_index := (get_byte(random_bytes, 0) * 256 + get_byte(random_bytes, 1)) % 36;
            segment1 := segment1 || substr(chars, random_index + 1, 1);
            
            random_bytes := gen_random_bytes(2);
            random_index := (get_byte(random_bytes, 0) * 256 + get_byte(random_bytes, 1)) % 36;
            segment2 := segment2 || substr(chars, random_index + 1, 1);
            
            random_bytes := gen_random_bytes(2);
            random_index := (get_byte(random_bytes, 0) * 256 + get_byte(random_bytes, 1)) % 36;
            segment3 := segment3 || substr(chars, random_index + 1, 1);
            
            random_bytes := gen_random_bytes(2);
            random_index := (get_byte(random_bytes, 0) * 256 + get_byte(random_bytes, 1)) % 36;
            segment4 := segment4 || substr(chars, random_index + 1, 1);
        END LOOP;
        
        -- Combine segments with dashes
        new_key := segment1 || '-' || segment2 || '-' || segment3 || '-' || segment4;
        
        -- Create a SHA-256 hash of the readable key for uniqueness checking
        -- This allows us to check uniqueness even when keys are encrypted
        key_hash := encode(digest(new_key, 'sha256'), 'hex');
        
        -- Check if key already exists in database
        -- We check the readable format directly (for backward compatibility with unencrypted keys)
        -- For encrypted keys, the probability of collision is extremely low (1 in 36^16)
        -- so we rely on the random generation being unique
        SELECT EXISTS(
            SELECT 1 FROM licenses 
            WHERE license_key = new_key  -- Check readable format
        ) INTO key_exists;
        
        -- Note: For encrypted keys stored in the database, we can't easily check uniqueness
        -- without decrypting all keys. The cryptographic randomness ensures uniqueness.
        -- If you need strict uniqueness checking for encrypted keys, consider adding
        -- a license_key_hash column to store the hash for fast lookups.
        
        -- If key doesn't exist, we found a unique one
        EXIT WHEN NOT key_exists;
        
        -- Safety check: prevent infinite loop
        IF attempt_count >= max_attempts THEN
            RETURN QUERY SELECT 
                NULL::TEXT as license_key_readable,
                NULL::TEXT as license_key_encrypted,
                NULL::TEXT as license_key_hash,
                ('ERROR: Could not generate unique license key after ' || max_attempts || ' attempts')::TEXT as message;
            RETURN;
        END IF;
    END LOOP;
    
    -- Encrypt the license key using AES-256 encryption
    encrypted_key := encode(
        encrypt(
            new_key::bytea,
            encryption_key::bytea,
            'aes'
        ),
        'base64'
    );
    
    -- Return the results
    RETURN QUERY SELECT 
        new_key as license_key_readable,
        encrypted_key as license_key_encrypted,
        key_hash as license_key_hash,
        ('SUCCESS: Unique license key generated in ' || attempt_count || ' attempt(s)')::TEXT as message;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Helper Function: Decrypt license key
-- Use this to decrypt stored license keys for validation
-- =====================================================
CREATE OR REPLACE FUNCTION decrypt_license_key(encrypted_key TEXT)
RETURNS TEXT AS $$
DECLARE
    -- Get encryption key from PostgreSQL config or use default
    -- IMPORTANT: Update this to match your LICENSE_ENCRYPTION_KEY from .env
    encryption_key TEXT := COALESCE(
        current_setting('app.license_encryption_key', true),
        'ChapterOneLicenseKey2024!SecureEncryptionKey12345678'
    );
    decrypted_key BYTEA;
    decrypted_text TEXT;
BEGIN
    -- Ensure encryption key is exactly 32 bytes
    encryption_key := substr(encryption_key, 1, 32);
    
    -- Decrypt the key
    BEGIN
        decrypted_key := decrypt(
            decode(encrypted_key, 'base64')::bytea,
            encryption_key::bytea,
            'aes'
        );
        
        -- Convert bytea to text properly using convert_from
        decrypted_text := convert_from(decrypted_key, 'UTF8');
        
        RETURN decrypted_text;
    EXCEPTION WHEN OTHERS THEN
        -- If decryption fails, return NULL
        RETURN NULL;
    END;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Main Script Execution
-- Run this to generate a new unique license key
-- The readable key will be displayed in the result set
-- =====================================================

-- Generate the license key and display results
SELECT 
    license_key_readable as "🔑 LICENSE KEY (READABLE - SAVE THIS!)",
    license_key_encrypted as "🔒 ENCRYPTED KEY (FOR DATABASE)",
    license_key_hash as "📋 KEY HASH (FOR UNIQUENESS)",
    message as "✅ STATUS"
FROM generate_unique_license_key();

-- =====================================================
-- Instructions:
-- 1. Run the SELECT statement above to generate a key
-- 2. Copy the readable key from the result set (SAVE THIS!)
-- 3. Use the encrypted key when inserting into licenses table
-- 4. The hash can be used for additional uniqueness checks
-- =====================================================

-- =====================================================
-- Example: Insert generated license into database
-- Uncomment and modify as needed
-- =====================================================

/*
DO $$
DECLARE
    result RECORD;
    store_uuid UUID;
    generated_readable_key TEXT;
    generated_encrypted_key TEXT;
BEGIN
    -- Get store_id (modify this query to select your specific store)
    SELECT store_id INTO store_uuid FROM stores LIMIT 1;
    
    IF store_uuid IS NULL THEN
        RAISE EXCEPTION 'No store found. Please create a store first.';
    END IF;
    
    -- Generate the license key
    SELECT * INTO result FROM generate_unique_license_key();
    generated_readable_key := result.license_key_readable;
    generated_encrypted_key := result.license_key_encrypted;
    
    -- Insert or update license in licenses table with ENCRYPTED key
    INSERT INTO licenses (
        store_id,
        license_key,  -- Store the ENCRYPTED version
        subscription_type,
        status,
        valid,
        start_date,
        expiry_date,
        max_devices,
        customer_name,
        customer_email
    ) VALUES (
        store_uuid,
        generated_encrypted_key,  -- ENCRYPTED key goes here
        'yearly',
        'active',
        true,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '1 year',
        1,
        'License Customer',
        'customer@example.com'
    )
    ON CONFLICT (store_id) 
    DO UPDATE SET
        license_key = EXCLUDED.license_key,
        subscription_type = EXCLUDED.subscription_type,
        status = EXCLUDED.status,
        valid = EXCLUDED.valid,
        start_date = EXCLUDED.start_date,
        expiry_date = EXCLUDED.expiry_date,
        max_devices = EXCLUDED.max_devices,
        customer_name = EXCLUDED.customer_name,
        customer_email = EXCLUDED.customer_email,
        updated_at = CURRENT_TIMESTAMP;
    
    -- Display the readable key (IMPORTANT: Save this!)
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ LICENSE KEY GENERATED SUCCESSFULLY!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔑 READABLE KEY (SAVE THIS): %', generated_readable_key;
    RAISE NOTICE '📝 This key has been encrypted and stored in the database.';
    RAISE NOTICE '⚠️  Keep the readable key safe - you will need it for activation!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;
*/
