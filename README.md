# Фитнес-портал «Сила и энергия» (XAMPP)

Стек: HTML + CSS + JavaScript, PHP 8.1+ (PDO), MySQL/MariaDB.

## Как запустить
1. Установите XAMPP и в XAMPP Control Panel запустите **Apache** и **MySQL**.
2. Скопируйте папку `fitness` в `C:\xampp\htdocs\` (получится `C:\xampp\htdocs\fitness`).
3. Откройте http://localhost/phpmyadmin → вкладка **Импорт** → выберите `database.sql` → **Вперёд**.
   База `fitness` создаётся автоматически.
4. Откройте http://localhost/fitness/ — сайт готов.

Подключение к БД: `server/config.php` (по умолчанию `root` без пароля, как в XAMPP).

## Вход
- Администратор: `Coach2027` / `Fitness88`
- Обычного пользователя создайте на странице регистрации.

## Структура
```
fitness/
├── database.sql        скрипт БД (задания 1 и 3)
├── er-diagram.png      ER-диаграмма (в phpMyAdmin можно построить свою: Дизайнер)
├── server/             api.php (маршруты), validation.php, config.php
└── public/             6 страниц, css/, js/, images/
```

## Что где реализовано
- Валидация: `public/js/validation.js` (браузер) и `server/validation.php` (сервер).
- Пароли — `password_hash` (bcrypt); логин уникален на уровне БД (`UNIQUE`).
- Отзыв: сервер проверяет, что заявка принадлежит пользователю и в статусе «Завершено»; повторный отзыв блокирует `UNIQUE`.
- Фильтр админки — SQL `WHERE status_id = ?`; доступ к админке проверяется на сервере.
- Каталог главной строится из таблицы `workouts`.
- Шрифты Inter и Oswald подключаются с Google Fonts; без интернета работают запасные шрифты.
