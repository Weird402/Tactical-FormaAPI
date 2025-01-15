// Import required packages
const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

// MySQL database configuration
/*const config = {
    host:'localhost',// process.env.DB_HOST,  // MySQL server host
    user: 'root',//process.env.DB_USER,  // Database username from environment variables
    password: '',// process.env.DB_PASSWORD,  // Database password from environment variables
    database: 'tactical_forma',//process.env.DB_NAME,  // Database name from environment variables
    port: process.env.SQL_PORT,  // MySQL default port
};*/
const config = {
    host: process.env.DB_HOST,  // MySQL server host
    user: process.env.DB_USER,  // Database username from environment variables
    password:  process.env.DB_PASSWORD,  // Database password from environment variables
    database: process.env.DB_NAME,  // Database name from environment variables
    port: process.env.SQL_PORT,  // MySQL default port
};

// Log config for debugging (optional)

// Create the connection pool
const pool = mysql.createPool(config);

// Test the connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to the MySQL database:', err);
    } else {
        console.log('Connected to MySQL database');
        connection.release(); // Release the connection back to the pool after using it
    }
});

// Export the pool for use in other parts of the application
module.exports = pool;