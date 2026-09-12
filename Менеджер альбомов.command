#!/bin/zsh
# Запуск из папки файла; работает и после переноса проекта.
cd -- "${0:A:h}" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "Нужен Node.js" message "Установите Node.js LTS с nodejs.org, затем откройте менеджер снова."'
  exit 1
fi
if ! node -e 'require("sharp")' >/dev/null 2>&1; then
  echo 'Подготавливаю менеджер. Это нужно только при первом запуске…'
  npm ci || { read '?Не удалось установить зависимости. Нажмите Enter.'; exit 1; }
fi
node album-manager/launch.mjs "$@"
if [[ $? -ne 0 ]]; then
  read '?Не удалось запустить менеджер. Нажмите Enter.'
fi
