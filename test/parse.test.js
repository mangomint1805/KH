// Kiểm tra bộ đọc câu hỏi: node test/parse.test.js
const assert = require('assert');
const QP = require('../js/parse.js');

// Bảng theo mẫu Kahoot (giống file Excel thật: tiêu đề hàng 8, dữ liệu từ hàng 9)
const rows = [[], ['', 'Quiz template'], ['', 'Unit 1'], [], [], [], [],
  ['', 'Question - max 120 characters', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Time limit', 'Correct answer(s)'],
  [1, 'Emily introduced ____ before beginning the job interview.', 'she', 'herself', 'hers', 'her', 30, 2],
  [2, 'Pick two', 'a', 'b', 'c', '', 25, '1,3'],
  [3, 'No key', 'x', 'y', '', '', '', '']];
let r = QP.fromRows(rows);
assert.strictEqual(r.title, 'Unit 1');
assert.strictEqual(r.qs.length, 3);
assert.deepStrictEqual(r.qs[0].c, [1]);
assert.deepStrictEqual(r.qs[1].c, [0, 2]);
assert.strictEqual(r.qs[1].time, 20); // 25 giây làm tròn về mức gần nhất Kahoot cho phép
assert.strictEqual(r.qs[0].row, 9);
assert.ok(QP.check(r.qs[2]).err.includes('Chưa chọn đáp án đúng'));
assert.strictEqual(QP.check(r.qs[0]).err.length, 0);

// CSV có và không có tiêu đề, dấu ; và ô có ngoặc kép
r = QP.fromRows(QP.parseCSV('Question,A1,A2,A3,A4,Time,Correct\n"Hello, ""you""?",a,b,c,d,30,4\n'));
assert.strictEqual(r.qs[0].t, 'Hello, "you"?'); assert.deepStrictEqual(r.qs[0].c, [3]);
r = QP.fromRows(QP.parseCSV('1;Q one?;a;b;c;d;10;B\n2;Q two?;a;b;c;d;10;1\n'));
assert.strictEqual(r.qs.length, 2); assert.deepStrictEqual(r.qs[0].c, [1]);

// Văn bản dạng đề
r = QP.fromText(`1. Emily introduced ____ before beginning the job interview.
(A) she  (B) herself  (C) hers  (D) her
Answer: B

2) There is a higher demand for ____ fruit.
A. exotic
B. cater
C. patron
D. culinary
Đáp án: A
Câu 3: Mr. A. Smith asked ____ to leave.
(A) x (B) y
(C) z (D) w
Correct answer: (C)
4. No answer line (A) p (B) q (C) r (D) s

Answer key
4-D`);
assert.strictEqual(r.qs.length, 4);
assert.deepStrictEqual(r.qs.map((q) => q.c[0]), [1, 0, 2, 3]);
assert.strictEqual(r.qs[2].t, 'Mr. A. Smith asked ____ to leave.');
assert.deepStrictEqual(r.qs[1].o, ['exotic', 'cater', 'patron', 'culinary']);
assert.strictEqual(QP.fromText('xin chao').qs.length, 0);

// Đề nhiều phần, mỗi phần đánh số lại và có bảng đáp án riêng; đoạn văn dẫn không dính vào đáp án D
r = QP.fromText('1. Q one\n(A) a (B) b (C) c (D) d\n2. Q two\n(A) a (B) b (C) c (D) d\nĐáp án\n1B 2C\n' +
  '1. P2 one\n(A) w (B) x (C) y (D) z\nQuestions 2-3 refer to the following notice.\nThe store will be closed on Monday.\n' +
  '2. P2 two\n(A) w (B) x (C) y (D) z\n3. A man is standing by the door.\n(A) w (B) x (C) y (D) z\nĐáp án\n1A 2D 3B\n');
assert.deepStrictEqual(r.qs.map((q) => q.c[0]), [1, 2, 0, 3, 1]);
assert.strictEqual(r.qs[2].o[3], 'z');
assert.strictEqual(r.qs[4].t, 'A man is standing by the door.');
// đoạn văn dẫn có số câu ("Questions 2-3 refer to…") giờ thành nhóm câu, giữ đoạn văn
assert.strictEqual(r.skipped, 0);
assert.ok(r.qs[3].g && r.qs[3].g === r.qs[4].g && !r.qs[2].g);
assert.deepStrictEqual(r.groups[r.qs[3].g], { p: 'The store will be closed on Monday.', no: 2 });
// quá 1000 / 500 ký tự: chặn lưu (Firebase không nhận)
assert.ok(QP.check({ t: 'x'.repeat(1001), o: ['a', 'b', '', ''], c: [0] }).err.length === 1);
assert.ok(QP.check({ t: 'x', o: ['a'.repeat(501), 'b', '', ''], c: [1] }).err.length === 1);

// Xuất lại mẫu Kahoot rồi đọc lại phải giống
const back = QP.fromRows(QP.toRows('T', QP.fromRows(rows).qs.slice(0, 2)));
assert.strictEqual(back.qs.length, 2); assert.deepStrictEqual(back.qs[1].c, [0, 2]); assert.strictEqual(back.title, 'T');

// Điểm kiểu Kahoot
const C = { points: (ok, ms, T, m) => (!ok || !m ? 0 : Math.round(1000 * (1 - Math.min(Math.max(ms, 0), T * 1000) / (T * 1000) / 2)) * m) };
assert.strictEqual(C.points(true, 0, 20, 1), 1000);
assert.strictEqual(C.points(true, 20000, 20, 1), 500);
assert.strictEqual(C.points(true, 10000, 20, 2), 1500);
// ---------- 📦 nhóm câu ----------
// File cũ (không có cột nhóm) không có nhóm nào
assert.deepStrictEqual(QP.fromRows(rows).groups, {});
assert.ok(QP.fromRows(rows).qs.every((q) => !q.g));
// Excel có cột I "Nhóm", J "Đoạn văn"; cột A là số câu trên đề
const gRows = [[], ['', 'Quiz template'], ['', 'Part 7'], [], [], [], [],
  ['', 'Question', 'A1', 'A2', 'A3', 'A4', 'Time', 'Correct', 'Nhóm', 'Đoạn văn'],
  [1, 'Normal one', 'a', 'b', 'c', 'd', 20, 1],
  [147, 'What is the email about?', 'a', 'b', 'c', 'd', 30, 2, 'E1', 'Dear Ms. Lee,\nThank you for your order.'],
  [148, 'When will it arrive?', 'a', 'b', 'c', 'd', 30, 3, 'E1', ''],
  [149, 'Who is Ms. Lee?', 'a', 'b', 'c', 'd', 30, 4, 'E1'],
  [150, 'Lone group', 'a', 'b', '', '', 20, 1, 'E2', 'x'],
  [151, 'Again E1 but not next to the others', 'a', 'b', '', '', 20, 1, 'E1'],
  [152, 'Pair', 'a', 'b', '', '', 20, 1, 'E1']];
r = QP.fromRows(gRows);
assert.strictEqual(r.qs.length, 7);
const g1 = r.qs[1].g;
assert.ok(g1 && r.qs[2].g === g1 && r.qs[3].g === g1 && !r.qs[0].g);
assert.deepStrictEqual(r.groups[g1], { p: 'Dear Ms. Lee,\nThank you for your order.', no: 147 });
assert.ok(!r.qs[4].g, 'nhóm chỉ 1 câu thì bỏ nhóm');
assert.ok(r.qs[5].g && r.qs[5].g === r.qs[6].g && r.qs[5].g !== g1, 'cùng tên nhưng không liền nhau là nhóm khác');
assert.strictEqual(Object.keys(r.groups).length, 2);
// CSV không có tiêu đề: 2 cột sau cột đáp án đúng là nhóm, đoạn văn
r = QP.fromRows(QP.parseCSV('32;Where are they?;a;b;c;d;20;1;A;\n33;Who is she?;a;b;c;d;20;2;A;\n34;What next?;a;b;c;d;20;3;A;\n'));
assert.ok(r.qs.every((q) => q.g === r.qs[0].g) && r.qs[0].g);
assert.strictEqual(r.groups[r.qs[0].g].no, 32);
// Xuất ra Excel rồi đọc lại: giữ nhóm, đoạn văn, số câu
r = QP.fromRows(gRows);
const back2 = QP.fromRows(QP.toRows('Part 7', r.qs, r.groups));
assert.deepStrictEqual(back2.qs.map((q) => !!q.g), r.qs.map((q) => !!q.g));
assert.deepStrictEqual(Object.values(back2.groups), Object.values(r.groups));
assert.strictEqual(QP.toRows('T', QP.fromRows(rows).qs)[7].length, 8, 'bộ không có nhóm: xuất đúng mẫu Kahoot 8 cột');
// Văn bản đề Part 7: đoạn văn nhiều dòng thành nhóm
r = QP.fromText('Questions 147-148 refer to the following e-mail.\nTo: Ms. Lee\nYour order has shipped.\n147. Why was the e-mail sent?\n(A) a (B) b (C) c (D) d\n148. What is included?\n(A) a (B) b (C) c (D) d\n149. Single question\n(A) a (B) b\nĐáp án\n147A 148B 149A\n');
assert.strictEqual(r.qs.length, 3);
assert.ok(r.qs[0].g && r.qs[1].g === r.qs[0].g && !r.qs[2].g);
assert.deepStrictEqual(r.groups[r.qs[0].g], { p: 'To: Ms. Lee\nYour order has shipped.', no: 147 });
assert.deepStrictEqual(r.qs.map((q) => q.c[0]), [0, 1, 0]);
// kiểm tra nhóm: tối đa 5 câu, đoạn văn tối đa 6000 ký tự
assert.strictEqual(QP.checkGroup({ p: 'x' }, 3).length, 0);
assert.strictEqual(QP.checkGroup({ p: 'x' }, 6).length, 1);
assert.strictEqual(QP.checkGroup({ p: 'x'.repeat(6001) }, 2).length, 1);

console.log('✔ parse.test.js: tất cả đều qua');
