-- Фитнес-портал «Сила и энергия» · MySQL / MariaDB (XAMPP)
-- Импорт: phpMyAdmin → Импорт → выбрать этот файл (база создаётся сама)

DROP DATABASE IF EXISTS fitness;
CREATE DATABASE fitness CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fitness;

-- ===== Задание 1 =====
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  login VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  is_admin TINYINT(1) NOT NULL DEFAULT 0
);

CREATE TABLE workouts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(100) NOT NULL UNIQUE,
  image_path VARCHAR(255) NOT NULL
);

CREATE TABLE payment_methods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(60) NOT NULL
);

CREATE TABLE statuses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(40) NOT NULL
);

CREATE TABLE applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  workout_id INT NOT NULL,
  payment_id INT NOT NULL,
  status_id INT NOT NULL DEFAULT 1, -- 1 = «Новая»
  desired_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (workout_id) REFERENCES workouts(id),
  FOREIGN KEY (payment_id) REFERENCES payment_methods(id),
  FOREIGN KEY (status_id) REFERENCES statuses(id)
);

INSERT INTO statuses (title) VALUES ('Новая'),('Запись подтверждена'),('Завершено');
INSERT INTO payment_methods (title) VALUES ('Наличными при посещении'),('Перевод по СБП');
INSERT INTO workouts (title, image_path) VALUES
  ('Тренировки','training.png'), ('Кардиозона','cardio.png'),
  ('Силовые тренажёры','strength.png'), ('Фитнес и растяжка','fitness.png'),
  ('Раздевалка','locker.png');

-- Администратор: Coach2027 / Fitness88 (пароль хранится bcrypt-хэшем)
INSERT INTO users (login, password_hash, full_name, phone, email, is_admin) VALUES
  ('Coach2027', '$2y$12$54tekoGZDHtuaryJ57cAsezht6H873rRVwIk0CGQfPsjce24Qt9JO',
   'Администратор Тренер', '8(900)000-00-00', 'coach@fitness.local', 1);

-- ===== Задание 3 =====
CREATE TABLE reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL UNIQUE, -- не более одного отзыва на заявку
  rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id)
);
