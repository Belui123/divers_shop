const fs = require('fs').promises;
const path = require('path');

const ORDERS_FILE = path.join(process.cwd(), 'data', 'orders.json');

async function ensureDataDirectory() {
    const dataDir = path.join(process.cwd(), 'data');
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }
}

async function readOrders() {
    try {
        await ensureDataDirectory();
        const data = await fs.readFile(ORDERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Если файла нет, создаем пустой массив
        await fs.writeFile(ORDERS_FILE, JSON.stringify([], null, 2));
        return [];
    }
}

async function writeOrders(orders) {
    await ensureDataDirectory();
    await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
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
        if (event.httpMethod === 'GET') {
            const orders = await readOrders();
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, data: orders })
            };
        }

        if (event.httpMethod === 'POST') {
            const orderData = JSON.parse(event.body);
            const orders = await readOrders();
            
            // Генерируем ID если его нет
            if (!orderData.id) {
                orderData.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            }
            
            orderData.createdAt = new Date().toISOString();
            orderData.status = orderData.status || 'pending';
            
            orders.push(orderData);
            await writeOrders(orders);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    data: orderData,
                    message: 'Order saved successfully' 
                })
            };
        }

        if (event.httpMethod === 'PUT') {
            const { orderId, status } = JSON.parse(event.body);
            const orders = await readOrders();
            
            const orderIndex = orders.findIndex(o => o.id === orderId);
            if (orderIndex === -1) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Order not found' })
                };
            }
            
            orders[orderIndex].status = status;
            orders[orderIndex].updatedAt = new Date().toISOString();
            
            await writeOrders(orders);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    data: orders[orderIndex],
                    message: 'Order status updated' 
                })
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Error in orders function:', error);
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