// ============================================================
// STATE
// ============================================================
var S = {
  currentTopic: null,
  mode: 'flashcard',
  queue: [],
  cur: 0,
  revealed: false,
  scores: {},
  streak: 0,
  rOk: 0, rHard: 0, rWrong: 0,
  currentPt: ''
};

var THEORY = {};

// ============================================================
// INIT
// ============================================================
function init() {
  // Load theme
  var theme = storageThemeLoad();
  if (theme === 'light') {
    document.body.classList.add('light');
    updateThemeBtns(true);
  }

  // Load scores
  S.scores = storageLoad();

  // Load theory from JSON
  fetch('data/theory.json')
    .then(function(r) { return r.json(); })
    .then(function(data) { THEORY = data; })
    .catch(function() { THEORY = {}; });

  renderTopics();
  checkUrlTopic();
}

// ============================================================
// HELPERS
// ============================================================
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(text);
  u.lang = 'pt-BR';
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

function getTopicProgress(topicId) {
  var topic = TOPICS.find(function(t) { return t.id === topicId; });
  if (!topic) return 0;
  var learned = topic.items.filter(function(item) {
    return getScore(S.scores, topicId, item.pt) === 2;
  }).length;
  return Math.round(learned / topic.items.length * 100);
}

function getTotalStats() {
  var totalItems = 0, learnedItems = 0, doneTopic = 0;
  TOPICS.forEach(function(t) {
    totalItems += t.items.length;
    var learned = t.items.filter(function(item) {
      return getScore(S.scores, t.id, item.pt) === 2;
    }).length;
    learnedItems += learned;
    if (learned === t.items.length) doneTopic++;
  });
  return { totalItems: totalItems, learnedItems: learnedItems, doneTopic: doneTopic,
           pct: Math.round(learnedItems / totalItems * 100) };
}

// ============================================================
// TOPIC SCREEN
// ============================================================
function renderTopics() {
  var stats = getTotalStats();
  document.getElementById('overallFill').style.width = stats.pct + '%';
  document.getElementById('overallDone').textContent = stats.doneTopic;
  document.getElementById('overallCards').textContent = stats.learnedItems;
  document.getElementById('overallPct').textContent = stats.pct + '%';

  var grid = document.getElementById('topicsGrid');
  grid.innerHTML = '';
  TOPICS.forEach(function(t) {
    var pct = getTopicProgress(t.id);
    var done = pct === 100;
    var dueCnt = t.items.filter(function(it) { return isDue(S.scores, t.id, it.pt); }).length;

    var badge = done ? '✅' : dueCnt > 0 ? (dueCnt + ' due') : pct > 0 ? (pct + '%') : t.dueDate;
    var badgeStyle = done
      ? 'background:rgba(52,211,153,.15);color:var(--green)'
      : dueCnt > 0
        ? 'background:rgba(251,191,36,.2);color:var(--yellow);font-weight:800'
        : pct > 0
          ? 'background:rgba(99,102,241,.15);color:var(--accent)'
          : 'background:var(--surface2);color:var(--muted)';

    var fillColor = done ? 'var(--green)' : pct > 0 ? 'var(--accent)' : 'var(--surface2)';

    var card = document.createElement('div');
    card.className = 'topic-card' + (done ? ' completed' : '');
    card.onclick = (function(id) { return function() { openTopic(id); }; })(t.id);
    card.innerHTML =
      '<div class="tc-emoji">' + t.emoji + '</div>' +
      '<div class="tc-info">' +
        '<div class="tc-title">' + t.title + '</div>' +
        '<div class="tc-meta">' + t.desc + ' · ' + t.items.length + ' карточек</div>' +
        '<div class="tc-bar"><div class="tc-fill" style="width:' + pct + '%;background:' + fillColor + '"></div></div>' +
      '</div>' +
      '<div class="tc-badge" style="' + badgeStyle + '">' + badge + '</div>';
    grid.appendChild(card);
  });
}

function openTopic(topicId) {
  var topic = TOPICS.find(function(t) { return t.id === topicId; });
  if (!topic) return;
  S.currentTopic = topicId;
  if (!S.scores[topicId]) S.scores[topicId] = {};

  document.getElementById('topicScreen').style.display = 'none';
  var trainer = document.getElementById('trainerScreen');
  trainer.style.display = 'flex';
  var titlePart = topic.title.split('. ');
  document.getElementById('trainerTitle').textContent = topic.emoji + ' ' + (titlePart[1] || topic.title);
  startRound();
}

function goBack() {
  document.getElementById('trainerScreen').style.display = 'none';
  document.getElementById('topicScreen').style.display = 'block';
  renderTopics();
  window.history.pushState({}, '', window.location.pathname);
}

