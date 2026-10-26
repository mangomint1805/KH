// Ghép đoạn luật quiz vào bộ luật đầy đủ (giống cấu trúc đang chạy: chặn mọi nhánh lạ) để chạy Emulator.
const fs = require('fs'), path = require('path');
fs.mkdirSync(path.join(__dirname, 'emu'), { recursive: true });
const quiz = JSON.parse(fs.readFileSync(path.join(__dirname, '../firebase/database.rules.quiz.json'), 'utf8'));
const out = { rules: Object.assign({}, quiz, { '$other': { '.validate': false } }) };
fs.writeFileSync(path.join(__dirname, 'emu/database.rules.json'), JSON.stringify(out, null, 2));
const fsr = fs.readFileSync(path.join(__dirname, '../firebase/firestore.rules.quiz.txt'), 'utf8');
fs.writeFileSync(path.join(__dirname, 'emu/firestore.rules'), "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n" + fsr + "  }\n}\n");

// Đoạn để thầy dán vào Firebase Console (nằm ngay sau dòng "rules": {)
const body = JSON.stringify(quiz, null, 2).split('\n').slice(1, -1).map((l) => '  ' + l).join('\n');
fs.writeFileSync(path.join(__dirname, '../firebase/dan-vao-rtdb.txt'), body + ',\n');
