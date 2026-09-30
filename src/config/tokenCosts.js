// Token costs for AI features. Single source of truth so the profile payload
// and the controllers that gate on balance can never disagree.
const AI_QUIZ_TOKEN_COST = () => parseInt(process.env.AI_QUIZ_TOKEN_COST || "50", 10);

const COACH_MESSAGE_TOKEN_COST = () =>
  parseInt(process.env.COACH_MESSAGE_TOKEN_COST || "10", 10);

module.exports = { AI_QUIZ_TOKEN_COST, COACH_MESSAGE_TOKEN_COST };
