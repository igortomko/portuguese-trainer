// SRS — Spaced Repetition System
// Кривая забываемости: чем больше раз знал, тем дольше интервал до следующего показа

var SRS_INTERVALS = [1, 3, 7, 14, 30, 60, 120]; // дни
var MS_DAY = 86400000;

function getSRS(scores, topicId, pt) {
  var sc = scores[topicId];
  var d = sc ? sc[pt] : undefined;
  if (d === undefined || d === null) return { s: -1, n: 0, c: 0 };
  if (typeof d === 'number') return { s: d, n: 0, c: 0 }; // старый формат
  return d;
}

function isDue(scores, topicId, pt) {
  var d = getSRS(scores, topicId, pt);
  if (d.s < 2) return true;      // не знал — всегда показываем
  if (!d.n) return true;          // никогда не было SRS — показываем
  return Date.now() >= d.n;      // пора повторить
}

function getScore(scores, topicId, pt) {
  var d = getSRS(scores, topicId, pt);
  if (typeof d === 'number') return d;
  return (d.s !== undefined) ? d.s : -1;
}

function setSRS(scores, topicId, pt, score) {
  if (!scores[topicId]) scores[topicId] = {};
  var prev = getSRS(scores, topicId, pt);
  var c = prev.c || 0;
  var n = 0;
  if (score === 2) {
    n = Date.now() + SRS_INTERVALS[Math.min(c, SRS_INTERVALS.length - 1)] * MS_DAY;
  } else if (score === 1) {
    n = Date.now() + MS_DAY;
  }
  scores[topicId][pt] = { s: score, n: n, c: score === 2 ? c + 1 : Math.max(0, c - 1) };
}

function getDaysUntil(scores, topicId, pt) {
  var d = getSRS(scores, topicId, pt);
  if (!d.n) return 0;
  return Math.max(0, Math.ceil((d.n - Date.now()) / MS_DAY));
}
