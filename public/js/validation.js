// Правила совпадают с server/validation.php
const RULES = {
  login:     { re: /^[A-Za-z0-9]{6,}$/, msg: 'Латиница и цифры, не менее 6 символов' },
  password:  { re: /^.{8,}$/, msg: 'Не менее 8 символов' },
  full_name: { re: /^[А-Яа-яЁё\s]+$/, msg: 'Только кириллица и пробелы' },
  phone:     { re: /^8\(\d{3}\)\d{3}-\d{2}-\d{2}$/, msg: 'Формат 8(XXX)XXX-XX-XX' },
  email:     { re: /^[^@\s]+@[^@\s]+\.[^@\s]+$/, msg: 'Формат ivan@mail.ru' },
};

function validateField(name, value) {
  if (!value.trim()) return 'Заполните поле';
  const rule = RULES[name];
  return rule && !rule.re.test(name === 'password' ? value : value.trim()) ? rule.msg : '';
}

// Показывает ошибку под полем (без alert)
function setFieldError(form, name, message) {
  const field = form.elements[name];
  const box = form.querySelector('[data-error-for="' + name + '"]');
  if (!field || !box) return;
  field.classList.toggle('field--error', Boolean(message));
  field.setAttribute('aria-invalid', message ? 'true' : 'false');
  box.textContent = message || '';
}

function clearErrors(form) {
  [...form.elements].forEach((el) => el.name && setFieldError(form, el.name, ''));
}
