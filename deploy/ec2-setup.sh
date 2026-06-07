#!/bin/bash
# ThalNet EC2 Setup Script — run this after SSH into your EC2 instance
# Usage: bash deploy/ec2-setup.sh
set -e

PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

echo "=== ThalNet EC2 Deploy ==="
echo "Public IP: $PUBLIC_IP"

# 1. System packages
echo "[1/6] Installing system packages..."
sudo yum update -y -q
sudo yum install -y -q git python3.11 python3.11-pip nodejs npm

# 2. Clone repo
echo "[2/6] Cloning repo..."
cd /home/ec2-user
if [ -d "Distortion" ]; then
    cd Distortion && git pull origin main
else
    git clone https://github.com/swaroop2005/Distortion.git
    cd Distortion
fi

# 3. Python deps
echo "[3/6] Installing Python dependencies..."
python3.11 -m pip install --user -q "fastapi>=0.104" "uvicorn[standard]" mangum pydantic pandas joblib scikit-learn boto3

# 4. Build frontend (point API calls to backend on same host, port 8000)
echo "[4/6] Building frontend..."
cd frontend
npm install --silent
VITE_API_URL="http://${PUBLIC_IP}:8000" npx vite build
cd ..

# 5. Start backend (serves API on port 8000)
echo "[5/6] Starting backend..."
nohup python3.11 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 > /tmp/thalnet-backend.log 2>&1 &
echo "Backend PID: $!"

# 6. Serve frontend on port 80
echo "[6/6] Serving frontend on port 80..."
sudo npm install -g serve
nohup sudo serve -s frontend/dist -l 80 > /tmp/thalnet-frontend.log 2>&1 &
echo "Frontend PID: $!"

echo ""
echo "========================================="
echo "  ThalNet LIVE!"
echo "========================================="
echo "  Frontend: http://${PUBLIC_IP}"
echo "  Backend:  http://${PUBLIC_IP}:8000"
echo "  API docs: http://${PUBLIC_IP}:8000/docs"
echo "========================================="
echo ""
echo "Logs: tail -f /tmp/thalnet-backend.log"
echo "      tail -f /tmp/thalnet-frontend.log"
echo ""
echo "To redeploy: git pull && bash deploy/ec2-setup.sh"
