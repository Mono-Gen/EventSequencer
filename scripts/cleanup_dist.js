const fs = require('fs');
const path = require('path');

// ビルド済みのステージングディレクトリを対象にする
const targetDir = path.join(process.cwd(), 'dist_staging');
const projectRoot = process.cwd();

// バックスラッシュとスラッシュの両方のパターンを作成
const patterns = [
    projectRoot.replace(/\\/g, '\\\\'), // Windows path escaped for JSON/JS strings
    projectRoot.replace(/\\/g, '/')     // Unix-style path
];

function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
            walk(fullPath);
        } else if (stats.isFile()) {
            const ext = path.extname(fullPath).toLowerCase();
            // テキストベースのファイルのみ対象
            if (['.js', '.json', '.html', '.css', '.map', '.txt', '.mjs', '.cjs'].includes(ext)) {
                let content = fs.readFileSync(fullPath, 'utf8');
                let modified = false;

                patterns.forEach(pattern => {
                    const regex = new RegExp(pattern.replace(/\\/g, '\\\\'), 'gi');
                    if (regex.test(content)) {
                        content = content.replace(regex, '.');
                        modified = true;
                    }
                });

                if (modified) {
                    console.log(`[Cleanup] Removed absolute paths from: ${path.relative(targetDir, fullPath)}`);
                    fs.writeFileSync(fullPath, content, 'utf8');
                }
            }
        }
    }
}

console.log(`[Cleanup] Starting privacy scan in: ${targetDir}`);
walk(targetDir);
console.log('[Cleanup] Done.');
