<?php
// Правила повторяют public/js/validation.js: проверка на сервере защищает от обхода формы.
function validate_registration(array $d): array {
    $rules = [
        'login'     => ['/^[A-Za-z0-9]{6,}$/', 'Латиница и цифры, не менее 6 символов'],
        'password'  => ['/^.{8,}$/u', 'Не менее 8 символов'],
        'full_name' => ['/^[А-Яа-яЁё\s]+$/u', 'Только кириллица и пробелы'],
        'phone'     => ['/^8\(\d{3}\)\d{3}-\d{2}-\d{2}$/', 'Формат 8(XXX)XXX-XX-XX'],
        'email'     => ['/^[^@\s]+@[^@\s]+\.[^@\s]+$/', 'Формат ivan@mail.ru'],
    ];
    $errors = [];
    foreach ($rules as $field => [$re, $msg]) {
        $v = trim((string)($d[$field] ?? ''));
        if ($v === '') $errors[$field] = 'Заполните поле';
        elseif (!preg_match($re, $field === 'password' ? (string)$d[$field] : $v)) $errors[$field] = $msg;
    }
    return $errors;
}
