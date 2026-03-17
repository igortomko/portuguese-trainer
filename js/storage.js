// Storage — работа с localStorage
var STORAGE_KEY = 'pt_b2_scores';
var BACKUP_KEY  = 'pt_b2_backup';
var VERSION_KEY = 'pt_b2_version';
var APP_VERSION = '3.0';

function storageSave(scores) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch (e) {
    console.warn('Save failed', e);
  }
}

function storageLoad() {
  try {
    var savedVersion = localStorage.getItem(VERSION_KEY);
    if (savedVersion !== APP_VERSION) {
      var existing = localStorage.getItem(STORAGE_KEY);
      if (existing) {
        localStorage.setItem(BACKUP_KEY + '_' + (savedVersion || 'legacy'), existing);
      }
      localStorage.setItem(VERSION_KEY, APP_VERSION);
    }
    var s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : {};
  } catch (e) {
    console.warn('Load failed', e);
    return {};
  }
}

function storageGetBackup() {
  var keys = Object.keys(localStorage).filter(function(k) { return k.indexOf(BACKUP_KEY) === 0; });
  if (!keys.length) return null;
  keys.sort();
  var data = localStorage.getItem(keys[keys.length - 1]);
  if (!data) return null;
  try { return JSON.parse(data); } catch(e) { return null; }
}

function storageThemeLoad() {
  return localStorage.getItem('pt_theme') || 'dark';
}

function storageThemeSave(theme) {
  localStorage.setItem('pt_theme', theme);
}

// Export/import for manual recovery
window.exportProgress = function() {
  var data = localStorage.getItem(STORAGE_KEY);
  console.log('=== PROGRESS EXPORT ===\n' + data);
  return data;
};

window.importProgress = function(json) {
  try {
    var parsed = JSON.parse(json);
    storageSave(parsed);
    console.log('Imported successfully');
    return parsed;
  } catch (e) {
    console.error('Import failed', e);
    return null;
  }
};
