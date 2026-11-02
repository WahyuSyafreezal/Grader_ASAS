/**
 * models.js
 * Definisi Model Data, Struktur Soal, dan Konfigurasi Mata Pelajaran ASAS.
 */

(function (window) {
  'use strict';

  const SUBJECT_STRUCTURES = {
    eksak: {
      id: 'eksak',
      title: 'Mata Pelajaran Eksak (MIPA)',
      description: 'Matematika, Fisika, Kimia, Biologi, Informatika (Total 30 Soal)',
      totalQuestions: 30,
      sections: [
        {
          type: 'pgSingle',
          title: 'Bagian I: Pilihan Ganda Sederhana',
          subtitle: 'Pilihan Tunggal (A, B, C, D, E)',
          startNumber: 1,
          endNumber: 10,
          count: 10,
          badgeColor: 'blue'
        },
        {
          type: 'pgComplex',
          title: 'Bagian II: Pilihan Ganda Kompleks (MCMA)',
          subtitle: 'Pilihan Lebih Dari Satu (Checkbox A, B, C, D, E)',
          startNumber: 11,
          endNumber: 20,
          count: 10,
          badgeColor: 'purple'
        },
        {
          type: 'trueFalse',
          title: 'Bagian III: Benar / Salah',
          subtitle: 'Pernyataan Benar (B) atau Salah (S)',
          startNumber: 21,
          endNumber: 30,
          count: 10,
          badgeColor: 'emerald'
        }
      ],
      getQuestionType(num) {
        if (num >= 1 && num <= 10) return 'pgSingle';
        if (num >= 11 && num <= 20) return 'pgComplex';
        if (num >= 21 && num <= 30) return 'trueFalse';
        return null;
      }
    },

    non_eksak: {
      id: 'non_eksak',
      title: 'Mata Pelajaran Non-Eksak (Sosial & Bahasa)',
      description: 'Bahasa Indonesia, Bahasa Inggris, IPS, Sejarah, PPKn, dll (Total 40 Soal)',
      totalQuestions: 40,
      sections: [
        {
          type: 'pgSingle',
          title: 'Bagian I: Pilihan Ganda Sederhana',
          subtitle: 'Pilihan Tunggal (A, B, C, D, E)',
          startNumber: 1,
          endNumber: 20,
          count: 20,
          badgeColor: 'blue'
        },
        {
          type: 'pgComplex',
          title: 'Bagian II: Pilihan Ganda Kompleks (MCMA)',
          subtitle: 'Pilihan Lebih Dari Satu (Checkbox A, B, C, D, E)',
          startNumber: 21,
          endNumber: 30,
          count: 10,
          badgeColor: 'purple'
        },
        {
          type: 'trueFalse',
          title: 'Bagian III: Benar / Salah',
          subtitle: 'Pernyataan Benar (B) atau Salah (S)',
          startNumber: 31,
          endNumber: 40,
          count: 10,
          badgeColor: 'emerald'
        }
      ],
      getQuestionType(num) {
        if (num >= 1 && num <= 20) return 'pgSingle';
        if (num >= 21 && num <= 30) return 'pgComplex';
        if (num >= 31 && num <= 40) return 'trueFalse';
        return null;
      }
    }
  };

  const PG_OPTIONS = ['A', 'B', 'C', 'D', 'E'];
  const TF_OPTIONS = ['B', 'S'];

  // Data Kunci Jawaban Bawaan (Default Sample Keys) agar guru dapat langsung mencoba aplikasi
  const DEFAULT_SAMPLE_KEYS = {
    eksak: {
      subjectType: 'eksak',
      subjectName: 'Matematika Peminatan',
      className: 'XII MIPA 1',
      semester: 'Ganjil',
      academicYear: '2026/2027',
      teacherName: 'Drs. Budi Santoso, M.Pd.',
      updatedAt: new Date().toISOString(),
      answers: {
        // 1-10 PG Sederhana
        1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E',
        6: 'A', 7: 'C', 8: 'B', 9: 'D', 10: 'A',
        // 11-20 PG Kompleks (MCMA)
        11: ['A', 'C'],
        12: ['B', 'D'],
        13: ['A', 'B', 'E'],
        14: ['C', 'D'],
        15: ['A', 'D', 'E'],
        16: ['B', 'C'],
        17: ['A', 'B'],
        18: ['C', 'E'],
        19: ['A', 'C', 'D'],
        20: ['B', 'E'],
        // 21-30 Benar / Salah
        21: 'B', 22: 'S', 23: 'B', 24: 'B', 25: 'S',
        26: 'S', 27: 'B', 28: 'S', 29: 'B', 30: 'B'
      }
    },
    non_eksak: {
      subjectType: 'non_eksak',
      subjectName: 'Bahasa Indonesia',
      className: 'XII IPS 2',
      semester: 'Ganjil',
      academicYear: '2026/2027',
      teacherName: 'Siti Rahmawati, S.Pd.',
      updatedAt: new Date().toISOString(),
      answers: {
        // 1-20 PG Sederhana
        1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E',
        6: 'A', 7: 'B', 8: 'C', 9: 'D', 10: 'E',
        11: 'B', 12: 'C', 13: 'A', 14: 'D', 15: 'E',
        16: 'A', 17: 'B', 18: 'D', 19: 'C', 20: 'E',
        // 21-30 PG Kompleks (MCMA)
        21: ['A', 'B'],
        22: ['B', 'D'],
        23: ['A', 'C', 'E'],
        24: ['C', 'D'],
        25: ['B', 'C', 'D'],
        26: ['A', 'E'],
        27: ['B', 'E'],
        28: ['A', 'C'],
        29: ['C', 'D', 'E'],
        30: ['A', 'B', 'D'],
        // 31-40 Benar / Salah
        31: 'B', 32: 'S', 33: 'B', 34: 'S', 35: 'B',
        36: 'B', 37: 'S', 38: 'S', 39: 'B', 40: 'S'
      }
    }
  };

  // Contoh Data Siswa Awal untuk visualisasi langsung di tabel rekapitulasi
  const DEFAULT_SAMPLE_STUDENTS = [
    {
      id: 'std_demo_1',
      name: 'Ahmad Faiz Al-Ghifari',
      code: 'ASAS-2026-001',
      subjectType: 'eksak',
      answers: {
        1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E',
        6: 'A', 7: 'C', 8: 'B', 9: 'D', 10: 'A',
        11: ['A', 'C'], 12: ['B', 'D'], 13: ['A', 'B', 'E'], 14: ['C', 'D'], 15: ['A', 'D', 'E'],
        16: ['B', 'C'], 17: ['A', 'B'], 18: ['C', 'E'], 19: ['A', 'C', 'D'], 20: ['B', 'E'],
        21: 'B', 22: 'S', 23: 'B', 24: 'B', 25: 'S',
        26: 'S', 27: 'B', 28: 'S', 29: 'B', 30: 'B'
      },
      gradedAt: new Date(Date.now() - 3600000 * 3).toISOString()
    },
    {
      id: 'std_demo_2',
      name: 'Beatrix Nabila Putri',
      code: 'ASAS-2026-002',
      subjectType: 'eksak',
      answers: {
        1: 'A', 2: 'B', 3: 'C', 4: 'A', 5: 'E',
        6: 'A', 7: 'D', 8: 'B', 9: 'D', 10: 'A',
        11: ['A'], 12: ['B', 'D'], 13: ['A', 'B'], 14: ['C', 'D'], 15: ['A', 'D'],
        16: ['B', 'C'], 17: ['A', 'C'], 18: ['C', 'E'], 19: ['A', 'D'], 20: ['B', 'E'],
        21: 'B', 22: 'S', 23: 'S', 24: 'B', 25: 'S',
        26: 'S', 27: 'B', 28: 'S', 29: 'B', 30: 'S'
      },
      gradedAt: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: 'std_demo_3',
      name: 'Chandra Wicaksono',
      code: 'ASAS-2026-003',
      subjectType: 'eksak',
      answers: {
        1: 'B', 2: 'B', 3: 'A', 4: 'D', 5: 'C',
        6: 'A', 7: 'C', 8: 'A', 9: 'B', 10: 'D',
        11: ['A', 'B'], 12: ['A', 'D'], 13: ['A'], 14: ['A', 'B'], 15: ['B'],
        16: ['C'], 17: ['A'], 18: ['E'], 19: ['B'], 20: ['C'],
        21: 'S', 22: 'B', 23: 'S', 24: 'S', 25: 'B',
        26: 'B', 27: 'S', 28: 'B', 29: 'S', 30: 'S'
      },
      gradedAt: new Date(Date.now() - 3600000 * 1).toISOString()
    }
  ];

  window.ASAS_MODELS = {
    SUBJECT_STRUCTURES,
    PG_OPTIONS,
    TF_OPTIONS,
    DEFAULT_SAMPLE_KEYS,
    DEFAULT_SAMPLE_STUDENTS
  };

})(typeof window !== 'undefined' ? window : this);
