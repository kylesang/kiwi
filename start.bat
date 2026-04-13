@echo off
chcp 65001 >nul
echo ========================================
echo    🀄 麻将计分 - 在线多人版
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] 检查并安装依赖...
if not exist "node_modules" (
    echo 正在安装依赖，请稍候...
    call npm install
    if errorlevel 1 (
        echo.
        echo ❌ 依赖安装失败！
        pause
        exit /b 1
    )
) else (
    echo ✅ 依赖已安装
)

echo.
echo [2/2] 启动服务器...
echo.
echo 🌐 服务地址：http://localhost:3003
echo 📱 手机访问：http://你的IP:3003
echo.
echo 按 Ctrl+C 停止服务
echo ========================================
echo.

call npm start

pause