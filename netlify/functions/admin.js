const fs = require('fs').promises;
const path = require('path');

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json');

async function readSettings() {
    try {
        const data = await fs.readFile(SETTINGS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { admin: { username: 'admin', password: 'admin123' } };
    }
}

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        if (event.httpMethod === 'POST') {
            const { username, password } = JSON.parse(event.body);
            const settings = await readSettings();
            
            if (username === settings.admin.username && password === settings.admin.password) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ 
                        success: true, 
                        message: 'Login successful',
                        user: { username }
                    })
                };
            } else {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ 
                        success: false, 
                        error: 'Invalid credentials' 
                    })
                };
            }
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Error in admin function:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: error.message || 'Internal server error' 
            })
        };
    }
};