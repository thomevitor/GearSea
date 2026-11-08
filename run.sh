#!/usr/bin/env bash
# Sobe o GEARSEA — Setor 7 no navegador.
set -euo pipefail

cd "$(dirname "$0")"
PORT=4173

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js não encontrado."
  if command -v pacman >/dev/null 2>&1; then
    echo "Instalando nodejs..."
    sudo pacman -S --needed --noconfirm nodejs
  else
    echo "Instale o Node.js e rode este script de novo."
    exit 1
  fi
fi

if curl -sf -o /dev/null "http://127.0.0.1:${PORT}/"; then
  echo "O jogo já está no ar: http://localhost:${PORT}"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:${PORT}" >/dev/null 2>&1 || true
  fi
  exit 0
fi

echo "GEARSEA — http://localhost:${PORT}"
if command -v xdg-open >/dev/null 2>&1; then
  (sleep 0.4 && xdg-open "http://localhost:${PORT}" >/dev/null 2>&1) &
fi

exec node serve.mjs
