const fs = require('fs').promises;
const path = require('path');

// Путь к файлу с товарами
const PRODUCTS_FILE = path.join(process.cwd(), 'data', 'products.json');

// Создаем директорию если её нет
async function ensureDataDirectory() {
    const dataDir = path.join(process.cwd(), 'data');
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }
}

// Дефолтные товары
const defaultProducts = [
    {
        id: 1,
        name: "Бронежилет 'Штурмовик'",
        description: "Тяжелый бронежилет с защитой 5 класса",
        price: 1250.50,
        category: "armor",
        image: "https://images.unsplash.com/photo-1588347818030-f6cf3ddf9c6f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
        features: ["Защита 5 класса", "10 слотов для встроек", "Устойчивость к пулям"]
    },
    // ... остальные дефолтные товары из вашего кода
];

// Чтение товаров
async function readProducts() {
    try {
        await ensureDataDirectory();
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Если файла нет, создаем с дефолтными товарами
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(defaultProducts, null, 2));
        return defaultProducts;
    }
}

// Запись товаров
async function writeProducts(products) {
    await ensureDataDirectory();
    await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}

// Обработчик функции
exports.handler = async function(event, context) {
    // Настройка CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Обработка preflight запросов
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        if (event.httpMethod === 'GET') {
            const products = await readProducts();
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, data: products })
            };
        }

        if (event.httpMethod === 'POST') {
            const { products } = JSON.parse(event.body);
            await writeProducts(products);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'Products saved successfully' })
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Error in products function:', error);
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