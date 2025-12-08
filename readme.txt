divers-store/
├── index.html           # Главный файл (ваш код)
├── netlify.toml         # Конфигурация Netlify
├── netlify/
│   └── functions/
│       ├── orders.js    # API для заказов
│       ├── products.js  # API для товаров
│       ├── telegram.js  # API для Telegram
│       └── admin.js     # API для админки
├── data/
│   ├── products.json    # База товаров
│   ├── orders.json      # База заказов
│   ├── settings.json    # Настройки
│   └── notifications.json # Лог уведомлений
└── README.md            # Инструкция


# DiverS Store - Магазин игровых предметов TimeZero

## Развертывание на Netlify

### Шаг 1: Подготовка файлов

1. Создайте новую папку на компьютере
2. Скопируйте все файлы из этой структуры в папку:
   - `index.html` (ваш основной файл с изменениями)
   - `netlify.toml`
   - Папку `netlify/functions/` с 4 файлами
   - Папку `data/` (будет создана автоматически)
   - `package.json`

### Шаг 2: Установка зависимостей

1. Установите Node.js (если еще не установлен)
2. В терминале в папке проекта выполните:
   ```bash
   npm install