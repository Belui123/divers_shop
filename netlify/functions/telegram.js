const fs = require('fs').promises;
const path = require('path');

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json');
const NOTIFICATIONS_FILE = path.join(process.cwd(), 'data', 'notifications.json');

async function ensureDataDirectory() {
    const dataDir = path.join(process.cwd(), 'data');
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }
}

async function readSettings() {
    try {
        await ensureDataDirectory();
        const data = await fs.readFile(SETTINGS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Дефолтные настройки
        const defaultSettings = {
            telegram: {
                botToken: '',
                sellers: [],
                notificationTemplate: `🛒 <b>НОВЫЙ ЗАКАЗ #{order_id}</b>

👤 <b>Покупатель:</b> {nickname}

📦 <b>Состав заказа:</b>
{order_items}

💰 <b>Итого:</b> {total_price} монет

🕐 <b>Время заказа:</b> {order_time}
📋 <b>Статус:</b> ⏳ Ожидает обработки

━━━━━━━━━━━━━━━━━━━━
<i>Используйте кнопки ниже для изменения статуса</i>`
            },
            admin: {
                username: 'admin',
                password: 'admin123'
            }
        };
        
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
        return defaultSettings;
    }
}

async function writeSettings(settings) {
    await ensureDataDirectory();
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

async function addNotificationLog(message, type = 'info') {
    try {
        await ensureDataDirectory();
        let logs = [];
        
        try {
            const data = await fs.readFile(NOTIFICATIONS_FILE, 'utf8');
            logs = JSON.parse(data);
        } catch {
            logs = [];
        }
        
        const logEntry = {
            message,
            type,
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleString('ru-RU')
        };
        
        logs.push(logEntry);
        
        // Храним только последние 100 записей
        if (logs.length > 100) {
            logs = logs.slice(-100);
        }
        
        await fs.writeFile(NOTIFICATIONS_FILE, JSON.stringify(logs, null, 2));
    } catch (error) {
        console.error('Error writing notification log:', error);
    }
}

// Функция отправки в Telegram
async function sendTelegramMessage(botToken, chatId, message, keyboard = null) {
    try {
        const payload = {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            disable_notification: false
        };
        
        if (keyboard) {
            payload.reply_markup = keyboard;
        }
        
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.ok) {
            await addNotificationLog(`✅ Уведомление отправлено в чат ${chatId}`, 'success');
            return { success: true, messageId: data.result.message_id };
        } else {
            await addNotificationLog(`❌ Ошибка отправки в чат ${chatId}: ${data.description}`, 'error');
            return { success: false, error: data.description };
        }
    } catch (error) {
        await addNotificationLog(`❌ Ошибка сети при отправке в чат ${chatId}: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
        const settings = await readSettings();

        if (event.httpMethod === 'GET') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    data: settings.telegram || {} 
                })
            };
        }

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            
            if (body.action === 'saveSettings') {
                settings.telegram = body.settings;
                await writeSettings(settings);
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ 
                        success: true, 
                        message: 'Settings saved successfully' 
                    })
                };
            }
            
            if (body.action === 'sendNotification') {
                const { order } = body;
                
                if (!settings.telegram.botToken || settings.telegram.sellers.length === 0) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ 
                            success: false, 
                            error: 'Telegram bot not configured or no sellers added' 
                        })
                    };
                }
                
                // Форматируем сообщение
                const orderItems = order.items.map(item => 
                    `• ${item.name} × ${item.quantity} = ${item.total} монет`
                ).join('\n');
                
                let message = settings.telegram.notificationTemplate
                    .replace(/{nickname}/g, order.nickname)
                    .replace(/{order_items}/g, orderItems)
                    .replace(/{total_price}/g, order.totalPrice)
                    .replace(/{order_time}/g, order.time)
                    .replace(/{order_id}/g, order.id);
                
                // Отправляем каждому продавцу
                const results = [];
                for (const seller of settings.telegram.sellers) {
                    if (!seller.chatId || !seller.notificationsEnabled) continue;
                    
                    const keyboard = seller.role === 'admin' ? {
                        inline_keyboard: [
                            [
                                { text: "✅ Выдан", callback_data: `completed_${order.id}` },
                                { text: "❌ Отменен", callback_data: `cancelled_${order.id}` }
                            ]
                        ]
                    } : null;
                    
                    const result = await sendTelegramMessage(
                        settings.telegram.botToken,
                        seller.chatId,
                        message,
                        keyboard
                    );
                    
                    results.push({
                        seller: seller.name,
                        chatId: seller.chatId,
                        success: result.success,
                        error: result.error
                    });
                }
                
                const successfulSends = results.filter(r => r.success).length;
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ 
                        success: successfulSends > 0,
                        results,
                        message: `Notifications sent to ${successfulSends}/${results.length} sellers`
                    })
                };
            }
            
            if (body.action === 'testNotification') {
                const { sellerIndex } = body;
                
                if (sellerIndex === undefined || !settings.telegram.sellers[sellerIndex]) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ 
                            success: false, 
                            error: 'Invalid seller index' 
                        })
                    };
                }
                
                const seller = settings.telegram.sellers[sellerIndex];
                const testOrder = {
                    id: 'TEST-' + Date.now().toString().substr(-6),
                    nickname: 'Тестовый покупатель',
                    items: [{ name: 'Тестовый товар', quantity: 1, total: 100.50 }],
                    totalPrice: 100.50,
                    time: new Date().toLocaleString('ru-RU')
                };
                
                const orderItems = testOrder.items.map(item => 
                    `• ${item.name} × ${item.quantity} = ${item.total} монет`
                ).join('\n');
                
                let message = `🧪 <b>ТЕСТОВОЕ УВЕДОМЛЕНИЕ</b>\n\n`;
                message += `Это тестовое сообщение для проверки работы бота\n\n`;
                message += `🛒 <b>Тестовый заказ #{order_id}</b>\n\n`;
                message += `👤 <b>Покупатель:</b> {nickname}\n\n`;
                message += `📦 <b>Состав заказа:</b>\n{order_items}\n\n`;
                message += `💰 <b>Итого:</b> {total_price} монет\n\n`;
                message += `🕐 <b>Время заказа:</b> {order_time}\n`;
                message += `📋 <b>Статус:</b> 🧪 Тестовый заказ`;
                
                message = message
                    .replace(/{nickname}/g, testOrder.nickname)
                    .replace(/{order_items}/g, orderItems)
                    .replace(/{total_price}/g, testOrder.totalPrice)
                    .replace(/{order_time}/g, testOrder.time)
                    .replace(/{order_id}/g, testOrder.id);
                
                const result = await sendTelegramMessage(
                    settings.telegram.botToken,
                    seller.chatId,
                    message,
                    seller.role === 'admin' ? {
                        inline_keyboard: [[{ text: "✅ Тест пройден", callback_data: "test_completed" }]]
                    } : null
                );
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ 
                        success: result.success,
                        error: result.error,
                        message: result.success ? 
                            `Test notification sent to ${seller.name}` : 
                            `Failed to send test: ${result.error}`
                    })
                };
            }
            
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Invalid action' })
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Error in telegram function:', error);
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