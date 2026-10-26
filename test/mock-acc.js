/* Chỉ dùng khi chạy thử trên máy (test/server.js phục vụ file này tại /acc.js).
   Giả lập window.MACC của acc.js nhưng nối vào Firebase Emulator. */
(function () {
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  window.QZ_EMU = { auth: 'http://127.0.0.1:9099', db: ['127.0.0.1', 9000] };
  var P = Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]).then(async function (m) {
    var AP = m[0], A = m[1], F = m[2];
    var app = AP.initializeApp({ apiKey: 'fake-key', authDomain: 'minto-english.firebaseapp.com', projectId: 'minto-english', appId: '1:1:web:1' });
    var auth = A.getAuth(app); A.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    var db = F.getFirestore(app); F.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    await auth.authStateReady();
    var who = localStorage.getItem('mock.login');
    if (who && !auth.currentUser) await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(JSON.stringify({ sub: 'g-' + who.replace(/\W/g, ''), email: who, email_verified: true, name: 'Thầy Test' })));
    return { A: A, F: F, auth: auth, app: app, db: db };
  });
  window.MACC = {
    ready: function () { return P; }, load: function () { return P; },
    user: function () { return null; },
    quick: function () {},
    fs: function () { return P.then(function (x) { return { F: x.F, db: x.db, user: x.auth.currentUser }; }); }
  };
  P.then(function (x) { window.MACC.user = function () { return x.auth.currentUser; }; });
})();