// ============================================================
// ROUND
// ============================================================
function startRound() {
  var topic = TOPICS.find(function(t) { return t.id === S.currentTopic; });
  var all = topic.items.map(function(_, i) { return i; });
  var due = all.filter(function(i) { return isDue(S.scores, S.currentTopic, topic.items[i].pt); });
  S.queue = shuffle(due.length > 0 ? due : all);
  S.cur = 0;
  S.rOk = S.rHard = S.rWrong = 0;
  setMode(S.mode);
}

function setMode(mode) {
  S.mode = mode;
  ['flashcard', 'quiz', 'list', 'theory'].forEach(function(m) {
    var tab = document.getElementById('tab-' + m);
    if (tab) tab.classList.toggle('active', m === mode);
  });
  showModeUI(mode);
  S.cur = 0;
  loadCard();
}

function showModeUI(m) {
  ['modeFlashcard', 'modeQuiz', 'modeList', 'modeTheory', 'modeResults'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  var map = { flashcard: 'modeFlashcard', quiz: 'modeQuiz', list: 'modeList', theory: 'modeTheory', results: 'modeResults' };
  var el = document.getElementById(map[m] || 'modeFlashcard');
  if (el) el.style.display = 'block';
}

function loadCard() {
  if (!S.queue || S.queue.length === 0) {
    var topic = TOPICS.find(function(t) { return t.id === S.currentTopic; });
    if (topic) S.queue = shuffle(topic.items.map(function(_, i) { return i; }));
    S.cur = 0;
  }
  if (S.cur >= S.queue.length) { showResults(); return; }
  updateTrainerProgress();
  if (S.mode === 'flashcard') loadFlash();
  else if (S.mode === 'quiz') loadQuiz();
  else if (S.mode === 'list') loadListMode();
  else if (S.mode === 'theory') loadTheory();
}

function updateTrainerProgress() {
  var topic = TOPICS.find(function(t) { return t.id === S.currentTopic; });
  if (!topic) return;
  var learned = topic.items.filter(function(item) {
    return getScore(S.scores, S.currentTopic, item.pt) === 2;
  }).length;
  var pct = Math.round(learned / topic.items.length * 100);
  document.getElementById('progFill').style.width = pct + '%';
  document.getElementById('trainerProgress').textContent = learned + '/' + topic.items.length;
  document.getElementById('cardCounter').textContent = (S.cur + 1) + ' / ' + S.queue.length;
  document.getElementById('quizCounter').textContent = (S.cur + 1) + ' / ' + S.queue.length;
}

// ============================================================
// FLASHCARD
// ============================================================
function loadFlash() {
  showModeUI('flashcard');
  var topic = TOPICS.find(function(t) { return t.id === S.currentTopic; });
  if (!topic || !S.queue || S.queue.length === 0) return;
  var item = topic.items[S.queue[S.cur]];
  if (!item) { showResults(); return; }

  S.revealed = false;
  S.currentPt = item.pt;
  var titlePart = topic.title.split('. ');
  document.getElementById('fcCtx').textContent = topic.emoji + ' ' + (titlePart[1] || topic.title);
  document.getElementById('fcEmoji').textContent = item.key ? '🔑' : '💬';
  document.getElementById('fcFront').textContent = item.ru;
  document.getElementById('fcTap').style.display = 'block';
  document.getElementById('fcBack').style.display = 'none';
  document.getElementById('cardActions').style.display = 'none';
  document.getElementById('fcAnswer').textContent = item.pt;
  document.getElementById('fcPron').textContent = item.pron ? '[' + item.pron + ']' : '';
  document.getElementById('fcExtra').innerHTML = item.extra ? item.extra.replace(/\//g, '<br>') : '';
}

function revealCard() {
  if (S.revealed) return;
  S.revealed = true;
  document.getElementById('fcTap').style.display = 'none';
  document.getElementById('fcBack').style.display = 'block';
  document.getElementById('cardActions').style.display = 'flex';
  speak(S.currentPt);
}

function speakNow(e) { e.stopPropagation(); speak(S.currentPt); }

function rate(score) {
  var topic = TOPICS.find(function(t) { return t.id === S.currentTopic; });
  var item = topic.items[S.queue[S.cur]];
  setSRS(S.scores, S.currentTopic, item.pt, score);
  if (score === 2) { S.rOk++; S.streak++; }
  else if (score === 1) { S.rHard++; S.streak = 0; }
  else { S.rWrong++; S.streak = 0; }
  if (score < 2 && S.cur < S.queue.length - 1) {
    var pos = Math.min(S.cur + 3 + Math.floor(Math.random() * 3), S.queue.length);
    S.queue.splice(pos, 0, S.queue[S.cur]);
  }
  S.cur++;
  storageSave(S.scores);
  checkTopicComplete();
  loadCard();
}

// ============================================================
// QUIZ
// ============================================================
function loadQuiz() {
  showModeUI('quiz');
  var topic = TOPICS.find(function(t) { return t.id === S.currentTopic; });
  var item = topic.items[S.queue[S.cur]];
  S.currentPt = item.pt;
  var titlePart = topic.title.split('. ');
  document.getElementById('quizCtx').textContent = topic.emoji + ' ' + (titlePart[1] || topic.title);
  document.getElementById('quizEmoji').textContent = '🔤';
  document.getElementById('quizPhrase').textContent = item.ru;
  document.getElementById('quizFb').textContent = '';
  document.getElementById('quizFb').className = 'quiz-fb';

  var correct = item.pt;
  var others = shuffle(topic.items.filter(function(v) { return v.pt !== item.pt; })).slice(0, 3).map(function(i) { return i.pt; });
  var opts = shuffle([correct].concat(others));

  var c = document.getElementById('quizOpts');
  c.innerHTML = '';
  opts.forEach(function(opt) {
    var btn = document.createElement('div');
    btn.className = 'quiz-opt';
    btn.textContent = opt;
    btn.onclick = (function(o) { return function() { checkQuiz(btn, o, correct, item); }; })(opt);
    c.appendChild(btn);
  });
}

function checkQuiz(btn, sel, correct, item) {
  document.querySelectorAll('.quiz-opt').forEach(function(b) { b.onclick = null; });
  var ok = sel === correct;
  btn.classList.add(ok ? 'correct' : 'wrong');
  if (!ok) {
    document.querySelectorAll('.quiz-opt').forEach(function(b) {
      if (b.textContent === correct) b.classList.add('show-correct');
    });
  }
  setSRS(S.scores, S.currentTopic, item.pt, ok ? 2 : 0);
  if (ok) { S.rOk++; S.streak++; speak(correct); } else { S.rWrong++; S.streak = 0; }
  var fb = document.getElementById('quizFb');
  fb.textContent = ok ? '✅ Верно!' : ('❌ ' + item.pt + (item.pron ? ' [' + item.pron + ']' : ''));
  fb.className = 'quiz-fb ' + (ok ? 'ok' : 'fail');
  storageSave(S.scores);
  checkTopicComplete();
  setTimeout(function() { S.cur++; loadCard(); }, 1500);
}

// ============================================================
// LIST MODE
// ============================================================
var currentModeList = [];

function loadListMode() {
  showModeUI('list');
  var topic = TOPICS.find(function(t) { return t.id === S.currentTopic; });
  currentModeList = topic.items.map(function(_, i) { return i; });
  renderModeList();
}

function sortModeList(type) {
  var topic = TOPICS.find(function(t) { return t.id === S.currentTopic; });
  if (type === 'shuffle') {
    currentModeList = shuffle(topic.items.map(function(_, i) { return i; }));
  } else {
    currentModeList = topic.items.map(function(_, i) { return i; });
  }
  renderModeList();
}

function renderModeList() {
  var topic = TOPICS.find(function(t) { return t.id === S.currentTopic; });
  document.getElementById('modeListContainer').innerHTML = currentModeList.map(function(i) {
    var v = topic.items[i];
    var s = getScore(S.scores, S.currentTopic, v.pt);
    var days = getDaysUntil(S.scores, S.currentTopic, v.pt);
    var cls = s === 2 ? 's2' : s === 0 ? 's0' : s === 1 ? 's1' : '';
    var bc = s === 2 ? 'background:rgba(52,211,153,.15);color:var(--green)'
           : s === 0 ? 'background:rgba(248,113,113,.15);color:var(--red)'
           : s === 1 ? 'background:rgba(251,191,36,.15);color:var(--yellow)'
           : 'background:var(--surface2);color:var(--muted)';
    var bl = (s === 2 ? '✅ Знаю' : s === 0 ? '❌ Сложно' : s === 1 ? '😅 Трудно' : '🆕 Новый')
           + (s === 2 && days > 0 ? ' (' + days + 'д)' : '');
    var pt_safe = v.pt.replace(/'/g, "\\'");
    return '<div class="verb-item ' + cls + '">' +
      '<div class="vi-top">' +
        '<div class="vi-left">' +
          '<div class="vi-emoji-sm" onclick="speak(\'' + pt_safe + '\')" style="cursor:pointer">🔊</div>' +
          '<div><div class="vi-ru">' + v.ru + '</div>' +
          '<div class="vi-pt">' + v.pt + '</div>' +
          '<div class="vi-inf">[' + (v.pron || '') + ']</div></div>' +
        '</div>' +
        '<div class="vi-badge" style="' + bc + '">' + bl + '</div>' +
      '</div>' +
      (v.extra ? '<div class="vi-phrase"><div class="vi-phrase-pt" style="color:var(--muted);font-size:12px">' + v.extra.replace(/\//g, '<br>') + '</div></div>' : '') +
      '<div style="display:flex;gap:6px;margin-top:12px;">' +
        '<button onclick="rateInList(\'' + pt_safe + '\',2)" style="flex:1;padding:8px;border:none;border-radius:8px;background:rgba(52,211,153,.15);color:var(--green);font-weight:700;cursor:pointer">✅</button>' +
        '<button onclick="rateInList(\'' + pt_safe + '\',1)" style="flex:1;padding:8px;border:none;border-radius:8px;background:rgba(251,191,36,.15);color:var(--yellow);font-weight:700;cursor:pointer">😅</button>' +
        '<button onclick="rateInList(\'' + pt_safe + '\',0)" style="flex:1;padding:8px;border:none;border-radius:8px;background:rgba(248,113,113,.15);color:var(--red);font-weight:700;cursor:pointer">❌</button>' +
      '</div></div>';
  }).join('');
}

function rateInList(ptKey, score) {
  setSRS(S.scores, S.currentTopic, ptKey, score);
  storageSave(S.scores);
  updateTrainerProgress();
  checkTopicComplete();
  renderModeList();
}

// ============================================================
// THEORY
// ============================================================
function loadTheory() {
  showModeUI('theory');
  var content = THEORY[S.currentTopic];
  var c = document.getElementById('theoryContent');
  if (content) {
    c.innerHTML = content;
  } else {
    c.innerHTML = '<div class="th-empty">Для этой темы объяснений пока нет.<br><br>Карточки доступны в других режимах.</div>';
  }
}

// ============================================================
// RESULTS
// ============================================================
function showResults() {
  showModeUI('results');
  var total = S.rOk + S.rHard + S.rWrong;
  var pct = total ? Math.round(S.rOk / total * 100) : 0;
  document.getElementById('resOk').textContent = S.rOk;
  document.getElementById('resHard').textContent = S.rHard;
  document.getElementById('resWrong').textContent = S.rWrong;
  document.getElementById('resEmoji').textContent = pct >= 80 ? '🔥' : pct >= 60 ? '💪' : '📚';
  document.getElementById('resTitle').textContent = pct >= 80 ? 'Отлично!' : pct >= 60 ? 'Хороший прогресс!' : 'Продолжай!';
  document.getElementById('resSub').textContent = pct + '% из ' + total + ' карточек';
  var topicPct = getTopicProgress(S.currentTopic);
  var r100 = document.getElementById('res100');
  if (topicPct === 100) { r100.style.display = 'block'; r100.textContent = '🎉 Тема выучена на 100%!'; }
  else { r100.style.display = 'none'; }
}

function nextRound() { startRound(); }

// ============================================================
// LINEAR INTEGRATION
// ============================================================
function checkTopicComplete() {
  var topic = TOPICS.find(function(t) { return t.id === S.currentTopic; });
  if (!topic) return;
  var learned = topic.items.filter(function(item) {
    return getScore(S.scores, S.currentTopic, item.pt) === 2;
  }).length;
  if (learned === topic.items.length && topic.linearId) {
    markLinearDone(topic.linearId);
  }
}

function markLinearDone(linearId) {
  var issueId = LINEAR_ISSUE_IDS[linearId];
  if (!issueId) return;
  fetch('/linear-done', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issueId: issueId, stateId: DONE_STATE })
  }).catch(function() {});
}

// ============================================================
// THEME
// ============================================================
function toggleTheme() {
  var isLight = document.body.classList.toggle('light');
  updateThemeBtns(isLight);
  storageThemeSave(isLight ? 'light' : 'dark');
}

function updateThemeBtns(isLight) {
  var btns = document.querySelectorAll('.theme-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].textContent = isLight ? '☀️' : '🌙';
  }
}

// ============================================================
// URL ROUTING
// ============================================================
function checkUrlTopic() {
  var params = new URLSearchParams(window.location.search);
  var topicParam = params.get('topic');
  if (topicParam) {
    var found = TOPICS.find(function(t) { return t.id === topicParam; });
    if (found) openTopic(found.id);
  }
}

// ============================================================
// START
// ============================================================
window.addEventListener('DOMContentLoaded', init);
