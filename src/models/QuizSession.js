const mongoose = require("mongoose");

const quizSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subjectId: { type: String, ref: "Subject", required: true },
    subjectName: { type: String, required: true },
    topic: { type: String, default: null },
    mode: { type: String, enum: ["past", "ai"], required: true },
    year: { type: Number, default: null },
    questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuizSession", quizSessionSchema);
