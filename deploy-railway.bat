@echo off
chcp 65001 >nul
echo ========================================
echo    🚀 麻将计分 - 部署到 Railway
echo ========================================
echo.
echo 此脚本将帮助你：
echo 1. 初始化 Git 仓库
echo 2. 提交所有代码
echo 3. 推送到 GitHub
echo.
echo 前提条件：
echo - 已安装 Git
echo - 已注册 GitHub 账号
echo - 已登录 GitHub Desktop 或 Git CLI
echo.
pause

cd /d "%~dp0"

echo.
echo [1/4] 初始化 Git 仓库...
if not exist ".git" (
    git init
    echo ✅ Git 仓库已初始化
) else (
    echo ℹ️ Git 仓库已存在
)

echo.
echo [2/4] 添加所有文件...
git add .
echo ✅ 文件已添加

echo.
echo [3/4] 提交代码...
git commit -m "Deploy to Railway - Mahjong Score Online"
echo ✅ 代码已提交

echo.
echo [4/4] 准备推送...
echo.
echo 接下来请手动执行：
echo.
echo 1. 在 GitHub 创建新仓库：https://github.com/new
echo 2. 仓库名：mahjong-score-online
echo 3. 复制仓库地址（如：https://github.com/你的用户名/mahjong-score-online.git）
echo 4. 运行以下命令：
echo.
echo    git remote add origin https://github.com/你的用户名/mahjong-score-online.git
echo    git push -u origin main
echo.
echo 5. 访问 https://railway.app 部署
echo.
pause

echo.
echo 如需自动推送，请输入你的 GitHub 用户名：
set /p GITHUB_USER=
if "%GITHUB_USER%"=="" (
    echo 未输入用户名，请手动操作
) else (
    echo.
    echo 设置远程仓库...
    git remote add origin https://github.com/%GITHUB_USER%/mahjong-score-online.git 2>nul
    if errorlevel 1 (
        echo ℹ️ 远程仓库已存在，更新地址...
        git remote set-url origin https://github.com/%GITHUB_USER%/mahjong-score-online.git
    )
    
    echo.
    echo 推送到 GitHub...
    git push -u origin main
    
    if errorlevel 1 (
        echo.
        echo ❌ 推送失败，请检查：
        echo - 是否已创建 GitHub 仓库
        echo - 是否正确配置 Git 凭证
        echo.
    ) else (
        echo.
        echo ✅ 推送成功！
        echo.
        echo 接下来：
        echo 1. 访问 https://railway.app
        echo 2. 登录 → New Project → Deploy from GitHub
        echo 3. 选择 mahjong-score-online 仓库
        echo 4. 点击 Deploy
        echo.
    )
)

echo.
pause