require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const Subject = require("../models/Subject");
const Question = require("../models/Question");

// Sample question bank used for local development. These are original practice
// items written for this project, not reproductions of real JAMB papers.
// Each entry is keyed by a stable slug so re-running the seed is idempotent.
const QUESTIONS = [
  // ---------- Mathematics ----------
  {
    subjectId: "mathematics",
    topic: "Algebra",
    text: "If 2x - 5 = 11, what is the value of x?",
    options: ["6", "7", "8", "9"],
    correctAnswer: "C",
    explanation: "Add 5 to both sides to get 2x = 16, then divide by 2 to get x = 8.",
    difficulty: "Easy",
  },
  {
    subjectId: "mathematics",
    topic: "Algebra",
    text: "What is the sum of the roots of the equation x^2 - 5x + 6 = 0?",
    options: ["5", "6", "-5", "11"],
    correctAnswer: "A",
    explanation: "By the sum-of-roots rule the sum equals the coefficient of x with the sign reversed, so it is 5.",
    difficulty: "Medium",
  },
  {
    subjectId: "mathematics",
    topic: "Algebra",
    text: "What is the value of (2^3)^2?",
    options: ["32", "64", "16", "8"],
    correctAnswer: "B",
    explanation: "Raising a power to a power multiplies the exponents: 2^3 squared is 2^6 = 64.",
    difficulty: "Easy",
  },
  {
    subjectId: "mathematics",
    topic: "Geometry",
    text: "A triangle has two angles of 50 degrees and 60 degrees. What is the third angle?",
    options: ["60 degrees", "70 degrees", "80 degrees", "90 degrees"],
    correctAnswer: "B",
    explanation: "Angles in a triangle sum to 180 degrees, so the third angle is 180 - 50 - 60 = 70 degrees.",
    difficulty: "Easy",
  },
  {
    subjectId: "mathematics",
    topic: "Geometry",
    text: "What is the area of a rectangle with length 12 cm and width 5 cm?",
    options: ["17 cm^2", "34 cm^2", "60 cm^2", "120 cm^2"],
    correctAnswer: "C",
    explanation: "Area of a rectangle is length multiplied by width: 12 x 5 = 60 cm^2.",
    difficulty: "Easy",
  },
  {
    subjectId: "mathematics",
    topic: "Geometry",
    text: "A circle has a radius of 7 cm. What is its circumference? (Take pi as 22/7)",
    options: ["22 cm", "44 cm", "88 cm", "154 cm"],
    correctAnswer: "B",
    explanation: "Circumference is 2 pi r, so 2 x (22/7) x 7 = 44 cm.",
    difficulty: "Medium",
  },
  {
    subjectId: "mathematics",
    topic: "Trigonometry",
    text: "What is the value of sin 30 degrees?",
    options: ["1/2", "sqrt(3)/2", "1", "0"],
    correctAnswer: "A",
    explanation: "sin 30 degrees is exactly one half, which follows from the 30-60-90 triangle ratios.",
    difficulty: "Easy",
  },
  {
    subjectId: "mathematics",
    topic: "Trigonometry",
    text: "In a right-angled triangle, sin theta equals 3/5. What is cos theta?",
    options: ["3/5", "5/3", "4/5", "1/4"],
    correctAnswer: "C",
    explanation: "Using sin^2 + cos^2 = 1, cos^2 = 1 - 9/25 = 16/25, so cos theta = 4/5.",
    difficulty: "Medium",
  },
  {
    subjectId: "mathematics",
    topic: "Trigonometry",
    text: "What is the value of tan 45 degrees?",
    options: ["0", "1", "sqrt(2)", "2"],
    correctAnswer: "B",
    explanation: "tan 45 degrees = opposite/adjacent = 1 in the isosceles right triangle, so the value is 1.",
    difficulty: "Easy",
  },
  {
    subjectId: "mathematics",
    topic: "Statistics",
    text: "What is the mean of 4, 6, 8 and 10?",
    options: ["6", "7", "8", "28"],
    correctAnswer: "C",
    explanation: "The mean is the sum divided by the count: (4 + 6 + 8 + 10) / 4 = 28 / 4 = 7.",
    difficulty: "Easy",
  },
  {
    subjectId: "mathematics",
    topic: "Statistics",
    text: "What is the median of 3, 5, 7, 9 and 11?",
    options: ["7", "5", "9", "35"],
    correctAnswer: "A",
    explanation: "The median is the middle value of the ordered data, which is the third value, 7.",
    difficulty: "Easy",
  },
  {
    subjectId: "mathematics",
    topic: "Statistics",
    text: "P(A) = 0.4 and P(B) = 0.3, and A and B cannot both happen. What is P(A or B)?",
    options: ["0.12", "0.7", "0.1", "1.2"],
    correctAnswer: "B",
    explanation: "For mutually exclusive events the probabilities add: 0.4 + 0.3 = 0.7.",
    difficulty: "Medium",
  },

  // ---------- English ----------
  {
    subjectId: "english",
    topic: "Comprehension",
    text: "Passage: The central library opens at 8 a.m. from Monday to Friday and stays open until 8 p.m. It closes at 5 p.m. on Saturdays and is closed on Sundays. According to the passage, when does the library close on a Saturday?",
    options: ["5 p.m.", "8 p.m.", "8 a.m.", "It stays open"],
    correctAnswer: "A",
    explanation: "The passage states that the library closes at 5 p.m. on Saturdays.",
    difficulty: "Easy",
  },
  {
    subjectId: "english",
    topic: "Comprehension",
    text: "Passage: Amina had studied for three weeks before the examination, yet she still found the algebra paper difficult. Which word best describes the difficulty she experienced?",
    options: ["Tedious", "Conscientious", "Peculiar", "Diligent"],
    correctAnswer: "A",
    explanation: "The difficulty she experienced is described as tedious, meaning tiresome. The other words describe her study habits, not the paper.",
    difficulty: "Medium",
  },
  {
    subjectId: "english",
    topic: "Comprehension",
    text: "Passage: Farmers in the region rotate their crops so that the soil is not exhausted by a single plant. The writer suggests that crop rotation is mainly intended to do what?",
    options: ["Increase harvest prices", "Preserve soil fertility", "Reduce labour costs", "Attract more buyers"],
    correctAnswer: "B",
    explanation: "Rotating crops prevents one plant from draining the soil, which preserves its fertility.",
    difficulty: "Medium",
  },
  {
    subjectId: "english",
    topic: "Lexis & Structure",
    text: "Choose the word that is closest in meaning to 'meticulous'.",
    options: ["Careless", "Thorough", "Frustrated", "Obvious"],
    correctAnswer: "B",
    explanation: "Meticulous means showing great attention to detail, which is closest to thorough.",
    difficulty: "Medium",
  },
  {
    subjectId: "english",
    topic: "Lexis & Structure",
    text: "Choose the correctly punctuated sentence.",
    options: [
      "The teacher asked, \"did you understand the lesson?\"",
      "The teacher asked, \"Did you understand the lesson?\"",
      "The teacher asked \"did you understand the lesson\"?",
      "The teacher asked; \"Did you understand the lesson\"?",
    ],
    correctAnswer: "B",
    explanation: "A direct question inside quotation marks needs a question mark inside the closing quotation mark.",
    difficulty: "Medium",
  },
  {
    subjectId: "english",
    topic: "Lexis & Structure",
    text: "Fill in the blank: The students were told to ___ their books on the desk. (lie / lay)",
    options: ["lie", "lay", "laying", "laid"],
    correctAnswer: "B",
    explanation: "Lay is the past tense of the verb lay, which is what the sentence requires.",
    difficulty: "Hard",
  },
  {
    subjectId: "english",
    topic: "Oral English",
    text: "A caller asks to speak to Mr. Bello, who is not in the office. What is the most appropriate response?",
    options: [
      "You must speak to him now.",
      "He is not in. Would you like to leave a message?",
      "Why do you want to speak to him?",
      "He went home without telling me.",
    ],
    correctAnswer: "B",
    explanation: "The appropriate response is courteous, states the situation, and offers a next step.",
    difficulty: "Easy",
  },
  {
    subjectId: "english",
    topic: "Oral English",
    text: "A friend has just been offered a scholarship. Which reply shows the most appropriate attitude?",
    options: [
      "I knew you would fail anyway.",
      "Congratulations! You must be very pleased.",
      "Nobody asked you.",
      "Scholarships are not for people like us.",
    ],
    correctAnswer: "B",
    explanation: "Congratulating the person and acknowledging their pleasure is the appropriate positive response.",
    difficulty: "Easy",
  },
  {
    subjectId: "english",
    topic: "Oral English",
    text: "Someone says 'I beg your pardon' while you are speaking. What is the usual response?",
    options: [
      "I do not hear you at all.",
      "Sorry, please repeat that.",
      "Speak louder, I am not interested.",
      "You should beg.",
    ],
    correctAnswer: "B",
    explanation: "The conventional response to 'I beg your pardon' is an apology and a request to repeat.",
    difficulty: "Easy",
  },
  {
    subjectId: "english",
    topic: "Essay Writing",
    text: "Which of these is the most suitable introduction for an essay on the benefits of reading?",
    options: [
      "In this essay I will discuss the benefits of reading.",
      "Reading is nice and some people like books a lot.",
      "Firstly, secondly, thirdly and lastly.",
      "According to the dictionary, a book is paper.",
    ],
    correctAnswer: "A",
    explanation: "A good introduction states the topic and signals the direction of the essay clearly.",
    difficulty: "Medium",
  },
  {
    subjectId: "english",
    topic: "Essay Writing",
    text: "Which is the strongest concluding sentence for an essay on air pollution?",
    options: [
      "That is all I have to say.",
      "In conclusion, reducing air pollution requires individual effort backed by strong government policy.",
      "Air pollution.",
      "I wrote this essay last week.",
    ],
    correctAnswer: "B",
    explanation: "A strong conclusion restates the argument and leaves the reader with a clear point.",
    difficulty: "Medium",
  },
  {
    subjectId: "english",
    topic: "Essay Writing",
    text: "Which arrangement of paragraphs is most logical for an essay describing how to make a cup of tea?",
    options: [
      "Step three, step one, step four, step two",
      "Conclusion, step one, step two, step three",
      "Step one, step two, step three, conclusion",
      "Step two, conclusion, step one, step three",
    ],
    correctAnswer: "C",
    explanation: "A process essay should follow the natural sequence of the process and end with a conclusion.",
    difficulty: "Medium",
  },

  // ---------- Physics ----------
  {
    subjectId: "physics",
    topic: "Mechanics",
    text: "A body starts from rest and accelerates uniformly at 2 m/s^2. What is its velocity after 5 seconds?",
    options: ["2 m/s", "5 m/s", "7 m/s", "10 m/s"],
    correctAnswer: "D",
    explanation: "Using v = u + at with u = 0, a = 2 and t = 5 gives v = 10 m/s.",
    difficulty: "Medium",
  },
  {
    subjectId: "physics",
    topic: "Mechanics",
    text: "A body of mass 5 kg is acted on by a net force of 20 N. What is its acceleration?",
    options: ["4 m/s^2", "10 m/s^2", "20 m/s^2", "100 m/s^2"],
    correctAnswer: "A",
    explanation: "From F = ma, a = F / m = 20 / 5 = 4 m/s^2.",
    difficulty: "Easy",
  },
  {
    subjectId: "physics",
    topic: "Mechanics",
    text: "What is the SI unit of force?",
    options: ["Joule", "Newton", "Watt", "Pascal"],
    correctAnswer: "B",
    explanation: "Force is measured in newtons, named after Isaac Newton.",
    difficulty: "Easy",
  },
  {
    subjectId: "physics",
    topic: "Waves",
    text: "A wave has a period of 0.5 s. What is its frequency?",
    options: ["0.5 Hz", "2 Hz", "25 Hz", "500 Hz"],
    correctAnswer: "B",
    explanation: "Frequency is the reciprocal of the period: 1 / 0.5 = 2 Hz.",
    difficulty: "Easy",
  },
  {
    subjectId: "physics",
    topic: "Waves",
    text: "Sound waves travelling through air are best described as",
    options: ["Longitudinal", "Transverse", "Electromagnetic", "Circular"],
    correctAnswer: "A",
    explanation: "In air the particles vibrate parallel to the direction of travel, so sound is longitudinal.",
    difficulty: "Medium",
  },
  {
    subjectId: "physics",
    topic: "Waves",
    text: "A sound wave has a speed of 340 m/s and a frequency of 170 Hz. What is its wavelength?",
    options: ["1 m", "2 m", "4 m", "0.5 m"],
    correctAnswer: "B",
    explanation: "Using v = f x wavelength, wavelength = 340 / 170 = 2 m.",
    difficulty: "Medium",
  },
  {
    subjectId: "physics",
    topic: "Electricity",
    text: "What is the SI unit of electric current?",
    options: ["Ampere", "Volt", "Ohm", "Coulomb"],
    correctAnswer: "A",
    explanation: "Electric current is measured in amperes.",
    difficulty: "Easy",
  },
  {
    subjectId: "physics",
    topic: "Electricity",
    text: "Which expression states Ohm's law?",
    options: ["I = V/R", "V = IR", "P = IV", "Q = It"],
    correctAnswer: "B",
    explanation: "Ohm's law states that potential difference is proportional to current, written V = IR.",
    difficulty: "Easy",
  },
  {
    subjectId: "physics",
    topic: "Electricity",
    text: "Resistors of 2 ohms and 4 ohms are connected in series. What is the total resistance?",
    options: ["2 ohms", "6 ohms", "8 ohms", "1.33 ohms"],
    correctAnswer: "B",
    explanation: "In series the resistances simply add: 2 + 4 = 6 ohms.",
    difficulty: "Easy",
  },
  {
    subjectId: "physics",
    topic: "Modern Physics",
    text: "Which statement best describes the photoelectric effect?",
    options: [
      "Light behaves as a stream of particles called photons",
      "Light bends only through glass",
      "All forms of matter are electrically neutral",
      "Electrons have no charge",
    ],
    correctAnswer: "A",
    explanation: "The photoelectric effect shows light transfers energy in discrete packets, which is the photon model.",
    difficulty: "Medium",
  },
  {
    subjectId: "physics",
    topic: "Modern Physics",
    text: "Which subatomic particle carries a negative charge?",
    options: ["Proton", "Neutron", "Electron", "Positron"],
    correctAnswer: "C",
    explanation: "The electron carries a negative charge, the proton is positive and the neutron is neutral.",
    difficulty: "Easy",
  },
  {
    subjectId: "physics",
    topic: "Modern Physics",
    text: "The energy of a photon is directly proportional to its",
    options: ["Wavelength", "Frequency", "Amplitude", "Speed in glass"],
    correctAnswer: "B",
    explanation: "From E = hf, photon energy is directly proportional to frequency.",
    difficulty: "Medium",
  },

  // ---------- Chemistry ----------
  {
    subjectId: "chemistry",
    topic: "Organic Chemistry",
    text: "What is the general formula for the alkane homologous series?",
    options: ["CnH2n+2", "CnH2n", "CnH2n-2", "CnH2n+1"],
    correctAnswer: "A",
    explanation: "Alkanes are saturated hydrocarbons with the general formula CnH2n+2.",
    difficulty: "Medium",
  },
  {
    subjectId: "chemistry",
    topic: "Organic Chemistry",
    text: "Which functional group characterises alcohols?",
    options: ["-COOH", "-OH", "-CHO", "-CO-"],
    correctAnswer: "B",
    explanation: "Alcohols contain the hydroxyl group, -OH, attached to a carbon atom.",
    difficulty: "Easy",
  },
  {
    subjectId: "chemistry",
    topic: "Organic Chemistry",
    text: "Ethane and ethene differ mainly in terms of",
    options: ["Molecular mass", "Degree of saturation", "Colour", "Solubility in water only"],
    correctAnswer: "B",
    explanation: "Ethane is a saturated alkane with single bonds, while ethene is unsaturated with a double bond.",
    difficulty: "Medium",
  },
  {
    subjectId: "chemistry",
    topic: "Inorganic Chemistry",
    text: "What is the chemical symbol for sodium?",
    options: ["Na", "S", "Sn", "So"],
    correctAnswer: "A",
    explanation: "Sodium is element 11 and its symbol is Na, from the Latin natrium.",
    difficulty: "Easy",
  },
  {
    subjectId: "chemistry",
    topic: "Inorganic Chemistry",
    text: "Which substance is commonly used to disinfect drinking water?",
    options: ["Oxygen", "Chlorine", "Ammonia", "Hydrogen"],
    correctAnswer: "B",
    explanation: "Chlorination kills water-borne pathogens and is used worldwide for water treatment.",
    difficulty: "Easy",
  },
  {
    subjectId: "chemistry",
    topic: "Inorganic Chemistry",
    text: "Which gas is commonly used to fill incandescent lamp bulbs because it resists oxidation?",
    options: ["Helium", "Neon", "Argon", "Krypton"],
    correctAnswer: "C",
    explanation: "Argon is chemically inert, so the hot filament does not burn away quickly.",
    difficulty: "Medium",
  },
  {
    subjectId: "chemistry",
    topic: "Physical Chemistry",
    text: "What is the SI unit of pressure?",
    options: ["Joule", "Pascal", "Newton", "Watt"],
    correctAnswer: "B",
    explanation: "Pressure is measured in pascals, where 1 Pa equals 1 N/m^2.",
    difficulty: "Easy",
  },
  {
    subjectId: "chemistry",
    topic: "Physical Chemistry",
    text: "Pure water boils at 100 degrees Celsius. Under what condition does this hold true?",
    options: ["At sea level", "At the top of a mountain", "Under high pressure", "In a vacuum"],
    correctAnswer: "A",
    explanation: "Boiling point decreases with reduced pressure, so 100 degrees Celsius is the value at standard atmospheric pressure.",
    difficulty: "Medium",
  },
  {
    subjectId: "chemistry",
    topic: "Physical Chemistry",
    text: "How many moles are present in 22 g of carbon dioxide? (C = 12, O = 16)",
    options: ["0.25 mol", "0.5 mol", "1.0 mol", "2.0 mol"],
    correctAnswer: "B",
    explanation: "Molar mass of CO2 is 12 + 32 = 44 g/mol, so 22 / 44 = 0.5 mol.",
    difficulty: "Medium",
  },

  // ---------- Biology ----------
  {
    subjectId: "biology",
    topic: "Cell Biology",
    text: "Which organelle is the main site of aerobic respiration?",
    options: ["Mitochondrion", "Ribosome", "Golgi apparatus", "Lysosome"],
    correctAnswer: "A",
    explanation: "The mitochondrion carries out the Krebs cycle and oxidative phosphorylation.",
    difficulty: "Easy",
  },
  {
    subjectId: "biology",
    topic: "Cell Biology",
    text: "What is the main function of the cell membrane?",
    options: [
      "To store genetic information",
      "To make ATP by photosynthesis",
      "To control what enters and leaves the cell",
      "To synthesise proteins",
    ],
    correctAnswer: "C",
    explanation: "The selectively permeable cell membrane regulates the movement of substances in and out of the cell.",
    difficulty: "Easy",
  },
  {
    subjectId: "biology",
    topic: "Cell Biology",
    text: "Which structures are present in plant cells but absent in animal cells?",
    options: ["Nucleus and cytoplasm", "Cell wall and chloroplast", "Mitochondria and ribosomes", "Vacuole and membrane"],
    correctAnswer: "B",
    explanation: "Plant cells have a rigid cell wall and chloroplasts for photosynthesis.",
    difficulty: "Easy",
  },
  {
    subjectId: "biology",
    topic: "Genetics",
    text: "Where are chromosomes located in a eukaryotic cell?",
    options: ["Cytoplasm", "Ribosome", "Nucleus", "Cell wall"],
    correctAnswer: "C",
    explanation: "Chromosomes are housed in the nucleus and are separated by a nuclear membrane.",
    difficulty: "Easy",
  },
  {
    subjectId: "biology",
    topic: "Genetics",
    text: "How many chromosomes are found in a normal human body cell?",
    options: ["23", "46", "44", "48"],
    correctAnswer: "B",
    explanation: "Somatic human cells contain 46 chromosomes, arranged in 23 pairs.",
    difficulty: "Easy",
  },
  {
    subjectId: "biology",
    topic: "Genetics",
    text: "Two heterozygous parents (Bb x Bb) produce a child. What is the probability that the child shows the recessive phenotype?",
    options: ["0%", "25%", "50%", "75%"],
    correctAnswer: "B",
    explanation: "The cross gives a 1:2:1 ratio, so a quarter of offspring are bb and show the recessive trait.",
    difficulty: "Hard",
  },
  {
    subjectId: "biology",
    topic: "Ecology",
    text: "An association in which both organisms benefit is called",
    options: ["Parasitism", "Mutualism", "Commensalism", "Competition"],
    correctAnswer: "B",
    explanation: "Mutualism is a symbiotic relationship that is beneficial to both partners.",
    difficulty: "Easy",
  },
  {
    subjectId: "biology",
    topic: "Ecology",
    text: "Green plants manufacture food in the presence of light through the process of",
    options: ["Respiration", "Transpiration", "Photosynthesis", "Fermentation"],
    correctAnswer: "C",
    explanation: "Photosynthesis converts light energy into chemical energy stored in glucose.",
    difficulty: "Easy",
  },
  {
    subjectId: "biology",
    topic: "Ecology",
    text: "Organisms that manufacture their own food are known as",
    options: ["Heterotrophs", "Decomposers", "Producers", "Parasites"],
    correctAnswer: "C",
    explanation: "Producers or autotrophs make organic food from inorganic sources using light or chemical energy.",
    difficulty: "Easy",
  },
  {
    subjectId: "biology",
    topic: "Human Physiology",
    text: "Which organ pumps blood around the body?",
    options: ["Heart", "Liver", "Lung", "Kidney"],
    correctAnswer: "A",
    explanation: "The heart is a muscular pump that drives the systemic and pulmonary circuits.",
    difficulty: "Easy",
  },
  {
    subjectId: "biology",
    topic: "Human Physiology",
    text: "Gas exchange in the human lung takes place mainly in the",
    options: ["Bronchi", "Trachea", "Alveoli", "Diaphragm"],
    correctAnswer: "C",
    explanation: "The alveoli have thin walls and a large surface area suited to gas exchange.",
    difficulty: "Easy",
  },
  {
    subjectId: "biology",
    topic: "Human Physiology",
    text: "Which blood vessel carries oxygenated blood from the lungs to the heart?",
    options: ["Pulmonary artery", "Pulmonary vein", "Aorta", "Vena cava"],
    correctAnswer: "B",
    explanation: "The pulmonary vein is the only vein that carries oxygenated blood.",
    difficulty: "Medium",
  },
];

// A stable fingerprint so repeated runs update rather than duplicate rows.
function fingerprint(question) {
  return [
    question.subjectId,
    question.topic,
    question.text,
  ].join("|");
}

async function seedQuestions() {
  const subjectIds = new Set((await Subject.find({}, { _id: 1 })).map((s) => s._id));

  for (const subjectId of subjectIds) {
    if (subjectId.toString() !== subjectId) {
      throw new Error(`Subject id must be a string for question seeding, got ${subjectId}`);
    }
  }

  let created = 0;
  for (const question of QUESTIONS) {
    if (!subjectIds.has(question.subjectId)) {
      console.warn(`[seed] skipping unknown subject: ${question.subjectId}`);
      continue;
    }

    await Question.findOneAndUpdate(
      { subjectId: question.subjectId, topic: question.topic, text: question.text },
      {
        $set: {
          year: 2021,
          options: question.options,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          difficulty: question.difficulty,
          source: "past",
          generatedForUserId: null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    created += 1;
  }

  const total = await Question.countDocuments();
  console.log(`[seed] upserted ${created} sample questions (${total} in collection)`);
}

async function run() {
  await connectDB();
  await seedQuestions();
  await mongoose.disconnect();
  console.log("[seed] done");
}

run().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
