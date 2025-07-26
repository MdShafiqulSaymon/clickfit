
-- CREATE DATABASE IF NOT EXISTS clickfit_db;
-- USE clickfit_db;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    userId INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    type ENUM('admin', 'trainer', 'member') DEFAULT 'member',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_type ON users(type);
CREATE INDEX idx_users_active ON users(active);

-- Drop existing stored procedure if it exists
DROP PROCEDURE IF EXISTS addUser;

-- Create stored procedure to add new user
DELIMITER //

CREATE PROCEDURE addUser(
    IN p_email VARCHAR(255),
    IN p_password VARCHAR(255),
    IN p_type ENUM('admin', 'trainer', 'member'),
    IN p_active BOOLEAN
)
BEGIN
    DECLARE user_exists INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT COUNT(*) INTO user_exists 
    FROM users 
    WHERE email = p_email;

    IF user_exists > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Email already exists';
    END IF;

    -- Insert new user
    INSERT INTO users (email, password, type, active) 
    VALUES (p_email, p_password, p_type, p_active);

    COMMIT;

    -- Return the newly created user ID
    SELECT LAST_INSERT_ID() as userId, 'User created successfully' as message;

END //

DELIMITER ;

-- Example calls to the addUser stored procedure

-- Add an admin user
CALL addUser('admin@clickfit.com', 'hashed_password_123', 'admin', TRUE);

-- Add a trainer user
CALL addUser('trainer@clickfit.com', 'hashed_password_456', 'trainer', TRUE);

-- Add a member user
CALL addUser('member@clickfit.com', 'hashed_password_789', 'member', TRUE);

-- Add an inactive member
CALL addUser('inactive@clickfit.com', 'hashed_password_000', 'member', FALSE);

-- Example query to view all users
-- SELECT userId, email, type, active, created_at FROM users;

-- Additional useful stored procedures for user management

-- Drop existing procedures if they exist
DROP PROCEDURE IF EXISTS getUserById;
DROP PROCEDURE IF EXISTS updateUser;
DROP PROCEDURE IF EXISTS deleteUser;
DROP PROCEDURE IF EXISTS getUsersByType;

DELIMITER //

-- Procedure to get user by ID
CREATE PROCEDURE getUserById(
    IN p_userId INT
)
BEGIN
    SELECT userId, email, type, active, created_at, updated_at 
    FROM users 
    WHERE userId = p_userId;
END //

-- Procedure to update user
CREATE PROCEDURE updateUser(
    IN p_userId INT,
    IN p_email VARCHAR(255),
    IN p_password VARCHAR(255),
    IN p_type ENUM('admin', 'trainer', 'member'),
    IN p_active BOOLEAN
)
BEGIN
    DECLARE user_exists INT DEFAULT 0;
    DECLARE email_exists INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- Check if user exists
    SELECT COUNT(*) INTO user_exists 
    FROM users 
    WHERE userId = p_userId;

    IF user_exists = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User not found';
    END IF;

    -- Check if email already exists for another user
    SELECT COUNT(*) INTO email_exists 
    FROM users 
    WHERE email = p_email AND userId != p_userId;

    IF email_exists > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Email already exists for another user';
    END IF;

    -- Update user
    UPDATE users 
    SET email = p_email, 
        password = p_password, 
        type = p_type, 
        active = p_active,
        updated_at = CURRENT_TIMESTAMP
    WHERE userId = p_userId;

    COMMIT;

    SELECT 'User updated successfully' as message, ROW_COUNT() as affected_rows;

END //

-- Procedure to soft delete user (set as inactive)
CREATE PROCEDURE deleteUser(
    IN p_userId INT
)
BEGIN
    DECLARE user_exists INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- Check if user exists
    SELECT COUNT(*) INTO user_exists 
    FROM users 
    WHERE userId = p_userId;

    IF user_exists = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User not found';
    END IF;

    -- Set user as inactive instead of deleting
    UPDATE users 
    SET active = FALSE, updated_at = CURRENT_TIMESTAMP
    WHERE userId = p_userId;

    COMMIT;

    SELECT 'User deactivated successfully' as message, ROW_COUNT() as affected_rows;

END //

-- Procedure to get users by type
CREATE PROCEDURE getUsersByType(
    IN p_type ENUM('admin', 'trainer', 'member')
)
BEGIN
    SELECT userId, email, type, active, created_at, updated_at 
    FROM users 
    WHERE type = p_type
    ORDER BY created_at DESC;
END //

DELIMITER ;

-- Example usage of additional procedures:

-- Get user by ID
-- CALL getUserById(1);

-- Update user
-- CALL updateUser(1, 'newemail@clickfit.com', 'new_hashed_password', 'trainer', TRUE);

-- Deactivate user
-- CALL deleteUser(1);

-- Get all trainers
-- CALL getUsersByType('trainer');

-- Create a view for active users only
CREATE OR REPLACE VIEW active_users AS
SELECT userId, email, type, created_at, updated_at
FROM users
WHERE active = TRUE;

-- Example queries using the view
-- SELECT * FROM active_users;
-- SELECT COUNT(*) as total_active_users FROM active_users;
-- SELECT type, COUNT(*) as count FROM active_users GROUP BY type;

-- ===========================================
-- Additional Procedures (Merged)
-- ===========================================

-- Procedure to get all users
DROP PROCEDURE IF EXISTS getAllUsers;
DELIMITER //
CREATE PROCEDURE getAllUsers()
BEGIN
    SELECT userId, email, type, active, created_at, updated_at 
    FROM users
    ORDER BY created_at DESC;
END //
DELIMITER ;

-- Procedure to get users with optional filters
DROP PROCEDURE IF EXISTS getUsersWithFilters;
DELIMITER //
CREATE PROCEDURE getUsersWithFilters(
    IN p_type VARCHAR(20),
    IN p_active BOOLEAN
)
BEGIN
    SELECT userId, email, type, active, created_at, updated_at 
    FROM users
    WHERE (p_type IS NULL OR type = p_type)
      AND (p_active IS NULL OR active = p_active)
    ORDER BY created_at DESC;
END //
DELIMITER ;

-- Procedure to simulate login (use with caution)
DROP PROCEDURE IF EXISTS loginUser;
DELIMITER //
CREATE PROCEDURE loginUser(
    IN p_email VARCHAR(255),
    IN p_password VARCHAR(255)
)
BEGIN
    SELECT userId, email, type, active 
    FROM users
    WHERE email = p_email AND password = p_password AND active = TRUE;
END //
DELIMITER ;

-- Procedure to get database statistics
DROP PROCEDURE IF EXISTS getStats;
DELIMITER //
CREATE PROCEDURE getStats()
BEGIN
    SELECT COUNT(*) AS total_users FROM users;
    SELECT COUNT(*) AS active_users FROM users WHERE active = TRUE;
    SELECT type, COUNT(*) AS count FROM users GROUP BY type;
END //
DELIMITER ;

-- Example usage:
-- CALL getAllUsers();
-- CALL getUsersWithFilters('admin', TRUE);
-- CALL loginUser('john.doe@example.com', 'password123');
-- CALL getStats();
