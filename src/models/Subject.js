const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    _id: { type: String }, // slug, e.g. "mathematics"
    name: { type: String, required: true },
    shortName: { type: String, required: true },
    icon: { type: String, default: "book" },
    color: { type: String, default: "#159A63" },
    topics: { type: [String], default: [] },
  },
  { timestamps: true, _id: false }
);

subjectSchema.virtual("id").get(function () {
  return this._id;
});
subjectSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Subject", subjectSchema);
