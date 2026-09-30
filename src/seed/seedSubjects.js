require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const Subject = require("../models/Subject");
const { seedAdmin } = require("./seedAdmin");

const SUBJECTS = [
  {
    _id: "mathematics",
    name: "Mathematics",
    shortName: "Math",
    icon: "activity",
    color: "#159A63",
    topics: ["Algebra", "Geometry", "Trigonometry", "Statistics"],
  },
  {
    _id: "english",
    name: "English Language",
    shortName: "English",
    icon: "book-open",
    color: "#3B82F6",
    topics: ["Comprehension", "Lexis & Structure", "Oral English", "Essay Writing"],
  },
  {
    _id: "physics",
    name: "Physics",
    shortName: "Physics",
    icon: "zap",
    color: "#F59E0B",
    topics: ["Mechanics", "Waves", "Electricity", "Modern Physics"],
  },
  {
    _id: "chemistry",
    name: "Chemistry",
    shortName: "Chem",
    // Icon names are sent to the client and rendered with Feather, so these
    // must be valid Feather glyphs (e.g. "flask-conical" is not).
    icon: "box",
    color: "#8B5CF6",
    topics: ["Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry"],
  },
  {
    _id: "biology",
    name: "Biology",
    shortName: "Bio",
    icon: "feather",
    color: "#10B981",
    topics: ["Cell Biology", "Genetics", "Ecology", "Human Physiology"],
  },
];

async function seedSubjects() {
  for (const subject of SUBJECTS) {
    await Subject.findByIdAndUpdate(subject._id, subject, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    console.log(`[seed] upserted subject: ${subject.name}`);
  }
}

async function run() {
  await connectDB();
  await seedSubjects();
  await seedAdmin();
  await mongoose.disconnect();
  console.log("[seed] done");
}

run().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
