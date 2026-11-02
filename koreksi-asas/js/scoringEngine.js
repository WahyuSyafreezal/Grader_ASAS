/**
 * scoringEngine.js
 * Modul Engine Penilaian Otomatis untuk Asesmen Sumatif Akhir Semester (ASAS).
 * 
 * Dirancang modular, fleksibel, dan mudah dimodifikasi untuk menyesuaikan
 * aturan penilaian di masa depan (bobot, skema parsial, skala nilai, dll).
 */

(function (window) {
  'use strict';

  /**
   * Pilihan Skema Penilaian PG Komplek:
   * 1. 'all_or_nothing': Benar penuh jika semua opsi tepat sama dengan kunci (100% match).
   * 2. 'partial_penalty': Skor proporsional opsi benar dikurangi penalti opsi salah. Mencegah tebak semua opsi.
   * 3. 'partial_clean': Skor proporsional hanya jika siswa TIDAK memilih opsi salah sama sekali.
   */
  const DEFAULT_CONFIG = {
    kkm: 75,
    pgComplexScoringMode: 'partial_penalty', // 'all_or_nothing' | 'partial_penalty' | 'partial_clean'
    weights: {
      pgSingle: 1.0,     // Bobot poin per butir PG Sederhana
      pgComplex: 1.0,    // Bobot poin per butir PG Komplek
      trueFalse: 1.0     // Bobot poin per butir Benar/Salah
    },
    roundingDigits: 2
  };

  class ScoringEngine {
    constructor(config = {}) {
      this.config = Object.assign({}, DEFAULT_CONFIG, config);
      if (config.weights) {
        this.config.weights = Object.assign({}, DEFAULT_CONFIG.weights, config.weights);
      }
    }

    /**
     * Memperbarui konfigurasi penilaian
     * @param {Object} newConfig 
     */
    updateConfig(newConfig) {
      this.config = Object.assign({}, this.config, newConfig);
      if (newConfig.weights) {
        this.config.weights = Object.assign({}, this.config.weights, newConfig.weights);
      }
    }

    /**
     * Menghitung nilai satu butir PG Sederhana (Single Choice)
     * @param {string} studentAns - Jawaban siswa (misal: "A")
     * @param {string} keyAns - Kunci jawaban (misal: "A")
     * @param {number} weight - Bobot soal
     * @returns {Object} { earned, maxWeight, isCorrect, status }
     */
    gradePgSingle(studentAns, keyAns, weight = this.config.weights.pgSingle) {
      const s = (studentAns || '').trim().toUpperCase();
      const k = (keyAns || '').trim().toUpperCase();
      
      const isCorrect = (s !== '' && s === k);
      const earned = isCorrect ? weight : 0;
      
      return {
        earned: earned,
        maxWeight: weight,
        isCorrect: isCorrect,
        status: isCorrect ? 'correct' : (s === '' ? 'empty' : 'wrong'),
        studentAnswer: s,
        keyAnswer: k
      };
    }

    /**
     * Menghitung nilai satu butir Benar / Salah
     * @param {string} studentAns - Jawaban siswa ("B" atau "S")
     * @param {string} keyAns - Kunci jawaban ("B" atau "S")
     * @param {number} weight - Bobot soal
     * @returns {Object} { earned, maxWeight, isCorrect, status }
     */
    gradeTrueFalse(studentAns, keyAns, weight = this.config.weights.trueFalse) {
      const s = (studentAns || '').trim().toUpperCase();
      const k = (keyAns || '').trim().toUpperCase();

      const isCorrect = (s !== '' && s === k);
      const earned = isCorrect ? weight : 0;

      return {
        earned: earned,
        maxWeight: weight,
        isCorrect: isCorrect,
        status: isCorrect ? 'correct' : (s === '' ? 'empty' : 'wrong'),
        studentAnswer: s,
        keyAnswer: k
      };
    }

    /**
     * Menghitung nilai satu butir PG Komplek (Multiple Choice Multiple Answer)
     * @param {string[]|string} studentAnswers - Array opsi siswa (misal: ['A', 'C']) atau string gabungan
     * @param {string[]|string} keyAnswers - Array opsi kunci jawaban (misal: ['A', 'B', 'C'])
     * @param {number} weight - Bobot soal
     * @returns {Object} Detail perolehan nilai PG Komplek
     */
    gradePgComplex(studentAnswers, keyAnswers, weight = this.config.weights.pgComplex) {
      // Normalisasi menjadi array huruf unik terurut kapital
      const normalize = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) {
          return Array.from(new Set(val.map(x => String(x).trim().toUpperCase()).filter(Boolean))).sort();
        }
        if (typeof val === 'string') {
          return Array.from(new Set(val.toUpperCase().replace(/[^A-E]/g, '').split(''))).sort();
        }
        return [];
      };

      const sList = normalize(studentAnswers);
      const kList = normalize(keyAnswers);

      if (kList.length === 0) {
        // Kunci kosong atau belum diset guru
        return {
          earned: 0,
          maxWeight: weight,
          isCorrect: false,
          status: 'no_key',
          studentAnswer: sList,
          keyAnswer: kList,
          detail: 'Kunci jawaban belum diset'
        };
      }

      if (sList.length === 0) {
        // Siswa tidak menjawab
        return {
          earned: 0,
          maxWeight: weight,
          isCorrect: false,
          status: 'empty',
          studentAnswer: sList,
          keyAnswer: kList,
          detail: 'Tidak dijawab'
        };
      }

      // Hitung irisan (pilihan siswa yang ada di kunci)
      const correctPicks = sList.filter(opt => kList.includes(opt));
      // Pilihan siswa yang salah (bukan kunci)
      const wrongPicks = sList.filter(opt => !kList.includes(opt));
      // Opsi kunci yang terlewat (tidak dipilih siswa)
      const missedKeys = kList.filter(opt => !sList.includes(opt));

      const isExactMatch = (sList.length === kList.length && missedKeys.length === 0 && wrongPicks.length === 0);

      let earned = 0;
      let status = 'wrong';

      if (isExactMatch) {
        earned = weight;
        status = 'correct';
      } else {
        const mode = this.config.pgComplexScoringMode;

        if (mode === 'all_or_nothing') {
          // Semua atau tidak sama sekali
          earned = 0;
          status = 'wrong';
        } else if (mode === 'partial_clean') {
          // Parsial hanya jika siswa TIDAK memilih opsi salah sama sekali
          if (wrongPicks.length === 0 && correctPicks.length > 0) {
            earned = (correctPicks.length / kList.length) * weight;
            status = 'partial';
          } else {
            earned = 0;
            status = 'wrong';
          }
        } else {
          // Default: 'partial_penalty'
          // Proporsional: (pilihan benar - pilihan salah) / total kunci, minimum 0
          const rawScore = (correctPicks.length - wrongPicks.length) / kList.length;
          earned = Math.max(0, rawScore) * weight;
          status = earned > 0 ? 'partial' : 'wrong';
        }
      }

      // Pembulatan earned
      earned = Number(earned.toFixed(4));

      return {
        earned: earned,
        maxWeight: weight,
        isCorrect: isExactMatch,
        status: status,
        studentAnswer: sList,
        keyAnswer: kList,
        correctPicks: correctPicks,
        wrongPicks: wrongPicks,
        missedKeys: missedKeys
      };
    }

    /**
     * Mengoreksi seluruh lembar jawaban siswa
     * @param {Object} studentData - { name, code, subjectType, answers: { [soalNumber]: answer } }
     * @param {Object} answerKey - { subjectType, answers: { [soalNumber]: keyAnswer } }
     * @param {Object} structureInfo - Struktur soal (total, ranges pgSingle, pgComplex, trueFalse)
     * @returns {Object} Hasil koreksi lengkap
     */
    gradeStudent(studentData, answerKey, structureInfo) {
      const studentAnswers = studentData.answers || {};
      const keyAnswers = answerKey.answers || {};

      let totalEarned = 0;
      let totalMaxWeight = 0;

      const breakdown = {
        pgSingle: { count: 0, correct: 0, wrong: 0, empty: 0, earned: 0, maxWeight: 0 },
        pgComplex: { count: 0, correct: 0, partial: 0, wrong: 0, empty: 0, earned: 0, maxWeight: 0 },
        trueFalse: { count: 0, correct: 0, wrong: 0, empty: 0, earned: 0, maxWeight: 0 }
      };

      const questionsDetail = [];

      for (let num = 1; num <= structureInfo.totalQuestions; num++) {
        const qType = structureInfo.getQuestionType(num);
        const sAns = studentAnswers[num];
        const kAns = keyAnswers[num];

        let result;
        if (qType === 'pgSingle') {
          result = this.gradePgSingle(sAns, kAns);
          breakdown.pgSingle.count++;
          breakdown.pgSingle.maxWeight += result.maxWeight;
          breakdown.pgSingle.earned += result.earned;
          if (result.status === 'correct') breakdown.pgSingle.correct++;
          else if (result.status === 'empty') breakdown.pgSingle.empty++;
          else breakdown.pgSingle.wrong++;

        } else if (qType === 'pgComplex') {
          result = this.gradePgComplex(sAns, kAns);
          breakdown.pgComplex.count++;
          breakdown.pgComplex.maxWeight += result.maxWeight;
          breakdown.pgComplex.earned += result.earned;
          if (result.status === 'correct') breakdown.pgComplex.correct++;
          else if (result.status === 'partial') breakdown.pgComplex.partial++;
          else if (result.status === 'empty') breakdown.pgComplex.empty++;
          else breakdown.pgComplex.wrong++;

        } else if (qType === 'trueFalse') {
          result = this.gradeTrueFalse(sAns, kAns);
          breakdown.trueFalse.count++;
          breakdown.trueFalse.maxWeight += result.maxWeight;
          breakdown.trueFalse.earned += result.earned;
          if (result.status === 'correct') breakdown.trueFalse.correct++;
          else if (result.status === 'empty') breakdown.trueFalse.empty++;
          else breakdown.trueFalse.wrong++;
        }

        totalEarned += result.earned;
        totalMaxWeight += result.maxWeight;

        questionsDetail.push({
          number: num,
          type: qType,
          ...result
        });
      }

      // Hitung persentase nilai (skala 100)
      const rawPercentage = totalMaxWeight > 0 ? (totalEarned / totalMaxWeight) * 100 : 0;
      const finalScore = Number(rawPercentage.toFixed(this.config.roundingDigits));
      const isPassed = finalScore >= this.config.kkm;

      // Predikat Nilai (Standar Kurikulum Merdeka / Nasional)
      let grade = 'D';
      if (finalScore >= 90) grade = 'A';
      else if (finalScore >= 80) grade = 'B';
      else if (finalScore >= 70) grade = 'C';
      else grade = 'D';

      return {
        studentId: studentData.id || ('std_' + Date.now()),
        studentName: (studentData.name || 'Tanpa Nama').trim(),
        studentCode: (studentData.code || '-').trim(),
        subjectType: studentData.subjectType,
        totalEarned: Number(totalEarned.toFixed(2)),
        totalMaxWeight: Number(totalMaxWeight.toFixed(2)),
        finalScore: finalScore,
        kkm: this.config.kkm,
        isPassed: isPassed,
        statusText: isPassed ? 'TUNTAS' : 'REMEDIAL',
        grade: grade,
        breakdown: breakdown,
        questionsDetail: questionsDetail,
        gradedAt: studentData.gradedAt || new Date().toISOString()
      };
    }
  }

  // Ekspor ke window global untuk pemakaian vanilla JS browser
  window.ScoringEngine = ScoringEngine;
  window.DEFAULT_SCORING_CONFIG = DEFAULT_CONFIG;

})(typeof window !== 'undefined' ? window : this);
