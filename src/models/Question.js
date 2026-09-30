const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    subjectId: { type: String, ref: "Subject", required: true, index: true },
    topic: { type: String, required: true, index: true },
    year: { type: Number, default: null }, // null for AI-generated
    text: { type: String, required: true },
    options: {
      type: [String],
      required: true,
      validate: (v) => Array.isArray(v) && v.length >= 2,
    },
    correctAnswer: { type: String, required: true }, // e.g. "A"
    explanation: { type: String, default: "" },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium",
    },
    source: {
      type: String,
      enum: ["past", "generated"],
      default: "past",
      index: true,
    },
    generatedForUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

questionSchema.index({ subjectId: 1, topic: 1, year: 1 });

questionSchema.methods.toClientJSON = function toClientJSON({ includeAnswer = true } = {}) {
  const base = {
    id: this._id.toString(),
    subjectId: this.subjectId,
    topic: this.topic,
    year: this.year,
    text: this.text,
    options: this.options,
    difficulty: this.difficulty,
  };
  if (includeAnswer) {
    base.correctAnswer = this.correctAnswer;
    base.explanation = this.explanation;
  }
  if (this.source === "generated") {
    base.generatedAt = this.createdAt;
  }
  return base;
};

module.exports = mongoose.model("Question", questionSchema);
