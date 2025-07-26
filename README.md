# ClickFit

A web application for fitness and health management with image upload functionality.

## Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (version 14 or higher)
- **npm** (comes with Node.js)
- **MySQL** or compatible database server
- A web browser

## Installation

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd clickfit
   ```
   Or extract the project files to a folder named `clickfit`

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Database Setup**
   - Start your MySQL server
   - Create a new database named `clickfit_db`:
     ```sql
     CREATE DATABASE clickfit_db;
     ```
   - Import the database schema:
     ```bash
     mysql -u root -p clickfit_db < database_setup.sql
     ```
   - Configure database connection in `server.js`:
     ```javascript
     const dbConfig = {
         host: 'localhost',
         user: 'root',
         password: 'root',
         database: 'clickfit_db',
         waitForConnections: true,
         connectionLimit: 10,
         queueLimit: 0
     };
     ```
   - **Important**: Update the database credentials (especially the password) in `server.js` to match your MySQL setup

4. **Server Configuration**
   - The server runs on port 3000 by default (check `server.js` for the exact port)
   - If you need to change the port, update it in `server.js`:
     ```javascript
     const PORT = process.env.PORT || 3000;
     app.listen(PORT, () => {
         console.log(`Server running on port ${PORT}`);
     });
     ```
   - **Important**: Make sure your frontend (`index.html` and `index2.html`) uses the correct API URL:
     - For local development: `http://localhost:3000/api/...`
     - Update any API calls in your HTML/JavaScript files to match the server port
   - Ensure the `upload_images` directory has proper write permissions

## Running the Application

1. **Start the server**
   ```bash
   npm start
   ```
   Or if no start script is defined:
   ```bash
   node server.js
   ```

2. **Access the application**
   - Open your web browser
   - Navigate to `http://localhost:3000` (or the port specified in server.js)
   - You can access different pages:
     - Main page: `index.html`
     - Alternative page: `index2.html`

## Project Structure

```
clickfit/
├── server.js                 # Main server file
├── package.json             # Project dependencies and scripts
├── package-lock.json        # Locked dependency versions
├── database_setup.sql       # Database schema and initial data
├── index.html              # Main frontend page
├── index2.html             # Alternative frontend page
├── upload_images/          # Directory for uploaded images
├── API Documentation.txt   # API endpoint documentation
```

## Features

- Web-based fitness/health management interface
- Image upload functionality
- Database integration for data persistence

## API Documentation

The following API endpoints are available:

- **POST /api/users** - Create user
- **GET /api/users** - Get all users  
- **GET /api/users/:id** - Get user by ID
- **PUT /api/users/:id** - Update user
- **DELETE /api/users/:id** - Delete user
- **POST /api/login** - User login
- **GET /api/stats** - Database stats
