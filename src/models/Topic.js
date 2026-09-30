const mongoose = require("mongoose");

const topicSchema = new mongoose.Schema(
  {
    subjectId: { type: String, ref: "Subject", required: true, index: true },
    name: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

topicSchema.index({ subjectId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Topic", topicSchema);
