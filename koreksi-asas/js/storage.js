/**
 * storage.js
 * Modul Persistence LocalStorage untuk Aplikasi Koreksi ASAS.
 */

(function (window) {
  'use strict';

  const STORAGE_KEYS = {
    ANSWER_KEYS: 'asas_grader_answer_keys_v1',
    SCORING_CONFIG: 'asas_grader_config_v1',
    STUDENTS: 'asas_grader_students_v1',
    ACTIVE_SUBJECT: 'asas_grader_active_subject_v1'
  };

  class StorageManager {
    constructor() {
      this.initDefaults();
    }

    /**
     * Inisialisasi data awal jika belum tersedia di LocalStorage
     */
    initDefaults() {
      try {
        if (!localStorage.getItem(STORAGE_KEYS.ANSWER_KEYS)) {
          localStorage.setItem(
            STORAGE_KEYS.ANSWER_KEYS,
            JSON.stringify(window.ASAS_MODELS.DEFAULT_SAMPLE_KEYS)
          );
        }

        if (!localStorage.getItem(STORAGE_KEYS.SCORING_CONFIG)) {
          localStorage.setItem(
            STORAGE_KEYS.SCORING_CONFIG,
            JSON.stringify(window.DEFAULT_SCORING_CONFIG)
          );
        }

        if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
          localStorage.setItem(
            STORAGE_KEYS.STUDENTS,
            JSON.stringify(window.ASAS_MODELS.DEFAULT_SAMPLE_STUDENTS)
          );
        }

        if (!localStorage.getItem(STORAGE_KEYS.ACTIVE_SUBJECT)) {
          localStorage.setItem(STORAGE_KEYS.ACTIVE_SUBJECT, 'eksak');
        }
      } catch (e) {
        console.warn('LocalStorage error during init:', e);
      }
    }

    /**
     * Mengambil seluruh kunci jawaban (Eksak & Non-Eksak)
     */
    getAnswerKeys() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.ANSWER_KEYS);
        return raw ? JSON.parse(raw) : window.ASAS_MODELS.DEFAULT_SAMPLE_KEYS;
      } catch (e) {
        console.error('Failed to get answer keys:', e);
        return window.ASAS_MODELS.DEFAULT_SAMPLE_KEYS;
      }
    }

    /**
     * Mengambil kunci jawaban untuk jenis mapel tertentu ('eksak' | 'non_eksak')
     */
    getAnswerKeyFor(subjectType) {
      const keys = this.getAnswerKeys();
      return keys[subjectType] || window.ASAS_MODELS.DEFAULT_SAMPLE_KEYS[subjectType];
    }

    /**
     * Menyimpan pembaruan kunci jawaban
     */
    saveAnswerKey(subjectType, data) {
      try {
        const allKeys = this.getAnswerKeys();
        allKeys[subjectType] = {
          ...allKeys[subjectType],
          ...data,
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEYS.ANSWER_KEYS, JSON.stringify(allKeys));
        return true;
      } catch (e) {
        console.error('Failed to save answer key:', e);
        return false;
      }
    }

    /**
     * Mengambil konfigurasi sistem penilaian
     */
    getScoringConfig() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.SCORING_CONFIG);
        return raw ? JSON.parse(raw) : window.DEFAULT_SCORING_CONFIG;
      } catch (e) {
        return window.DEFAULT_SCORING_CONFIG;
      }
    }

    /**
     * Menyimpan konfigurasi sistem penilaian
     */
    saveScoringConfig(config) {
      try {
        localStorage.setItem(STORAGE_KEYS.SCORING_CONFIG, JSON.stringify(config));
        return true;
      } catch (e) {
        console.error('Failed to save scoring config:', e);
        return false;
      }
    }

    /**
     * Mengambil daftar seluruh siswa yang sudah dikoreksi
     */
    getStudents() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        console.error('Failed to get students:', e);
        return [];
      }
    }

    /**
     * Menyimpan satu data siswa (Insert atau Update)
     */
    saveStudent(studentData) {
      try {
        const students = this.getStudents();
        const existingIndex = students.findIndex(s => s.id === studentData.id);

        if (existingIndex >= 0) {
          students[existingIndex] = studentData;
        } else {
          // Tambahkan ke urutan paling atas
          students.unshift(studentData);
        }

        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
        return true;
      } catch (e) {
        console.error('Failed to save student:', e);
        return false;
      }
    }

    /**
     * Menghapus data siswa berdasarkan ID
     */
    deleteStudent(studentId) {
      try {
        let students = this.getStudents();
        students = students.filter(s => s.id !== studentId);
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
        return true;
      } catch (e) {
        console.error('Failed to delete student:', e);
        return false;
      }
    }

    /**
     * Menghapus seluruh data siswa
     */
    clearAllStudents() {
      try {
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify([]));
        return true;
      } catch (e) {
        return false;
      }
    }

    /**
     * Mengambil mapel aktif saat ini
     */
    getActiveSubject() {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_SUBJECT) || 'eksak';
    }

    /**
     * Mengatur mapel aktif saat ini
     */
    setActiveSubject(subjectType) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SUBJECT, subjectType);
    }

    /**
     * Ekspor seluruh data cadangan (Backup JSON)
     */
    exportAllDataJSON() {
      const backup = {
        app: 'Koreksi-ASAS',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        answerKeys: this.getAnswerKeys(),
        scoringConfig: this.getScoringConfig(),
        students: this.getStudents()
      };
      return JSON.stringify(backup, null, 2);
    }

    /**
     * Impor data dari file backup JSON
     */
    importBackupJSON(jsonString) {
      try {
        const data = JSON.parse(jsonString);
        if (data.answerKeys) localStorage.setItem(STORAGE_KEYS.ANSWER_KEYS, JSON.stringify(data.answerKeys));
        if (data.scoringConfig) localStorage.setItem(STORAGE_KEYS.SCORING_CONFIG, JSON.stringify(data.scoringConfig));
        if (data.students) localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(data.students));
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  }

  window.StorageManager = new StorageManager();

})(typeof window !== 'undefined' ? window : this);
