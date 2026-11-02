/**
 * app.js
 * Controller Utama & Logika Antarmuka Pengguna (UI) Aplikasi Koreksi ASAS.
 * Dilengkapi Sistem Input Cepat Keyboard (Auto-Advance), Quick Paste String,
 * dan Batch Import Multi-Siswa langsung dari spreadsheet/Excel.
 */

(function () {
  'use strict';

  // Inisialisasi Engine Penilaian & Konfigurasi
  const scoringConfig = window.StorageManager.getScoringConfig();
  const scoringEngine = new window.ScoringEngine(scoringConfig);

  // Application State
  const state = {
    activeTab: 'koreksi', // 'koreksi' | 'batch' | 'kunci' | 'rekap' | 'analisis' | 'pengaturan'
    selectedSubject: window.StorageManager.getActiveSubject() || 'eksak',
    editingStudentId: null,
    
    // Form Input Siswa (Satuan)
    studentForm: {
      name: '',
      code: '',
      answers: {}
    },

    // Form Kunci Jawaban (Draft)
    keyForm: {
      subjectType: 'eksak',
      subjectName: '',
      className: '',
      semester: 'Ganjil',
      academicYear: '2026/2027',
      teacherName: '',
      answers: {}
    },

    // Form Batch Import
    batchData: {
      rawText: '',
      parsedStudents: [],
      selectedSubject: 'eksak'
    },

    // Filter Rekapitulasi
    filters: {
      search: '',
      status: 'all',
      subject: 'all'
    }
  };

  // =========================================================================
  // HELPER FUNCTIONS & TOAST
  // =========================================================================

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-item';

    let bgClass = 'bg-slate-800 text-white';
    let icon = 'ℹ️';

    if (type === 'success') {
      bgClass = 'bg-emerald-600 text-white shadow-emerald-600/20';
      icon = '✅';
    } else if (type === 'warning') {
      bgClass = 'bg-amber-600 text-white shadow-amber-600/20';
      icon = '⚠️';
    } else if (type === 'danger') {
      bgClass = 'bg-rose-600 text-white shadow-rose-600/20';
      icon = '❌';
    }

    toast.className = `toast-item ${bgClass}`;
    toast.innerHTML = `<span>${icon}</span><span class="flex-1">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  function formatSubjectBadge(subjectType) {
    if (subjectType === 'eksak') {
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">Mapel Eksak (30)</span>`;
    }
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">Non-Eksak (40)</span>`;
  }

  function getSubjectStructure(subjectType) {
    return window.ASAS_MODELS.SUBJECT_STRUCTURES[subjectType] || window.ASAS_MODELS.SUBJECT_STRUCTURES.eksak;
  }

  function formatAnswerForInput(val) {
    if (!val) return '';
    if (Array.isArray(val)) return val.join('');
    return String(val);
  }

  // =========================================================================
  // PARSER STRING JAWABAN (QUICK PASTE & BATCH)
  // =========================================================================

  /**
   * Mengurai string jawaban fleksibel (mendukung spasi, koma, kurung [A,C], dsb)
   * menjadi array token jawaban per butir soal.
   */
  function parseAnswerTokens(str) {
    if (!str || typeof str !== 'string') return [];

    // Ekstrak token dalam tanda kurung lebih dulu misal [A, C] atau (A, B, E)
    const placeholders = [];
    let cleaned = str.replace(/\[(.*?)\]|\((.*?)\)/g, (match, p1, p2) => {
      const inside = (p1 !== undefined ? p1 : p2) || '';
      const letters = (inside.match(/[A-Ea-e]/g) || []).map(x => x.toUpperCase());
      const uniqueSorted = Array.from(new Set(letters)).sort();
      placeholders.push(uniqueSorted);
      return ` __PH_${placeholders.length - 1}__ `;
    });

    // Hilangkan nomor soal prefix seperti "1.", "1:", "No. 1:", "1)"
    cleaned = cleaned.replace(/(?:No\.?|Soal\s*)?\b\d+[\.:=\)]\s*/gi, ' ');

    // Pisahkan berdasarkan spasi, tab, koma, titik koma, baris baru, atau garis pipa
    const rawParts = cleaned.split(/[\s,;|\t\r\n]+/);
    const tokens = [];

    for (const part of rawParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const phMatch = trimmed.match(/^__PH_(\d+)__$/);
      if (phMatch) {
        const idx = parseInt(phMatch[1], 10);
        tokens.push(placeholders[idx]);
      } else {
        const letters = (trimmed.match(/[A-Za-z]/g) || []).map(x => x.toUpperCase());
        if (letters.length === 1) {
          tokens.push(letters[0]);
        } else if (letters.length > 1) {
          // Kombinasi huruf seperti AC atau BDE
          const validOpts = letters.filter(x => ['A', 'B', 'C', 'D', 'E'].includes(x));
          if (validOpts.length > 0) {
            tokens.push(Array.from(new Set(validOpts)).sort());
          }
        }
      }
    }

    return tokens;
  }

  /**
   * Mengonversi array token ke dictionary answers { [num]: ans }
   * berdasarkan jenis mata pelajaran (PG, PGK, B/S).
   */
  function mapTokensToAnswers(tokens, structure) {
    const answers = {};
    for (let num = 1; num <= structure.totalQuestions; num++) {
      const token = tokens[num - 1];
      if (token === undefined) continue;

      const qType = structure.getQuestionType(num);

      if (qType === 'pgSingle') {
        const val = Array.isArray(token) ? token[0] : String(token).toUpperCase();
        if (window.ASAS_MODELS.PG_OPTIONS.includes(val)) {
          answers[num] = val;
        }
      } else if (qType === 'pgComplex') {
        let list = [];
        if (Array.isArray(token)) {
          list = token;
        } else {
          list = String(token).toUpperCase().replace(/[^A-E]/g, '').split('');
        }
        list = Array.from(new Set(list.filter(x => window.ASAS_MODELS.PG_OPTIONS.includes(x)))).sort();
        if (list.length > 0) {
          answers[num] = list;
        }
      } else if (qType === 'trueFalse') {
        let val = Array.isArray(token) ? token[0] : String(token).toUpperCase();
        if (val === 'T') val = 'B';
        if (val === 'F') val = 'S';
        if (window.ASAS_MODELS.TF_OPTIONS.includes(val)) {
          answers[num] = val;
        }
      }
    }
    return answers;
  }

  // =========================================================================
  // TAB NAVIGATION
  // =========================================================================

  function switchTab(tabId) {
    state.activeTab = tabId;

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      const target = btn.getAttribute('data-tab');
      if (target === tabId) {
        btn.classList.add('bg-white', 'text-indigo-600', 'shadow-sm', 'font-bold');
        btn.classList.remove('text-slate-600', 'hover:text-slate-900', 'font-medium');
      } else {
        btn.classList.remove('bg-white', 'text-indigo-600', 'shadow-sm', 'font-bold');
        btn.classList.add('text-slate-600', 'hover:text-slate-900', 'font-medium');
      }
    });

    document.querySelectorAll('.tab-section').forEach(sec => {
      if (sec.id === `tab-${tabId}`) {
        sec.classList.remove('hidden');
        sec.classList.add('fade-in');
      } else {
        sec.classList.add('hidden');
        sec.classList.remove('fade-in');
      }
    });

    if (tabId === 'koreksi') {
      renderStudentGradingTab();
    } else if (tabId === 'batch') {
      renderBatchTab();
    } else if (tabId === 'kunci') {
      loadKeyFormData(state.selectedSubject);
      renderAnswerKeyTab();
    } else if (tabId === 'rekap') {
      renderRecapTable();
    } else if (tabId === 'analisis') {
      renderItemAnalysisTab();
    } else if (tabId === 'pengaturan') {
      renderSettingsTab();
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // =========================================================================
  // TAB 1: PENGATURAN KUNCI JAWABAN (DASHBOARD GURU)
  // =========================================================================

  function loadKeyFormData(subjectType) {
    const keyData = window.StorageManager.getAnswerKeyFor(subjectType);
    state.keyForm = {
      subjectType: subjectType,
      subjectName: keyData.subjectName || (subjectType === 'eksak' ? 'Matematika' : 'Bahasa Indonesia'),
      className: keyData.className || 'XII',
      semester: keyData.semester || 'Ganjil',
      academicYear: keyData.academicYear || '2026/2027',
      teacherName: keyData.teacherName || '',
      answers: JSON.parse(JSON.stringify(keyData.answers || {}))
    };
  }

  function renderAnswerKeyTab() {
    const container = document.getElementById('key-questions-container');
    if (!container) return;

    const subjectType = state.keyForm.subjectType;
    const structure = getSubjectStructure(subjectType);

    const btnEksak = document.getElementById('key-toggle-eksak');
    const btnNonEksak = document.getElementById('key-toggle-non-eksak');
    if (btnEksak && btnNonEksak) {
      if (subjectType === 'eksak') {
        btnEksak.className = 'px-4 py-2 text-sm font-bold rounded-lg bg-indigo-600 text-white shadow-md transition';
        btnNonEksak.className = 'px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
      } else {
        btnNonEksak.className = 'px-4 py-2 text-sm font-bold rounded-lg bg-indigo-600 text-white shadow-md transition';
        btnEksak.className = 'px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
      }
    }

    const elName = document.getElementById('key-subject-name');
    const elClass = document.getElementById('key-class-name');
    const elSemester = document.getElementById('key-semester');
    const elYear = document.getElementById('key-academic-year');
    const elTeacher = document.getElementById('key-teacher-name');

    if (elName) elName.value = state.keyForm.subjectName;
    if (elClass) elClass.value = state.keyForm.className;
    if (elSemester) elSemester.value = state.keyForm.semester;
    if (elYear) elYear.value = state.keyForm.academicYear;
    if (elTeacher) elTeacher.value = state.keyForm.teacherName;

    let html = '';

    structure.sections.forEach(section => {
      html += `
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 md:p-6 mb-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
            <div>
              <h3 class="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span class="inline-block w-2.5 h-2.5 rounded-full ${section.type === 'pgSingle' ? 'bg-blue-600' : section.type === 'pgComplex' ? 'bg-purple-600' : 'bg-emerald-600'}"></span>
                ${section.title}
              </h3>
              <p class="text-xs md:text-sm text-slate-500">${section.subtitle} (Soal No. ${section.startNumber} - ${section.endNumber})</p>
            </div>
            <div class="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
              ${section.count} Butir Soal
            </div>
          </div>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
      `;

      for (let num = section.startNumber; num <= section.endNumber; num++) {
        const currentAns = state.keyForm.answers[num];

        if (section.type === 'pgSingle') {
          html += `
            <div class="bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between transition-all">
              <div class="flex items-center justify-between mb-2">
                <span class="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-100 text-blue-800 font-bold text-xs">
                  ${num}
                </span>
                <span class="text-[11px] font-semibold text-slate-500">
                  ${currentAns ? `<span class="text-blue-600 font-bold">Kunci: ${currentAns}</span>` : '<span class="text-rose-500">Kosong</span>'}
                </span>
              </div>
              <div class="flex items-center justify-between gap-1">
                ${window.ASAS_MODELS.PG_OPTIONS.map(opt => {
                  const isChecked = (currentAns === opt);
                  return `
                    <button type="button" 
                      onclick="window.ASAS_APP.setKeySingle(${num}, '${opt}')"
                      class="option-btn flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        isChecked 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm scale-105' 
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
                      }">
                      ${opt}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        } else if (section.type === 'pgComplex') {
          const selectedList = Array.isArray(currentAns) ? currentAns : [];
          html += `
            <div class="bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between transition-all">
              <div class="flex items-center justify-between mb-2">
                <span class="w-7 h-7 flex items-center justify-center rounded-lg bg-purple-100 text-purple-800 font-bold text-xs">
                  ${num}
                </span>
                <span class="text-[11px] font-semibold text-slate-500">
                  ${selectedList.length > 0 
                    ? `<span class="text-purple-600 font-bold">[${selectedList.join(', ')}]</span>` 
                    : '<span class="text-rose-500">Kosong</span>'}
                </span>
              </div>
              <div class="flex items-center justify-between gap-1">
                ${window.ASAS_MODELS.PG_OPTIONS.map(opt => {
                  const isChecked = selectedList.includes(opt);
                  return `
                    <button type="button" 
                      onclick="window.ASAS_APP.toggleKeyComplex(${num}, '${opt}')"
                      class="option-btn flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        isChecked 
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm scale-105' 
                          : 'bg-white text-slate-700 border-slate-200 hover:border-purple-400 hover:bg-purple-50/50'
                      }">
                      ${opt}
                    </button>
                  `;
                }).join('')}
              </div>
              <p class="text-[10px] text-slate-400 mt-1.5 text-center">Bisa pilih >1 opsi</p>
            </div>
          `;
        } else if (section.type === 'trueFalse') {
          html += `
            <div class="bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between transition-all">
              <div class="flex items-center justify-between mb-2">
                <span class="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs">
                  ${num}
                </span>
                <span class="text-[11px] font-semibold text-slate-500">
                  ${currentAns 
                    ? `<span class="text-emerald-700 font-bold">${currentAns === 'B' ? 'Benar (B)' : 'Salah (S)'}</span>` 
                    : '<span class="text-rose-500">Kosong</span>'}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" 
                  onclick="window.ASAS_APP.setKeyTrueFalse(${num}, 'B')"
                  class="option-btn flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    currentAns === 'B' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm scale-105' 
                      : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50'
                  }">
                  Benar (B)
                </button>
                <button type="button" 
                  onclick="window.ASAS_APP.setKeyTrueFalse(${num}, 'S')"
                  class="option-btn flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    currentAns === 'S' 
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm scale-105' 
                      : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50/50'
                  }">
                  Salah (S)
                </button>
              </div>
            </div>
          `;
        }
      }

      html += `
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function setKeySingle(num, opt) {
    state.keyForm.answers[num] = opt;
    renderAnswerKeyTab();
  }

  function toggleKeyComplex(num, opt) {
    const current = Array.isArray(state.keyForm.answers[num]) ? [...state.keyForm.answers[num]] : [];
    const idx = current.indexOf(opt);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(opt);
      current.sort();
    }
    state.keyForm.answers[num] = current;
    renderAnswerKeyTab();
  }

  function setKeyTrueFalse(num, opt) {
    state.keyForm.answers[num] = opt;
    renderAnswerKeyTab();
  }

  function saveKeyForm() {
    const subjectType = state.keyForm.subjectType;
    const structure = getSubjectStructure(subjectType);

    const elName = document.getElementById('key-subject-name');
    const elClass = document.getElementById('key-class-name');
    const elSemester = document.getElementById('key-semester');
    const elYear = document.getElementById('key-academic-year');
    const elTeacher = document.getElementById('key-teacher-name');

    state.keyForm.subjectName = elName ? elName.value.trim() : '';
    state.keyForm.className = elClass ? elClass.value.trim() : '';
    state.keyForm.semester = elSemester ? elSemester.value.trim() : 'Ganjil';
    state.keyForm.academicYear = elYear ? elYear.value.trim() : '2026/2027';
    state.keyForm.teacherName = elTeacher ? elTeacher.value.trim() : '';

    let emptyCount = 0;
    for (let i = 1; i <= structure.totalQuestions; i++) {
      const a = state.keyForm.answers[i];
      if (!a || (Array.isArray(a) && a.length === 0)) {
        emptyCount++;
      }
    }

    if (emptyCount > 0) {
      const confirmSave = confirm(`Perhatian: Masih ada ${emptyCount} butir kunci jawaban yang belum diisi. Tetap simpan?`);
      if (!confirmSave) return;
    }

    const saved = window.StorageManager.saveAnswerKey(subjectType, state.keyForm);
    if (saved) {
      showToast(`Kunci jawaban ${structure.title} berhasil disimpan!`, 'success');
      
      const students = window.StorageManager.getStudents().filter(s => s.subjectType === subjectType);
      if (students.length > 0) {
        if (confirm(`Terdapat ${students.length} siswa dengan mapel ini. Perbarui nilai seluruh siswa otomatis sekarang?`)) {
          recalculateAllStudents(subjectType);
        }
      }
    } else {
      showToast('Gagal menyimpan kunci jawaban.', 'danger');
    }
  }

  function applyQuickPasteToKey() {
    const inputEl = document.getElementById('quick-paste-key-input');
    if (!inputEl) return;

    const raw = inputEl.value.trim();
    if (!raw) {
      showToast('Tempelkan string kunci jawaban terlebih dahulu!', 'warning');
      inputEl.focus();
      return;
    }

    const structure = getSubjectStructure(state.keyForm.subjectType);
    const tokens = parseAnswerTokens(raw);

    if (tokens.length === 0) {
      showToast('Format teks kunci tidak dapat dikenali.', 'warning');
      return;
    }

    const mappedAnswers = mapTokensToAnswers(tokens, structure);
    state.keyForm.answers = mappedAnswers;
    renderAnswerKeyTab();

    const filledCount = Object.keys(mappedAnswers).length;
    showToast(`Berhasil menerapkan ${filledCount} butir kunci jawaban!`, 'success');
    inputEl.value = '';
  }

  function loadSampleKeysForCurrentSubject() {
    const subjectType = state.keyForm.subjectType;
    const sample = window.ASAS_MODELS.DEFAULT_SAMPLE_KEYS[subjectType];
    if (sample) {
      state.keyForm = JSON.parse(JSON.stringify(sample));
      renderAnswerKeyTab();
      showToast('Kunci jawaban contoh berhasil dimuat!', 'info');
    }
  }

  function clearKeysForCurrentSubject() {
    if (confirm('Apakah Anda yakin ingin mengosongkan semua kunci jawaban pada mapel ini?')) {
      state.keyForm.answers = {};
      renderAnswerKeyTab();
      showToast('Semua kunci jawaban dikosongkan.', 'warning');
    }
  }

  // =========================================================================
  // TAB 2: INPUT JAWABAN SISWA (AUTO-ADVANCE KEYBOARD & QUICK PASTE)
  // =========================================================================

  function renderStudentGradingTab() {
    const container = document.getElementById('grading-questions-container');
    if (!container) return;

    const subjectType = state.selectedSubject;
    const structure = getSubjectStructure(subjectType);

    const btnEksak = document.getElementById('grade-toggle-eksak');
    const btnNonEksak = document.getElementById('grade-toggle-non-eksak');
    if (btnEksak && btnNonEksak) {
      if (subjectType === 'eksak') {
        btnEksak.className = 'px-4 py-2 text-sm font-bold rounded-lg bg-indigo-600 text-white shadow-md transition';
        btnNonEksak.className = 'px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
      } else {
        btnNonEksak.className = 'px-4 py-2 text-sm font-bold rounded-lg bg-indigo-600 text-white shadow-md transition';
        btnEksak.className = 'px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
      }
    }

    const elName = document.getElementById('student-name');
    const elCode = document.getElementById('student-code');
    if (elName && !elName.value) elName.value = state.studentForm.name;
    if (elCode && !elCode.value) elCode.value = state.studentForm.code;

    const editNotice = document.getElementById('edit-mode-notice');
    if (editNotice) {
      if (state.editingStudentId) {
        editNotice.classList.remove('hidden');
      } else {
        editNotice.classList.add('hidden');
      }
    }

    let html = '';

    structure.sections.forEach(section => {
      html += `
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 md:p-6 mb-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
            <div>
              <h3 class="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span class="inline-block w-2.5 h-2.5 rounded-full ${section.type === 'pgSingle' ? 'bg-blue-600' : section.type === 'pgComplex' ? 'bg-purple-600' : 'bg-emerald-600'}"></span>
                ${section.title}
              </h3>
              <p class="text-xs md:text-sm text-slate-500">${section.subtitle} (Soal No. ${section.startNumber} - ${section.endNumber})</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                ⌨️ Ketik Langsung
              </span>
              <span class="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                ${section.count} Butir
              </span>
            </div>
          </div>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
      `;

      for (let num = section.startNumber; num <= section.endNumber; num++) {
        const studentAns = state.studentForm.answers[num];
        const displayVal = formatAnswerForInput(studentAns);

        if (section.type === 'pgSingle') {
          html += `
            <div class="bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between transition-all" id="card-soal-${num}">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-1.5">
                  <span class="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-100 text-blue-800 font-bold text-xs">
                    ${num}
                  </span>
                  <input type="text" 
                    id="q-key-${num}" 
                    data-qnum="${num}" 
                    data-qtype="pgSingle" 
                    maxlength="1"
                    value="${displayVal}"
                    placeholder="A-E"
                    autocomplete="off"
                    onkeydown="window.ASAS_APP.handleAutoKeydown(event, ${num}, 'pgSingle')"
                    class="key-auto-input w-12 text-center text-xs font-mono font-bold uppercase py-1 px-1 bg-white border border-slate-300 rounded-md focus:bg-indigo-50 focus:border-indigo-600 focus:outline-none transition" />
                </div>
                <span class="text-[11px] font-semibold text-slate-500" id="status-label-${num}">
                  ${studentAns ? `<span class="text-blue-600 font-bold">${studentAns}</span>` : '<span class="text-slate-400">-</span>'}
                </span>
              </div>
              <div class="flex items-center justify-between gap-1">
                ${window.ASAS_MODELS.PG_OPTIONS.map(opt => {
                  const isChecked = (studentAns === opt);
                  return `
                    <button type="button" 
                      id="opt-btn-${num}-${opt}"
                      onclick="window.ASAS_APP.setStudentSingle(${num}, '${opt}')"
                      class="option-btn flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        isChecked 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm scale-105' 
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
                      }">
                      ${opt}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        } else if (section.type === 'pgComplex') {
          const selectedList = Array.isArray(studentAns) ? studentAns : [];
          html += `
            <div class="bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between transition-all" id="card-soal-${num}">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-1.5">
                  <span class="w-7 h-7 flex items-center justify-center rounded-lg bg-purple-100 text-purple-800 font-bold text-xs">
                    ${num}
                  </span>
                  <input type="text" 
                    id="q-key-${num}" 
                    data-qnum="${num}" 
                    data-qtype="pgComplex" 
                    value="${displayVal}"
                    placeholder="AC.."
                    autocomplete="off"
                    onkeydown="window.ASAS_APP.handleAutoKeydown(event, ${num}, 'pgComplex')"
                    oninput="window.ASAS_APP.handleComplexInput(event, ${num})"
                    class="key-auto-input w-14 text-center text-xs font-mono font-bold uppercase py-1 px-1 bg-white border border-slate-300 rounded-md focus:bg-indigo-50 focus:border-indigo-600 focus:outline-none transition" />
                </div>
                <span class="text-[11px] font-semibold text-slate-500" id="status-label-${num}">
                  ${selectedList.length > 0 
                    ? `<span class="text-purple-600 font-bold">[${selectedList.join(',')}]</span>` 
                    : '<span class="text-slate-400">-</span>'}
                </span>
              </div>
              <div class="flex items-center justify-between gap-1">
                ${window.ASAS_MODELS.PG_OPTIONS.map(opt => {
                  const isChecked = selectedList.includes(opt);
                  return `
                    <button type="button" 
                      id="opt-btn-${num}-${opt}"
                      onclick="window.ASAS_APP.toggleStudentComplex(${num}, '${opt}')"
                      class="option-btn flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        isChecked 
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm scale-105' 
                          : 'bg-white text-slate-700 border-slate-200 hover:border-purple-400 hover:bg-purple-50/50'
                      }">
                      ${opt}
                    </button>
                  `;
                }).join('')}
              </div>
              <p class="text-[10px] text-slate-400 mt-1.5 text-center">Tekan Enter/Spasi untuk lanjut</p>
            </div>
          `;
        } else if (section.type === 'trueFalse') {
          html += `
            <div class="bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between transition-all" id="card-soal-${num}">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-1.5">
                  <span class="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs">
                    ${num}
                  </span>
                  <input type="text" 
                    id="q-key-${num}" 
                    data-qnum="${num}" 
                    data-qtype="trueFalse" 
                    maxlength="1"
                    value="${displayVal}"
                    placeholder="B/S"
                    autocomplete="off"
                    onkeydown="window.ASAS_APP.handleAutoKeydown(event, ${num}, 'trueFalse')"
                    class="key-auto-input w-12 text-center text-xs font-mono font-bold uppercase py-1 px-1 bg-white border border-slate-300 rounded-md focus:bg-indigo-50 focus:border-indigo-600 focus:outline-none transition" />
                </div>
                <span class="text-[11px] font-semibold text-slate-500" id="status-label-${num}">
                  ${studentAns 
                    ? `<span class="text-emerald-700 font-bold">${studentAns}</span>` 
                    : '<span class="text-slate-400">-</span>'}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" 
                  id="opt-btn-${num}-B"
                  onclick="window.ASAS_APP.setStudentTrueFalse(${num}, 'B')"
                  class="option-btn flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    studentAns === 'B' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm scale-105' 
                      : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50'
                  }">
                  Benar (B)
                </button>
                <button type="button" 
                  id="opt-btn-${num}-S"
                  onclick="window.ASAS_APP.setStudentTrueFalse(${num}, 'S')"
                  class="option-btn flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    studentAns === 'S' 
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm scale-105' 
                      : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50/50'
                  }">
                  Salah (S)
                </button>
              </div>
            </div>
          `;
        }
      }

      html += `
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    updateLiveScorePreview();
  }

  function focusQuestionInput(targetNum) {
    const structure = getSubjectStructure(state.selectedSubject);
    if (targetNum > structure.totalQuestions) {
      const saveBtn = document.getElementById('btn-save-grading');
      if (saveBtn) saveBtn.focus();
      return;
    }
    if (targetNum < 1) {
      const codeInput = document.getElementById('student-code');
      if (codeInput) codeInput.focus();
      return;
    }

    const nextEl = document.getElementById(`q-key-${targetNum}`);
    if (nextEl) {
      nextEl.focus();
      nextEl.select();
    }
  }

  function handleAutoKeydown(e, num, qType) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusQuestionInput(num + 1);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusQuestionInput(num - 1);
      return;
    }
    if (e.key === 'Backspace') {
      const currentInput = document.getElementById(`q-key-${num}`);
      if (currentInput && (!currentInput.value || currentInput.value.length <= 1)) {
        delete state.studentForm.answers[num];
        updateQuestionCardUI(num);
        updateLiveScorePreview();
        if (!currentInput.value) {
          e.preventDefault();
          focusQuestionInput(num - 1);
        }
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      focusQuestionInput(num + 1);
      return;
    }

    if (qType === 'pgSingle') {
      const keyUpper = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D', 'E'].includes(keyUpper)) {
        e.preventDefault();
        state.studentForm.answers[num] = keyUpper;
        const currentInput = document.getElementById(`q-key-${num}`);
        if (currentInput) currentInput.value = keyUpper;
        updateQuestionCardUI(num);
        updateLiveScorePreview();
        focusQuestionInput(num + 1);
      }
    }

    if (qType === 'trueFalse') {
      let keyUpper = e.key.toUpperCase();
      if (keyUpper === 'T') keyUpper = 'B';
      if (keyUpper === 'F') keyUpper = 'S';
      if (['B', 'S'].includes(keyUpper)) {
        e.preventDefault();
        state.studentForm.answers[num] = keyUpper;
        const currentInput = document.getElementById(`q-key-${num}`);
        if (currentInput) currentInput.value = keyUpper;
        updateQuestionCardUI(num);
        updateLiveScorePreview();
        focusQuestionInput(num + 1);
      }
    }
  }

  function handleComplexInput(e, num) {
    const rawVal = e.target.value.toUpperCase();
    const letters = (rawVal.match(/[A-E]/g) || []);
    const uniqueSorted = Array.from(new Set(letters)).sort();

    if (uniqueSorted.length > 0) {
      state.studentForm.answers[num] = uniqueSorted;
    } else {
      delete state.studentForm.answers[num];
    }

    e.target.value = uniqueSorted.join('');
    updateQuestionCardUI(num);
    updateLiveScorePreview();
  }

  function updateQuestionCardUI(num) {
    const structure = getSubjectStructure(state.selectedSubject);
    const qType = structure.getQuestionType(num);
    const ans = state.studentForm.answers[num];
    const statusLabel = document.getElementById(`status-label-${num}`);

    if (qType === 'pgSingle') {
      window.ASAS_MODELS.PG_OPTIONS.forEach(opt => {
        const btn = document.getElementById(`opt-btn-${num}-${opt}`);
        if (btn) {
          if (ans === opt) {
            btn.className = 'option-btn flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all bg-blue-600 text-white border-blue-600 shadow-sm scale-105';
          } else {
            btn.className = 'option-btn flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50';
          }
        }
      });
      if (statusLabel) {
        statusLabel.innerHTML = ans ? `<span class="text-blue-600 font-bold">${ans}</span>` : '<span class="text-slate-400">-</span>';
      }
    } else if (qType === 'pgComplex') {
      const selectedList = Array.isArray(ans) ? ans : [];
      window.ASAS_MODELS.PG_OPTIONS.forEach(opt => {
        const btn = document.getElementById(`opt-btn-${num}-${opt}`);
        if (btn) {
          if (selectedList.includes(opt)) {
            btn.className = 'option-btn flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all bg-purple-600 text-white border-purple-600 shadow-sm scale-105';
          } else {
            btn.className = 'option-btn flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all bg-white text-slate-700 border-slate-200 hover:border-purple-400 hover:bg-purple-50/50';
          }
        }
      });
      if (statusLabel) {
        statusLabel.innerHTML = selectedList.length > 0 ? `<span class="text-purple-600 font-bold">[${selectedList.join(',')}]</span>` : '<span class="text-slate-400">-</span>';
      }
    } else if (qType === 'trueFalse') {
      const btnB = document.getElementById(`opt-btn-${num}-B`);
      const btnS = document.getElementById(`opt-btn-${num}-S`);
      if (btnB) {
        btnB.className = `option-btn flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${ans === 'B' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm scale-105' : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50'}`;
      }
      if (btnS) {
        btnS.className = `option-btn flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${ans === 'S' ? 'bg-amber-600 text-white border-amber-600 shadow-sm scale-105' : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50/50'}`;
      }
      if (statusLabel) {
        statusLabel.innerHTML = ans ? `<span class="text-emerald-700 font-bold">${ans}</span>` : '<span class="text-slate-400">-</span>';
      }
    }
  }

  function setStudentSingle(num, opt) {
    if (state.studentForm.answers[num] === opt) {
      delete state.studentForm.answers[num];
    } else {
      state.studentForm.answers[num] = opt;
    }
    const inputEl = document.getElementById(`q-key-${num}`);
    if (inputEl) inputEl.value = state.studentForm.answers[num] || '';
    updateQuestionCardUI(num);
    updateLiveScorePreview();
  }

  function toggleStudentComplex(num, opt) {
    const current = Array.isArray(state.studentForm.answers[num]) ? [...state.studentForm.answers[num]] : [];
    const idx = current.indexOf(opt);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(opt);
      current.sort();
    }
    if (current.length === 0) {
      delete state.studentForm.answers[num];
    } else {
      state.studentForm.answers[num] = current;
    }
    const inputEl = document.getElementById(`q-key-${num}`);
    if (inputEl) inputEl.value = (state.studentForm.answers[num] || []).join('');
    updateQuestionCardUI(num);
    updateLiveScorePreview();
  }

  function setStudentTrueFalse(num, opt) {
    if (state.studentForm.answers[num] === opt) {
      delete state.studentForm.answers[num];
    } else {
      state.studentForm.answers[num] = opt;
    }
    const inputEl = document.getElementById(`q-key-${num}`);
    if (inputEl) inputEl.value = state.studentForm.answers[num] || '';
    updateQuestionCardUI(num);
    updateLiveScorePreview();
  }

  function applyQuickPasteToStudent() {
    const inputEl = document.getElementById('quick-paste-student-input');
    if (!inputEl) return;

    const raw = inputEl.value.trim();
    if (!raw) {
      showToast('Tempelkan string jawaban siswa terlebih dahulu!', 'warning');
      inputEl.focus();
      return;
    }

    const structure = getSubjectStructure(state.selectedSubject);
    const tokens = parseAnswerTokens(raw);

    if (tokens.length === 0) {
      showToast('Format teks jawaban tidak dapat dibaca.', 'warning');
      return;
    }

    const mappedAnswers = mapTokensToAnswers(tokens, structure);
    state.studentForm.answers = mappedAnswers;
    renderStudentGradingTab();

    const filledCount = Object.keys(mappedAnswers).length;
    showToast(`Berhasil menerapkan ${filledCount} jawaban dari string teks!`, 'success');
  }

  function loadQuickPasteExampleForStudent() {
    const subjectType = state.selectedSubject;
    const inputEl = document.getElementById('quick-paste-student-input');
    if (!inputEl) return;

    if (subjectType === 'eksak') {
      inputEl.value = 'A B C D E A C B D A AC BD ABE CD ADE BC AB CE ACD BE B S B B S S B S B B';
    } else {
      inputEl.value = 'A B C D E A B C D E B C A D E A B D C E AB BD ACE CD BCD AE BE AC CDE ABD B S B S B B S S B S';
    }
    showToast('Format contoh berhasil dimuat ke kotak quick paste.', 'info');
  }

  function loadQuickPasteExampleForKey() {
    const subjectType = state.keyForm.subjectType;
    const inputEl = document.getElementById('quick-paste-key-input');
    if (!inputEl) return;

    if (subjectType === 'eksak') {
      inputEl.value = 'A B C D E A C B D A AC BD ABE CD ADE BC AB CE ACD BE B S B B S S B S B B';
    } else {
      inputEl.value = 'A B C D E A B C D E B C A D E A B D C E AB BD ACE CD BCD AE BE AC CDE ABD B S B S B B S S B S';
    }
    showToast('Format contoh kunci berhasil dimuat.', 'info');
  }

  function updateLiveScorePreview() {
    const subjectType = state.selectedSubject;
    const structure = getSubjectStructure(subjectType);
    const keyData = window.StorageManager.getAnswerKeyFor(subjectType);

    const mockStudent = {
      name: state.studentForm.name || 'Pratinjau',
      code: state.studentForm.code || '-',
      subjectType: subjectType,
      answers: state.studentForm.answers
    };

    const graded = scoringEngine.gradeStudent(mockStudent, keyData, structure);

    const elFinal = document.getElementById('live-final-score');
    const elPercent = document.getElementById('live-score-percent');
    const elStatus = document.getElementById('live-score-status');
    const elBreakdown = document.getElementById('live-score-breakdown');

    if (elFinal) elFinal.innerText = graded.finalScore;
    if (elPercent) elPercent.innerText = `${graded.totalEarned} / ${graded.totalMaxWeight} Poin`;
    
    if (elStatus) {
      if (graded.isPassed) {
        elStatus.className = 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200';
        elStatus.innerText = `LULUS KKM (${graded.grade})`;
      } else {
        elStatus.className = 'px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200';
        elStatus.innerText = `REMEDIAL (${graded.grade})`;
      }
    }

    if (elBreakdown) {
      elBreakdown.innerHTML = `
        <div class="flex justify-between text-xs text-slate-600 py-1 border-b border-slate-100">
          <span>PG Sederhana:</span>
          <span class="font-bold text-slate-800">${graded.breakdown.pgSingle.correct}/${graded.breakdown.pgSingle.count} Benar (${graded.breakdown.pgSingle.earned} Poin)</span>
        </div>
        <div class="flex justify-between text-xs text-slate-600 py-1 border-b border-slate-100">
          <span>PG Kompleks:</span>
          <span class="font-bold text-slate-800">${graded.breakdown.pgComplex.correct} Benar, ${graded.breakdown.pgComplex.partial} Parsial (${graded.breakdown.pgComplex.earned.toFixed(1)} Poin)</span>
        </div>
        <div class="flex justify-between text-xs text-slate-600 py-1">
          <span>Benar / Salah:</span>
          <span class="font-bold text-slate-800">${graded.breakdown.trueFalse.correct}/${graded.breakdown.trueFalse.count} Benar (${graded.breakdown.trueFalse.earned} Poin)</span>
        </div>
      `;
    }
  }

  function saveStudentGrading() {
    const elName = document.getElementById('student-name');
    const elCode = document.getElementById('student-code');

    const name = elName ? elName.value.trim() : '';
    const code = elCode ? elCode.value.trim() : '';

    if (!name) {
      showToast('Harap masukkan Nama Siswa terlebih dahulu!', 'warning');
      if (elName) elName.focus();
      return;
    }

    const subjectType = state.selectedSubject;
    const structure = getSubjectStructure(subjectType);
    const keyData = window.StorageManager.getAnswerKeyFor(subjectType);

    const studentRecord = {
      id: state.editingStudentId || ('std_' + Date.now()),
      name: name,
      code: code || ('PES-' + Math.floor(100 + Math.random() * 900)),
      subjectType: subjectType,
      answers: JSON.parse(JSON.stringify(state.studentForm.answers)),
      gradedAt: new Date().toISOString()
    };

    const gradedResult = scoringEngine.gradeStudent(studentRecord, keyData, structure);

    const completeData = {
      ...studentRecord,
      result: gradedResult
    };

    const saved = window.StorageManager.saveStudent(completeData);
    if (saved) {
      showToast(`Nilai "${name}" tersimpan! (Skor: ${gradedResult.finalScore}). Siap siswa berikutnya.`, 'success');
      resetStudentForm();
      renderRecapTable();
      updateRecapStats();

      if (elName) {
        elName.focus();
        elName.select();
      }
    } else {
      showToast('Gagal menyimpan nilai ke LocalStorage.', 'danger');
    }
  }

  function resetStudentForm() {
    state.editingStudentId = null;
    state.studentForm = {
      name: '',
      code: '',
      answers: {}
    };

    const elName = document.getElementById('student-name');
    const elCode = document.getElementById('student-code');
    const pasteInput = document.getElementById('quick-paste-student-input');

    if (elName) elName.value = '';
    if (elCode) elCode.value = '';
    if (pasteInput) pasteInput.value = '';

    renderStudentGradingTab();
  }

  function simulateRandomStudentAnswers() {
    const structure = getSubjectStructure(state.selectedSubject);
    const simulatedAnswers = {};

    for (let num = 1; num <= structure.totalQuestions; num++) {
      const qType = structure.getQuestionType(num);
      if (qType === 'pgSingle') {
        simulatedAnswers[num] = window.ASAS_MODELS.PG_OPTIONS[Math.floor(Math.random() * 5)];
      } else if (qType === 'pgComplex') {
        const count = 1 + Math.floor(Math.random() * 3);
        const shuffled = [...window.ASAS_MODELS.PG_OPTIONS].sort(() => 0.5 - Math.random());
        simulatedAnswers[num] = shuffled.slice(0, count).sort();
      } else if (qType === 'trueFalse') {
        simulatedAnswers[num] = Math.random() > 0.5 ? 'B' : 'S';
      }
    }

    state.studentForm.answers = simulatedAnswers;
    if (!state.studentForm.name) {
      const mockNames = ['Zahra Putri Lestari', 'Dimas Prasetyo', 'Nurul Hidayah', 'Reza Firmansyah', 'Salsabila Amanda'];
      state.studentForm.name = mockNames[Math.floor(Math.random() * mockNames.length)];
      state.studentForm.code = 'ASAS-' + Math.floor(1000 + Math.random() * 9000);
    }

    renderStudentGradingTab();
    showToast('Jawaban simulasi acak berhasil diisikan ke form!', 'info');
  }

  // =========================================================================
  // TAB BATCH: INPUT BORONGAN BANYAK SISWA DARI EXCEL / SPREADSHEET
  // =========================================================================

  function renderBatchTab() {
    const subjectType = state.batchData.selectedSubject;
    const structure = getSubjectStructure(subjectType);

    const btnEksak = document.getElementById('batch-toggle-eksak');
    const btnNonEksak = document.getElementById('batch-toggle-non-eksak');
    if (btnEksak && btnNonEksak) {
      if (subjectType === 'eksak') {
        btnEksak.className = 'px-4 py-2 text-sm font-bold rounded-lg bg-indigo-600 text-white shadow-md transition';
        btnNonEksak.className = 'px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
      } else {
        btnNonEksak.className = 'px-4 py-2 text-sm font-bold rounded-lg bg-indigo-600 text-white shadow-md transition';
        btnEksak.className = 'px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
      }
    }

    const infoEl = document.getElementById('batch-target-info');
    if (infoEl) {
      infoEl.innerText = `${structure.title} (${structure.totalQuestions} Butir Soal)`;
    }

    previewBatchImport();
  }

  function setBatchSubject(type) {
    state.batchData.selectedSubject = type;
    renderBatchTab();
  }

  function parseBatchRows(rawText, subjectType) {
    if (!rawText || !rawText.trim()) return [];

    const structure = getSubjectStructure(subjectType);
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed = [];

    lines.forEach((line, idx) => {
      if (/^(Nama|No|Nomor|Name|Student)\b/i.test(line)) {
        return;
      }

      let name = '';
      let code = '';
      let rawAnswers = '';

      if (line.includes('\t')) {
        const parts = line.split('\t');
        name = parts[0].trim();
        code = parts.length > 2 ? parts[1].trim() : `PES-${idx + 1}`;
        const rest = parts.length > 2 ? parts.slice(2) : parts.slice(1);
        rawAnswers = rest.join(' ');
      } else if (line.includes(';') || line.includes('|')) {
        const parts = line.split(/[;|]/);
        name = parts[0].trim();
        code = parts.length > 2 ? parts[1].trim() : `PES-${idx + 1}`;
        rawAnswers = parts.slice(parts.length > 2 ? 2 : 1).join(' ');
      } else {
        const spaceParts = line.split(/\s{2,}|\t/);
        if (spaceParts.length >= 2) {
          name = spaceParts[0].trim();
          code = `PES-${idx + 1}`;
          rawAnswers = spaceParts.slice(1).join(' ');
        } else {
          name = `Siswa ${idx + 1}`;
          code = `PES-${idx + 1}`;
          rawAnswers = line;
        }
      }

      const tokens = parseAnswerTokens(rawAnswers);
      const mapped = mapTokensToAnswers(tokens, structure);
      const answeredCount = Object.keys(mapped).length;

      parsed.push({
        name: name || `Siswa ${idx + 1}`,
        code: code || `PES-${idx + 1}`,
        rawAnswers: rawAnswers,
        answers: mapped,
        answeredCount: answeredCount,
        totalQuestions: structure.totalQuestions,
        isComplete: answeredCount >= structure.totalQuestions
      });
    });

    return parsed;
  }

  function previewBatchImport() {
    const textarea = document.getElementById('batch-textarea');
    const tableBody = document.getElementById('batch-preview-table-body');
    const summaryEl = document.getElementById('batch-preview-summary');
    const saveBtn = document.getElementById('btn-save-batch');

    if (!textarea || !tableBody) return;

    const rawText = textarea.value;
    state.batchData.rawText = rawText;
    const subjectType = state.batchData.selectedSubject;
    const structure = getSubjectStructure(subjectType);
    const keyData = window.StorageManager.getAnswerKeyFor(subjectType);

    const students = parseBatchRows(rawText, subjectType);
    state.batchData.parsedStudents = students;

    if (students.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="py-8 text-center text-slate-400 text-xs">
            Tempelkan data tabel siswa di atas untuk melihat pratinjau kalkulasi nilai secara langsung.
          </td>
        </tr>
      `;
      if (summaryEl) summaryEl.innerHTML = 'Belum ada data terdeteksi.';
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      saveBtn.innerText = `🚀 Simpan & Koreksi Semua (${students.length}) Siswa Sekaligus`;
    }

    let completeCount = 0;
    let html = '';

    students.forEach((st, idx) => {
      if (st.isComplete) completeCount++;
      const graded = scoringEngine.gradeStudent(st, keyData, structure);
      st.result = graded;

      const badgeCompleteness = st.answeredCount >= structure.totalQuestions
        ? `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">Lengkap (${st.answeredCount}/${structure.totalQuestions})</span>`
        : `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">${st.answeredCount}/${structure.totalQuestions} Soal</span>`;

      const badgeStatus = graded.isPassed
        ? `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">TUNTAS (${graded.grade})</span>`
        : `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">REMEDIAL (${graded.grade})</span>`;

      html += `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100 text-xs">
          <td class="py-2.5 px-3 text-slate-500 font-medium">${idx + 1}</td>
          <td class="py-2.5 px-3 font-mono text-slate-700">${st.code}</td>
          <td class="py-2.5 px-3 font-bold text-slate-900">${st.name}</td>
          <td class="py-2.5 px-3">${badgeCompleteness}</td>
          <td class="py-2.5 px-3 text-center text-slate-600">
            PG: <strong class="text-blue-600">${graded.breakdown.pgSingle.correct}</strong> | 
            PGK: <strong class="text-purple-600">${graded.breakdown.pgComplex.earned.toFixed(1)}</strong> | 
            B/S: <strong class="text-emerald-600">${graded.breakdown.trueFalse.correct}</strong>
          </td>
          <td class="py-2.5 px-3 text-center font-black text-sm ${graded.isPassed ? 'text-emerald-600' : 'text-rose-600'}">
            ${graded.finalScore}
          </td>
          <td class="py-2.5 px-3 text-center">${badgeStatus}</td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
    if (summaryEl) {
      summaryEl.innerHTML = `Terdeteksi <strong>${students.length} siswa</strong> (${completeCount} lengkap, ${students.length - completeCount} kurang).`;
    }
  }

  function saveBatchImport() {
    const students = state.batchData.parsedStudents;
    if (!students || students.length === 0) {
      showToast('Tidak ada data siswa untuk diimpor!', 'warning');
      return;
    }

    const subjectType = state.batchData.selectedSubject;
    const structure = getSubjectStructure(subjectType);
    const keyData = window.StorageManager.getAnswerKeyFor(subjectType);

    let savedCount = 0;
    students.forEach(st => {
      const studentRecord = {
        id: 'std_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        name: st.name,
        code: st.code,
        subjectType: subjectType,
        answers: st.answers,
        gradedAt: new Date().toISOString()
      };

      const gradedResult = scoringEngine.gradeStudent(studentRecord, keyData, structure);
      studentRecord.result = gradedResult;

      window.StorageManager.saveStudent(studentRecord);
      savedCount++;
    });

    showToast(`Berhasil mengimpor dan mengoreksi ${savedCount} siswa sekaligus!`, 'success');

    const textarea = document.getElementById('batch-textarea');
    if (textarea) textarea.value = '';
    state.batchData.rawText = '';
    state.batchData.parsedStudents = [];

    renderRecapTable();
    updateRecapStats();
    switchTab('rekap');
  }

  function loadSampleBatchText(subjectType) {
    const textarea = document.getElementById('batch-textarea');
    if (!textarea) return;

    if (subjectType === 'eksak') {
      textarea.value = [
        "Ahmad Faiz Al-Ghifari\tASAS-001\tA B C D E A C B D A AC BD ABE CD ADE BC AB CE ACD BE B S B B S S B S B B",
        "Beatrix Nabila Putri\tASAS-002\tA B C A E A D B D A A BD AB CD AD BC AC CE AD BE B S S B S S B S B S",
        "Chandra Wicaksono\tASAS-003\tB B A D C A C A B D AB AD A AB B C A E B C S B S S B B S B S S",
        "Dinda Ayu Paramitha\tASAS-004\tA B C D E A C B D A AC BD ABE CD ADE BC AB CE ACD BE B S B B S S B S B B",
        "Eko Prasetyo Utomo\tASAS-005\tA B C D A A C B D A AC B ABE CD ADE B AB CE ACD BE B S B S S S B S B S"
      ].join('\n');
    } else {
      textarea.value = [
        "Ahmad Faiz Al-Ghifari\tASAS-001\tA B C D E A B C D E B C A D E A B D C E AB BD ACE CD BCD AE BE AC CDE ABD B S B S B B S S B S",
        "Beatrix Nabila Putri\tASAS-002\tA B C D E A B C D E B C A D E A B D C E AB BD ACE CD BCD AE BE AC CDE ABD B S B S B B S S B S",
        "Chandra Wicaksono\tASAS-003\tA A C D E B B C D E A C A D E B B D C E AB B ACE CD BC AE BE AC CD ABD B S S S B B S S B S",
        "Dinda Ayu Paramitha\tASAS-004\tA B C D E A B C D E B C A D E A B D C E AB BD ACE CD BCD AE BE AC CDE ABD B S B S B B S S B S"
      ].join('\n');
    }

    state.batchData.selectedSubject = subjectType;
    renderBatchTab();
    showToast('Data contoh batch berhasil dimuat!', 'info');
  }

  function clearBatchText() {
    const textarea = document.getElementById('batch-textarea');
    if (textarea) textarea.value = '';
    state.batchData.rawText = '';
    state.batchData.parsedStudents = [];
    previewBatchImport();
    showToast('Teks data borongan dibersihkan.', 'info');
  }

  // =========================================================================
  // TAB 3: REKAPITULASI & HASIL (TABEL, SEARCH, FILTER, EXPORT)
  // =========================================================================

  function renderRecapTable() {
    const tableBody = document.getElementById('recap-table-body');
    if (!tableBody) return;

    let students = window.StorageManager.getStudents();
    const keyDataEksak = window.StorageManager.getAnswerKeyFor('eksak');
    const keyDataNonEksak = window.StorageManager.getAnswerKeyFor('non_eksak');

    students = students.map(st => {
      if (!st.result) {
        const struct = getSubjectStructure(st.subjectType || 'eksak');
        const key = (st.subjectType === 'non_eksak') ? keyDataNonEksak : keyDataEksak;
        st.result = scoringEngine.gradeStudent(st, key, struct);
      }
      return st;
    });

    const search = state.filters.search.toLowerCase().trim();
    const filterStatus = state.filters.status;
    const filterSubject = state.filters.subject;

    const filtered = students.filter(st => {
      const matchSearch = (!search || st.name.toLowerCase().includes(search) || (st.code && st.code.toLowerCase().includes(search)));
      const matchStatus = (filterStatus === 'all' || (filterStatus === 'passed' && st.result.isPassed) || (filterStatus === 'remedial' && !st.result.isPassed));
      const matchSubject = (filterSubject === 'all' || st.subjectType === filterSubject);
      return matchSearch && matchStatus && matchSubject;
    });

    updateRecapStats(students);

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="10" class="py-12 text-center text-slate-400">
            <div class="flex flex-col items-center justify-center">
              <span class="text-4xl mb-2">📋</span>
              <p class="text-base font-semibold text-slate-600">Belum ada data siswa yang cocok</p>
              <p class="text-xs text-slate-400 mt-1">Gunakan formulir koreksi atau impor borongan untuk menilai lembar jawaban siswa.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    filtered.forEach((st, idx) => {
      const res = st.result;
      const badgeStatus = res.isPassed 
        ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">TUNTAS (${res.grade})</span>`
        : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">REMEDIAL (${res.grade})</span>`;

      html += `
        <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
          <td class="py-3 px-4 text-xs font-medium text-slate-500">${idx + 1}</td>
          <td class="py-3 px-4 text-xs font-mono font-semibold text-slate-700">${st.code || '-'}</td>
          <td class="py-3 px-4">
            <div class="text-sm font-bold text-slate-900">${st.name}</div>
            <div class="text-[11px] text-slate-400">Waktu: ${new Date(st.gradedAt || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
          </td>
          <td class="py-3 px-4">
            ${formatSubjectBadge(st.subjectType)}
          </td>
          <td class="py-3 px-4 text-xs text-slate-700 text-center font-medium">
            <span class="text-blue-600 font-bold">${res.breakdown.pgSingle.correct}</span> / ${res.breakdown.pgSingle.count}
          </td>
          <td class="py-3 px-4 text-xs text-slate-700 text-center font-medium">
            <span class="text-purple-600 font-bold">${res.breakdown.pgComplex.earned.toFixed(1)}</span> / ${res.breakdown.pgComplex.count}
          </td>
          <td class="py-3 px-4 text-xs text-slate-700 text-center font-medium">
            <span class="text-emerald-600 font-bold">${res.breakdown.trueFalse.correct}</span> / ${res.breakdown.trueFalse.count}
          </td>
          <td class="py-3 px-4 text-center">
            <span class="text-base font-black ${res.isPassed ? 'text-emerald-600' : 'text-rose-600'}">
              ${res.finalScore}
            </span>
          </td>
          <td class="py-3 px-4 text-center">
            ${badgeStatus}
          </td>
          <td class="py-3 px-4 text-right whitespace-nowrap">
            <button type="button" 
              onclick="window.ASAS_APP.viewStudentDetail('${st.id}')"
              title="Lihat Lembar Jawaban & Analisis"
              class="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition mr-1">
              👁️ Rincian
            </button>
            <button type="button" 
              onclick="window.ASAS_APP.editStudent('${st.id}')"
              title="Edit Data Siswa"
              class="p-1.5 text-amber-600 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition mr-1">
              ✏️ Edit
            </button>
            <button type="button" 
              onclick="window.ASAS_APP.deleteStudent('${st.id}')"
              title="Hapus Siswa"
              class="p-1.5 text-rose-600 hover:text-rose-900 hover:bg-rose-50 rounded-lg transition">
              🗑️
            </button>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  }

  function updateRecapStats(studentsList) {
    const students = studentsList || window.StorageManager.getStudents();
    
    const count = students.length;
    let sumScore = 0;
    let highest = 0;
    let lowest = count > 0 ? 100 : 0;
    let passedCount = 0;

    students.forEach(st => {
      const score = st.result ? st.result.finalScore : 0;
      sumScore += score;
      if (score > highest) highest = score;
      if (score < lowest) lowest = score;
      if (st.result && st.result.isPassed) passedCount++;
    });

    const avg = count > 0 ? (sumScore / count).toFixed(1) : 0;
    const passRate = count > 0 ? ((passedCount / count) * 100).toFixed(1) : 0;

    const elTotal = document.getElementById('stat-total-students');
    const elAvg = document.getElementById('stat-average-score');
    const elHigh = document.getElementById('stat-highest-score');
    const elLow = document.getElementById('stat-lowest-score');
    const elRate = document.getElementById('stat-pass-rate');

    if (elTotal) elTotal.innerText = count;
    if (elAvg) elAvg.innerText = avg;
    if (elHigh) elHigh.innerText = count > 0 ? highest : '-';
    if (elLow) elLow.innerText = count > 0 ? lowest : '-';
    if (elRate) elRate.innerText = `${passRate}% (${passedCount}/${count})`;
  }

  function viewStudentDetail(studentId) {
    const students = window.StorageManager.getStudents();
    const st = students.find(s => s.id === studentId);
    if (!st) return;

    const modal = document.getElementById('student-detail-modal');
    const content = document.getElementById('student-detail-content');
    if (!modal || !content) return;

    const res = st.result;
    const structure = getSubjectStructure(st.subjectType);

    let questionsHtml = '';
    res.questionsDetail.forEach(q => {
      let statusBadge = '';
      let borderClass = 'border-slate-200';

      if (q.status === 'correct') {
        statusBadge = '<span class="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Benar (+'+ q.earned +')</span>';
        borderClass = 'border-emerald-300 bg-emerald-50/30';
      } else if (q.status === 'partial') {
        statusBadge = '<span class="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Parsial (+'+ q.earned.toFixed(2) +')</span>';
        borderClass = 'border-amber-300 bg-amber-50/30';
      } else if (q.status === 'empty') {
        statusBadge = '<span class="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Kosong (0)</span>';
      } else {
        statusBadge = '<span class="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">Salah (0)</span>';
        borderClass = 'border-rose-300 bg-rose-50/30';
      }

      const formatAnswer = (val) => {
        if (!val || (Array.isArray(val) && val.length === 0)) return '<span class="text-slate-400 italic">Tidak dijawab</span>';
        if (Array.isArray(val)) return `<strong>[ ${val.join(', ')} ]</strong>`;
        return `<strong>${val}</strong>`;
      };

      questionsHtml += `
        <div class="border ${borderClass} rounded-xl p-3 flex flex-col justify-between">
          <div class="flex items-center justify-between mb-2">
            <span class="font-bold text-xs text-slate-700">No. ${q.number} (${q.type === 'pgSingle' ? 'PG' : q.type === 'pgComplex' ? 'PGK' : 'B/S'})</span>
            ${statusBadge}
          </div>
          <div class="text-xs space-y-1">
            <div class="flex justify-between">
              <span class="text-slate-500">Jawaban Siswa:</span>
              <span>${formatAnswer(q.studentAnswer)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Kunci Jawaban:</span>
              <span class="text-indigo-600">${formatAnswer(q.keyAnswer)}</span>
            </div>
          </div>
        </div>
      `;
    });

    content.innerHTML = `
      <div class="bg-gradient-to-r from-indigo-700 to-blue-600 text-white p-6 rounded-t-2xl">
        <div class="flex justify-between items-start">
          <div>
            <div class="text-xs uppercase tracking-wider text-indigo-200 font-bold mb-1">Rincian Koreksi Asesmen Siswa</div>
            <h2 class="text-2xl font-black">${st.name}</h2>
            <p class="text-sm text-indigo-100 mt-1">Nomor Peserta: ${st.code} | ${structure.title}</p>
          </div>
          <div class="text-right">
            <div class="text-3xl font-black">${res.finalScore}</div>
            <div class="text-xs font-semibold px-2.5 py-1 rounded-full ${res.isPassed ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'} inline-block mt-1">
              ${res.statusText} (${res.grade})
            </div>
          </div>
        </div>
      </div>

      <div class="p-6 overflow-y-auto max-h-[70vh]">
        <!-- Ringkasan Nilai Komponen -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div class="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-center">
            <div class="text-xs font-semibold text-blue-700">PG Sederhana</div>
            <div class="text-lg font-bold text-blue-900 mt-0.5">${res.breakdown.pgSingle.correct} / ${res.breakdown.pgSingle.count} Benar</div>
            <div class="text-xs text-blue-600">${res.breakdown.pgSingle.earned} Poin</div>
          </div>
          <div class="bg-purple-50 border border-purple-200 rounded-xl p-3.5 text-center">
            <div class="text-xs font-semibold text-purple-700">PG Kompleks (MCMA)</div>
            <div class="text-lg font-bold text-purple-900 mt-0.5">${res.breakdown.pgComplex.correct} Benar, ${res.breakdown.pgComplex.partial} Parsial</div>
            <div class="text-xs text-purple-600">${res.breakdown.pgComplex.earned.toFixed(2)} Poin</div>
          </div>
          <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-center">
            <div class="text-xs font-semibold text-emerald-700">Benar / Salah</div>
            <div class="text-lg font-bold text-emerald-900 mt-0.5">${res.breakdown.trueFalse.correct} / ${res.breakdown.trueFalse.count} Benar</div>
            <div class="text-xs text-emerald-600">${res.breakdown.trueFalse.earned} Poin</div>
          </div>
        </div>

        <h4 class="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
          <span>Rincian Per Butir Soal</span>
          <span class="text-xs text-slate-500 font-normal">Total ${structure.totalQuestions} Soal</span>
        </h4>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          ${questionsHtml}
        </div>
      </div>

      <div class="bg-slate-50 px-6 py-4 rounded-b-2xl border-t border-slate-200 flex justify-between items-center">
        <button type="button" 
          onclick="window.print()" 
          class="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition flex items-center gap-1.5">
          🖨️ Cetak Lembar Ini
        </button>
        <button type="button" 
          onclick="window.ASAS_APP.closeModal('student-detail-modal')"
          class="px-5 py-2 text-xs font-bold text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition">
          Tutup
        </button>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function editStudent(studentId) {
    const students = window.StorageManager.getStudents();
    const st = students.find(s => s.id === studentId);
    if (!st) return;

    state.editingStudentId = st.id;
    state.selectedSubject = st.subjectType || 'eksak';
    state.studentForm = {
      name: st.name,
      code: st.code,
      answers: JSON.parse(JSON.stringify(st.answers || {}))
    };

    switchTab('koreksi');
    showToast(`Memuat data siswa "${st.name}" untuk diedit.`, 'info');
  }

  function deleteStudent(studentId) {
    const students = window.StorageManager.getStudents();
    const st = students.find(s => s.id === studentId);
    if (!st) return;

    if (confirm(`Apakah Anda yakin ingin menghapus nilai siswa "${st.name}"?`)) {
      window.StorageManager.deleteStudent(studentId);
      showToast('Data siswa berhasil dihapus.', 'info');
      renderRecapTable();
      updateRecapStats();
    }
  }

  function clearAllStudentsData() {
    if (confirm('PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA data nilai siswa? Tindakan ini tidak dapat dibatalkan.')) {
      window.StorageManager.clearAllStudents();
      showToast('Seluruh data nilai siswa telah dikosongkan.', 'warning');
      renderRecapTable();
      updateRecapStats();
    }
  }

  function recalculateAllStudents(subjectTypeFilter) {
    const students = window.StorageManager.getStudents();
    const keyDataEksak = window.StorageManager.getAnswerKeyFor('eksak');
    const keyDataNonEksak = window.StorageManager.getAnswerKeyFor('non_eksak');

    let updatedCount = 0;
    const updated = students.map(st => {
      if (!subjectTypeFilter || st.subjectType === subjectTypeFilter) {
        const struct = getSubjectStructure(st.subjectType || 'eksak');
        const key = (st.subjectType === 'non_eksak') ? keyDataNonEksak : keyDataEksak;
        st.result = scoringEngine.gradeStudent(st, key, struct);
        updatedCount++;
      }
      return st;
    });

    localStorage.setItem('asas_grader_students_v1', JSON.stringify(updated));
    showToast(`Berhasil menghitung ulang nilai ${updatedCount} siswa!`, 'success');
    renderRecapTable();
    updateRecapStats();
  }

  function exportRecapToCSV() {
    const students = window.StorageManager.getStudents();
    if (students.length === 0) {
      showToast('Tidak ada data siswa untuk diekspor!', 'warning');
      return;
    }

    const headers = [
      'No',
      'Nomor Peserta',
      'Nama Siswa',
      'Jenis Mapel',
      'Benar PG Sederhana',
      'Total PG Sederhana',
      'Poin PG Kompleks',
      'Total PG Kompleks',
      'Benar B-S',
      'Total B-S',
      'Total Skor Diperoleh',
      'Maksimal Poin',
      'Nilai Akhir (Skala 100)',
      'Predikat',
      'Status KKM',
      'Waktu Koreksi'
    ];

    const rows = students.map((st, idx) => {
      const res = st.result || {};
      const b = res.breakdown || {};
      return [
        idx + 1,
        `"${st.code || '-'}"`,
        `"${st.name.replace(/"/g, '""')}"`,
        st.subjectType === 'eksak' ? 'Eksak (30 Soal)' : 'Non-Eksak (40 Soal)',
        b.pgSingle ? b.pgSingle.correct : 0,
        b.pgSingle ? b.pgSingle.count : 0,
        b.pgComplex ? b.pgComplex.earned.toFixed(2) : 0,
        b.pgComplex ? b.pgComplex.count : 0,
        b.trueFalse ? b.trueFalse.correct : 0,
        b.trueFalse ? b.trueFalse.count : 0,
        res.totalEarned || 0,
        res.totalMaxWeight || 0,
        res.finalScore || 0,
        res.grade || '-',
        res.statusText || '-',
        `"${new Date(st.gradedAt || Date.now()).toLocaleString('id-ID')}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rekap_Nilai_ASAS_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('File CSV berhasil diunduh untuk Microsoft Excel!', 'success');
  }

  // =========================================================================
  // TAB 4: ANALISIS BUTIR SOAL
  // =========================================================================

  function renderItemAnalysisTab() {
    const container = document.getElementById('item-analysis-container');
    if (!container) return;

    const subjectType = state.selectedSubject;
    const structure = getSubjectStructure(subjectType);
    const students = window.StorageManager.getStudents().filter(s => s.subjectType === subjectType);

    const totalStudents = students.length;
    if (totalStudents === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <span class="text-4xl mb-2">📊</span>
          <h3 class="text-lg font-bold text-slate-800">Belum Ada Data Siswa pada Mapel Ini</h3>
          <p class="text-xs text-slate-500 mt-1">Lakukan penilaian beberapa siswa untuk melihat statistik dan analisis butir soal.</p>
        </div>
      `;
      return;
    }

    const stats = {};
    for (let num = 1; num <= structure.totalQuestions; num++) {
      stats[num] = {
        number: num,
        type: structure.getQuestionType(num),
        correctCount: 0,
        partialCount: 0,
        wrongCount: 0,
        totalPointsEarned: 0
      };
    }

    students.forEach(st => {
      if (st.result && st.result.questionsDetail) {
        st.result.questionsDetail.forEach(q => {
          if (stats[q.number]) {
            if (q.status === 'correct') stats[q.number].correctCount++;
            else if (q.status === 'partial') stats[q.number].partialCount++;
            else stats[q.number].wrongCount++;
            stats[q.number].totalPointsEarned += q.earned;
          }
        });
      }
    });

    let html = `
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h3 class="text-lg font-bold text-slate-900">Analisis Daya Serap & Tingkat Kesulitan Soal</h3>
            <p class="text-xs text-slate-500">Berdasarkan data ${totalStudents} siswa pada ${structure.title}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
              <span class="w-2 h-2 rounded-full bg-emerald-600"></span> Mudah (>70%)
            </span>
            <span class="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
              <span class="w-2 h-2 rounded-full bg-amber-600"></span> Sedang (40-70%)
            </span>
            <span class="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
              <span class="w-2 h-2 rounded-full bg-rose-600"></span> Sukar (<40%)
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
    `;

    for (let num = 1; num <= structure.totalQuestions; num++) {
      const item = stats[num];
      const correctPercent = Math.round((item.correctCount / totalStudents) * 100);

      let badgeColor = 'emerald';
      let labelTingkat = 'Mudah';
      if (correctPercent < 40) {
        badgeColor = 'rose';
        labelTingkat = 'Sukar';
      } else if (correctPercent <= 70) {
        badgeColor = 'amber';
        labelTingkat = 'Sedang';
      }

      html += `
        <div class="border border-slate-200 hover:border-indigo-300 rounded-xl p-4 bg-slate-50/50 transition">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs">
                ${num}
              </span>
              <span class="text-[11px] font-semibold text-slate-500 uppercase">${item.type === 'pgSingle' ? 'PG' : item.type === 'pgComplex' ? 'PGK' : 'B/S'}</span>
            </div>
            <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-${badgeColor}-100 text-${badgeColor}-700">
              ${labelTingkat}
            </span>
          </div>

          <div class="mt-2">
            <div class="flex justify-between text-xs font-bold mb-1">
              <span class="text-slate-600">Jawaban Benar:</span>
              <span class="text-slate-900">${correctPercent}% (${item.correctCount}/${totalStudents})</span>
            </div>
            <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div class="bg-${badgeColor}-500 h-2 rounded-full" style="width: ${correctPercent}%"></div>
            </div>
          </div>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  // =========================================================================
  // TAB 5: PENGATURAN SISTEM PENILAIAN
  // =========================================================================

  function renderSettingsTab() {
    const cfg = window.StorageManager.getScoringConfig();

    const elKkm = document.getElementById('cfg-kkm');
    const elMode = document.getElementById('cfg-pg-complex-mode');
    const elWeightPg = document.getElementById('cfg-weight-pg');
    const elWeightPgk = document.getElementById('cfg-weight-pgk');
    const elWeightTf = document.getElementById('cfg-weight-tf');

    if (elKkm) elKkm.value = cfg.kkm || 75;
    if (elMode) elMode.value = cfg.pgComplexScoringMode || 'partial_penalty';
    if (elWeightPg) elWeightPg.value = cfg.weights?.pgSingle || 1;
    if (elWeightPgk) elWeightPgk.value = cfg.weights?.pgComplex || 1;
    if (elWeightTf) elWeightTf.value = cfg.weights?.trueFalse || 1;
  }

  function saveSettings() {
    const elKkm = document.getElementById('cfg-kkm');
    const elMode = document.getElementById('cfg-pg-complex-mode');
    const elWeightPg = document.getElementById('cfg-weight-pg');
    const elWeightPgk = document.getElementById('cfg-weight-pgk');
    const elWeightTf = document.getElementById('cfg-weight-tf');

    const newConfig = {
      kkm: parseFloat(elKkm ? elKkm.value : 75) || 75,
      pgComplexScoringMode: elMode ? elMode.value : 'partial_penalty',
      weights: {
        pgSingle: parseFloat(elWeightPg ? elWeightPg.value : 1) || 1,
        pgComplex: parseFloat(elWeightPgk ? elWeightPgk.value : 1) || 1,
        trueFalse: parseFloat(elWeightTf ? elWeightTf.value : 1) || 1
      },
      roundingDigits: 2
    };

    window.StorageManager.saveScoringConfig(newConfig);
    scoringEngine.updateConfig(newConfig);

    showToast('Pengaturan sistem penilaian berhasil disimpan!', 'success');

    if (confirm('Apakah Anda ingin menghitung ulang seluruh nilai siswa dengan aturan penilaian terbaru ini?')) {
      recalculateAllStudents();
    }
  }

  function downloadBackupJSON() {
    const jsonStr = window.StorageManager.exportAllDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Backup_ASAS_Koreksi_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    showToast('Backup data JSON berhasil diunduh!', 'success');
  }

  function handleRestoreJSON(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const res = window.StorageManager.importBackupJSON(e.target.result);
      if (res.success) {
        showToast('Data berhasil dipulihkan dari cadangan!', 'success');
        setTimeout(() => location.reload(), 800);
      } else {
        showToast('Gagal memulihkan file: ' + res.error, 'danger');
      }
    };
    reader.readAsText(file);
  }

  // =========================================================================
  // GLOBAL KEYBOARD SHORTCUTS
  // =========================================================================

  function setupGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (state.activeTab === 'koreksi') {
          e.preventDefault();
          saveStudentGrading();
        }
      }
    });

    const nameInput = document.getElementById('student-name');
    if (nameInput) {
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const codeInput = document.getElementById('student-code');
          if (codeInput) {
            codeInput.focus();
            codeInput.select();
          }
        }
      });
    }

    const codeInput = document.getElementById('student-code');
    if (codeInput) {
      codeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          focusQuestionInput(1);
        }
      });
    }
  }

  // =========================================================================
  // INIT & GLOBAL REGISTRATION
  // =========================================================================

  function init() {
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
      });
    });

    const searchInput = document.getElementById('search-student');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.filters.search = e.target.value;
        renderRecapTable();
      });
    }

    const filterStatusSelect = document.getElementById('filter-status');
    if (filterStatusSelect) {
      filterStatusSelect.addEventListener('change', (e) => {
        state.filters.status = e.target.value;
        renderRecapTable();
      });
    }

    const filterSubjectSelect = document.getElementById('filter-subject');
    if (filterSubjectSelect) {
      filterSubjectSelect.addEventListener('change', (e) => {
        state.filters.subject = e.target.value;
        renderRecapTable();
      });
    }

    const batchTextarea = document.getElementById('batch-textarea');
    if (batchTextarea) {
      batchTextarea.addEventListener('input', () => {
        previewBatchImport();
      });
    }

    document.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-backdrop');
        if (modal) {
          modal.classList.add('hidden');
          modal.classList.remove('flex');
        }
      });
    });

    setupGlobalShortcuts();

    // Start on Default Tab
    switchTab('koreksi');
  }

  window.ASAS_APP = {
    init,
    switchTab,
    setSubject: (type) => {
      state.selectedSubject = type;
      window.StorageManager.setActiveSubject(type);
      if (state.activeTab === 'koreksi') renderStudentGradingTab();
      else if (state.activeTab === 'kunci') {
        loadKeyFormData(type);
        renderAnswerKeyTab();
      } else if (state.activeTab === 'analisis') renderItemAnalysisTab();
      else if (state.activeTab === 'batch') setBatchSubject(type);
    },
    // Kunci Actions
    setKeySingle,
    toggleKeyComplex,
    setKeyTrueFalse,
    saveKeyForm,
    applyQuickPasteToKey,
    loadSampleKeysForCurrentSubject,
    clearKeysForCurrentSubject,
    loadQuickPasteExampleForKey,
    // Koreksi Actions
    setStudentSingle,
    toggleStudentComplex,
    setStudentTrueFalse,
    saveStudentGrading,
    resetStudentForm,
    simulateRandomStudentAnswers,
    applyQuickPasteToStudent,
    loadQuickPasteExampleForStudent,
    // Keyboard Auto-Advance Handlers
    handleAutoKeydown,
    handleComplexInput,
    focusQuestionInput,
    // Batch Import Actions
    setBatchSubject,
    previewBatchImport,
    saveBatchImport,
    loadSampleBatchText,
    clearBatchText,
    // Rekap Actions
    viewStudentDetail,
    editStudent,
    deleteStudent,
    clearAllStudentsData,
    recalculateAllStudents,
    exportRecapToCSV,
    closeModal: (id) => {
      const modal = document.getElementById(id);
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
    },
    // Settings Actions
    saveSettings,
    downloadBackupJSON,
    handleRestoreJSON
  };

  document.addEventListener('DOMContentLoaded', init);

})();
