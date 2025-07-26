const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MySQL Database Configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'clickfit_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create MySQL connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Database connected successfully');
        connection.release();
    } catch (error) {
        console.error('Database connection failed:', error.message);
        console.log('Please make sure MySQL is running and credentials are correct');
    }
}

// Create upload directory if it doesn't exist
const uploadDir = path.join(__dirname, 'upload_images');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter to only allow images
const fileFilter = (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit per file
    }
});

// Serve static files (the HTML page)
app.use(express.static(path.join(__dirname, 'public')));

// Upload endpoint
app.post('/upload', upload.array('images', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files uploaded'
            });
        }

        const uploadedFiles = req.files.map(file => ({
            filename: file.filename,
            originalname: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            path: file.path
        }));

        console.log(`Successfully uploaded ${uploadedFiles.length} files:`, uploadedFiles);

        res.json({
            success: true,
            message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
            files: uploadedFiles
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Upload failed',
            error: error.message
        });
    }
});

// List uploaded images endpoint
app.get('/images', (req, res) => {
    try {
        const files = fs.readdirSync(uploadDir);
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
        });

        const imageList = imageFiles.map(file => ({
            filename: file,
            url: `/upload_images/${file}`,
            size: fs.statSync(path.join(uploadDir, file)).size,
            created: fs.statSync(path.join(uploadDir, file)).birthtime
        }));

        res.json({
            success: true,
            images: imageList
        });
    } catch (error) {
        console.error('Error listing images:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list images',
            error: error.message
        });
    }
});

// Serve uploaded images
app.use('/upload_images', express.static(uploadDir));

// ===========================================
// DATABASE API ENDPOINTS
// ===========================================

// Add new user using stored procedure
app.post('/api/users', async (req, res) => {
    try {
        const { email, password, type = 'member', active = true } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Call stored procedure
        const [results] = await pool.execute(
            'CALL addUser(?, ?, ?, ?)',
            [email, hashedPassword, type, active]
        );

        res.json({
            success: true,
            message: 'User created successfully',
            data: results[0]
        });

    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create user'
        });
    }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;

        const [results] = await pool.execute(
            'CALL getUserById(?)',
            [userId]
        );

        if (results[0].length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: results[0][0]
        });

    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user'
        });
    }
});

// Get all users or users by type
app.get('/api/users', async (req, res) => {
    try {
        const { type, active } = req.query;
        let query = 'SELECT userId, email, type, active, created_at, updated_at FROM users';
        let params = [];

        // Build dynamic query based on filters
        const conditions = [];
        if (type) {
            conditions.push('type = ?');
            params.push(type);
        }
        if (active !== undefined) {
            conditions.push('active = ?');
            params.push(active === 'true');
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY created_at DESC';

        const [results] = await pool.execute(query, params);

        res.json({
            success: true,
            data: results,
            count: results.length
        });

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const { email, password, type, active } = req.body;

        if (!email || !type || active === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Email, type, and active status are required'
            });
        }

        let hashedPassword = password;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        const [results] = await pool.execute(
            'CALL updateUser(?, ?, ?, ?, ?)',
            [userId, email, hashedPassword, type, active]
        );

        res.json({
            success: true,
            message: 'User updated successfully',
            data: results[0]
        });

    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update user'
        });
    }
});

// Delete (deactivate) user
app.delete('/api/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;

        const [results] = await pool.execute(
            'CALL deleteUser(?)',
            [userId]
        );

        res.json({
            success: true,
            message: 'User deactivated successfully',
            data: results[0]
        });

    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete user'
        });
    }
});

// Get users by type using stored procedure
app.get('/api/users/type/:type', async (req, res) => {
    try {
        const userType = req.params.type;

        if (!['admin', 'trainer', 'member'].includes(userType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user type. Must be admin, trainer, or member'
            });
        }

        const [results] = await pool.execute(
            'CALL getUsersByType(?)',
            [userType]
        );

        res.json({
            success: true,
            data: results[0],
            count: results[0].length
        });

    } catch (error) {
        console.error('Error fetching users by type:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users by type'
        });
    }
});

// Login endpoint (bonus feature)
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Get user by email
        const [results] = await pool.execute(
            'SELECT userId, email, password, type, active FROM users WHERE email = ?',
            [email]
        );

        if (results.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const user = results[0];

        // Check if user is active
        if (!user.active) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated'
            });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Remove password from response
        delete user.password;

        res.json({
            success: true,
            message: 'Login successful',
            user: user
        });

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

// Database statistics endpoint
app.get('/api/stats', async (req, res) => {
    try {
        const [totalUsers] = await pool.execute('SELECT COUNT(*) as total FROM users');
        const [activeUsers] = await pool.execute('SELECT COUNT(*) as active FROM users WHERE active = true');
        const [usersByType] = await pool.execute('SELECT type, COUNT(*) as count FROM users GROUP BY type');

        res.json({
            success: true,
            data: {
                totalUsers: totalUsers[0].total,
                activeUsers: activeUsers[0].active,
                usersByType: usersByType
            }
        });

    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 5MB.'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files. Maximum is 10 files.'
            });
        }
    }
    
    res.status(500).json({
        success: false,
        message: error.message || 'Something went wrong!'
    });
});

// Default route
app.get('/', (req, res) => {
    res.send(`
        <h1>ClickFit Server is Running!</h1>
        <h2>Available Endpoints:</h2>
        
        <h3>File Upload:</h3>
        <ul>
            <li>POST /upload - Upload images</li>
            <li>GET /images - List uploaded images</li>
            <li>GET /upload_images/:filename - Access uploaded images</li>
        </ul>
        
        <h3>User Management API:</h3>
        <ul>
            <li>POST /api/users - Create new user</li>
            <li>GET /api/users - Get all users (with filters: ?type=admin&active=true)</li>
            <li>GET /api/users/:id - Get user by ID</li>
            <li>PUT /api/users/:id - Update user</li>
            <li>DELETE /api/users/:id - Deactivate user</li>
            <li>GET /api/users/type/:type - Get users by type (admin/trainer/member)</li>
            <li>POST /api/login - User login</li>
            <li>GET /api/stats - Database statistics</li>
        </ul>
        
        <h3>Example API Usage:</h3>
        <pre>
POST /api/users
{
    "email": "user@example.com",
    "password": "password123",
    "type": "member",
    "active": true
}

POST /api/login
{
    "email": "user@example.com",
    "password": "password123"
}
        </pre>
        
        <p>Server running on port ${PORT}</p>
        <p>Database: ${dbConfig.database}</p>
    `);
});

// Start server and test database connection
app.listen(PORT, async () => {
    console.log(`🚀 ClickFit server running on http://localhost:${PORT}`);
    console.log(`📁 Upload directory: ${uploadDir}`);
    console.log('📷 Ready to receive image uploads!');
    console.log('🗄️  Testing database connection...');
    
    await testConnection();
    
    console.log('\n📋 Available API endpoints:');
    console.log('   POST /api/users - Create user');
    console.log('   GET  /api/users - Get all users');
    console.log('   GET  /api/users/:id - Get user by ID');
    console.log('   PUT  /api/users/:id - Update user');
    console.log('   DELETE /api/users/:id - Delete user');
    console.log('   POST /api/login - User login');
    console.log('   GET  /api/stats - Database stats');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server gracefully...');
    process.exit(0);
});