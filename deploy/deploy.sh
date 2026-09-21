#!/usr/bin/env bash
set -euo pipefail
cd /home/ubuntu/ataraxia-next

echo "[1/5] backup nginx ataraxia"
sudo cp /etc/nginx/sites-available/ataraxia /etc/nginx/sites-available/ataraxia.bak.$(date +%Y%m%d_%H%M%S)

echo "[2/5] install nginx conf (add /api/ proxy)"
sudo cp deploy/nginx-ataraxia.conf /etc/nginx/sites-available/ataraxia

echo "[3/5] install systemd unit ataraxia-auth"
sudo cp deploy/ataraxia-auth.service /etc/systemd/system/ataraxia-auth.service
sudo systemctl daemon-reload
sudo systemctl enable ataraxia-auth

echo "[4/5] nginx test + reload"
sudo nginx -t
sudo systemctl reload nginx || sudo systemctl restart nginx

echo "[5/5] start ataraxia-auth"
sudo systemctl restart ataraxia-auth
sleep 1
sudo systemctl --no-pager -l status ataraxia-auth | head -8

echo "DONE"