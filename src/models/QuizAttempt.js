const mongoose = require("mongoose");

const reviewItemSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    userAnswer: { type: String, default: null },
    correctAnswer: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "QuizSession", required: true },
    subjectId: { type: String, required: true },
    subjectName: { type: String, required: true },
    topic: { type: String, default: null },
    mode: { type: String, enum: ["past", "ai"], required: true },
    questionsSnapshot: { type: mongoose.Schema.Types.Mixed, default: [] },
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
    score: { type: Number, required: true },
    questionsCount: { type: Number, required: true },
    percentage: { type: Number, required: true },
    review: { type: [reviewItemSchema], default: [] },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuizAttempt", quizAttemptSchema);
