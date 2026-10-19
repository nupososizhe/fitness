<?php
// Единая точка входа: api.php?action=...  Ответ всегда JSON.
require __DIR__ . '/config.php';
require __DIR__ . '/validation.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

function out($data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function input(): array {
    $j = json_decode(file_get_contents('php://input'), true);
    return is_array($j) ? $j : [];
}
function need_user(): array {
    if (empty($_SESSION['user'])) out(['error' => 'Войдите в аккаунт'], 401);
    return $_SESSION['user'];
}
function need_admin(): array {
    $u = need_user();
    if (!$u['is_admin']) out(['error' => 'Нет доступа'], 403);
    return $u;
}

function row_exists(PDO $pdo, string $table, int $id): bool {
    // имя таблицы подставляется только из кода выше, не из запроса
    $q = $pdo->prepare("SELECT 1 FROM $table WHERE id = ?");
    $q->execute([$id]);
    return (bool)$q->fetch();
}

const APP_SELECT = 'SELECT a.id, a.desired_date, a.created_at, a.status_id, s.title AS status,
        w.title AS workout, p.title AS payment, u.full_name, u.login,
        r.rating, r.comment
    FROM applications a
    JOIN users u ON u.id = a.user_id
    JOIN workouts w ON w.id = a.workout_id
    JOIN payment_methods p ON p.id = a.payment_id
    JOIN statuses s ON s.id = a.status_id
    LEFT JOIN reviews r ON r.application_id = a.id';

try {
    $action = $_GET['action'] ?? '';
    $pdo = db();

    switch ($action) {
        case 'catalog': // карточки главной и списки для формы заявки
            out([
                'workouts' => $pdo->query('SELECT id, title, image_path FROM workouts ORDER BY id')->fetchAll(),
                'payments' => $pdo->query('SELECT id, title FROM payment_methods ORDER BY id')->fetchAll(),
                'statuses' => $pdo->query('SELECT id, title FROM statuses ORDER BY id')->fetchAll(),
            ]);

        case 'me':
            out(['user' => $_SESSION['user'] ?? null]);

        case 'register':
            $d = input();
            $errors = validate_registration($d);
            if (!isset($errors['login'])) {
                $q = $pdo->prepare('SELECT 1 FROM users WHERE login = ?');
                $q->execute([trim($d['login'])]);
                if ($q->fetch()) $errors['login'] = 'Такой логин уже занят';
            }
            if ($errors) out(['errors' => $errors], 422);
            try {
                $pdo->prepare('INSERT INTO users (login, password_hash, full_name, phone, email) VALUES (?,?,?,?,?)')
                    ->execute([trim($d['login']), password_hash($d['password'], PASSWORD_BCRYPT),
                               trim($d['full_name']), trim($d['phone']), trim($d['email'])]);
            } catch (PDOException $e) { // гонка: UNIQUE в БД сработал раньше проверки
                if ($e->errorInfo[1] == 1062) out(['errors' => ['login' => 'Такой логин уже занят']], 422);
                throw $e;
            }
            out(['ok' => true], 201);

        case 'login':
            $d = input();
            $q = $pdo->prepare('SELECT * FROM users WHERE login = ?');
            $q->execute([trim((string)($d['login'] ?? ''))]);
            $u = $q->fetch();
            if (!$u || !password_verify((string)($d['password'] ?? ''), $u['password_hash']))
                out(['error' => 'Неверный логин или пароль'], 401);
            session_regenerate_id(true);
            $_SESSION['user'] = ['id' => (int)$u['id'], 'login' => $u['login'],
                                 'full_name' => $u['full_name'], 'is_admin' => (int)$u['is_admin']];
            out(['user' => $_SESSION['user']]);

        case 'logout':
            $_SESSION = [];
            session_destroy();
            out(['ok' => true]);

        case 'apply':
            $u = need_user();
            $d = input();
            $errors = [];
            $w = (int)($d['workout_id'] ?? 0);
            $p = (int)($d['payment_id'] ?? 0);
            $date = (string)($d['desired_date'] ?? '');
            if (!row_exists($pdo, 'workouts', $w)) $errors['workout_id'] = 'Выберите направление';
            if (!row_exists($pdo, 'payment_methods', $p)) $errors['payment_id'] = 'Выберите способ оплаты';
            $dt = DateTime::createFromFormat('Y-m-d', $date);
            if (!$dt || $dt->format('Y-m-d') !== $date) $errors['desired_date'] = 'Укажите дату';
            elseif ($date < date('Y-m-d')) $errors['desired_date'] = 'Дата не может быть в прошлом';
            if ($errors) out(['errors' => $errors], 422);
            // status_id не передаём: по умолчанию «Новая»
            $pdo->prepare('INSERT INTO applications (user_id, workout_id, payment_id, desired_date) VALUES (?,?,?,?)')
                ->execute([$u['id'], $w, $p, $date]);
            out(['ok' => true], 201);

        case 'my_applications':
            $u = need_user();
            $q = $pdo->prepare(APP_SELECT . ' WHERE a.user_id = ? ORDER BY a.id DESC');
            $q->execute([$u['id']]);
            out(['applications' => $q->fetchAll()]);

        case 'admin_applications': // фильтр — это запрос к БД, а не скрытие карточек
            need_admin();
            $status = (int)($_GET['status_id'] ?? 0);
            if ($status > 0) {
                $q = $pdo->prepare(APP_SELECT . ' WHERE a.status_id = ? ORDER BY a.id DESC');
                $q->execute([$status]);
            } else {
                $q = $pdo->query(APP_SELECT . ' ORDER BY a.id DESC');
            }
            out(['applications' => $q->fetchAll()]);

        case 'set_status':
            need_admin();
            $d = input();
            $id = (int)($d['id'] ?? 0);
            $st = (int)($d['status_id'] ?? 0);
            $q = $pdo->prepare('SELECT 1 FROM statuses WHERE id = ?');
            $q->execute([$st]);
            if (!$q->fetch()) out(['error' => 'Неизвестный статус'], 422);
            $q = $pdo->prepare('UPDATE applications SET status_id = ? WHERE id = ?');
            $q->execute([$st, $id]);
            out(['ok' => true]);

        case 'review':
            $u = need_user();
            $d = input();
            $appId = (int)($d['application_id'] ?? 0);
            $rating = (int)($d['rating'] ?? 0);
            $comment = trim((string)($d['comment'] ?? ''));
            $errors = [];
            if ($rating < 1 || $rating > 5) $errors['rating'] = 'Поставьте оценку от 1 до 5';
            if ($comment === '') $errors['comment'] = 'Напишите комментарий';
            if ($errors) out(['errors' => $errors], 422);
            // заявка должна принадлежать пользователю и быть «Завершено» (id = 3)
            $q = $pdo->prepare('SELECT a.status_id, s.title FROM applications a
                JOIN statuses s ON s.id = a.status_id WHERE a.id = ? AND a.user_id = ?');
            $q->execute([$appId, $u['id']]);
            $a = $q->fetch();
            if (!$a) out(['error' => 'Заявка не найдена'], 404);
            if ($a['title'] !== 'Завершено') out(['error' => 'Отзыв можно оставить только после завершения заявки'], 403);
            try {
                $pdo->prepare('INSERT INTO reviews (application_id, rating, comment) VALUES (?,?,?)')
                    ->execute([$appId, $rating, $comment]);
            } catch (PDOException $e) {
                if ($e->errorInfo[1] == 1062) out(['error' => 'Отзыв на эту заявку уже оставлен'], 409);
                throw $e;
            }
            out(['ok' => true], 201);

        default:
            out(['error' => 'Неизвестное действие'], 404);
    }
} catch (PDOException $e) {
    out(['error' => 'Ошибка базы данных. Проверьте, что MySQL запущен и database.sql импортирован.'], 500);
}
