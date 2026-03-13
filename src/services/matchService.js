const UserScore = require('../models/UserScore');
const UserEventInteraction = require('../models/UserEventInteraction');
const { Op } = require('sequelize');

// Calculate match percentage between two users
async function calculateMatch(userId1, userId2) {
  const [score1, score2] = await Promise.all([
    UserScore.findOne({ where: { user_id: userId1 } }),
    UserScore.findOne({ where: { user_id: userId2 } }),
  ]);

  if (!score1 || !score2) return 0;

  // Categories to compare
  const categories = ['music', 'sports', 'comedy', 'arts', 'nightlife', 'food', 'community'];
  
  // Normalize scores to percentages
  const normalize = (score) => {
    const total = categories.reduce((sum, cat) => sum + (score[`${cat}_score`] || 0), 0);
    if (total === 0) return {};
    return categories.reduce((obj, cat) => {
      obj[cat] = (score[`${cat}_score`] || 0) / total;
      return obj;
    }, {});
  };

  const profile1 = normalize(score1);
  const profile2 = normalize(score2);

  // Cosine similarity
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  categories.forEach(cat => {
    const v1 = profile1[cat] || 0;
    const v2 = profile2[cat] || 0;
    dotProduct += v1 * v2;
    magnitude1 += v1 * v1;
    magnitude2 += v2 * v2;
  });

  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  
  const similarity = dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
  return Math.round(similarity * 100);
}

// Find users with similar tastes
async function findMatches(userId, options = {}) {
  const { limit = 20, minScore = 50 } = options;

  // Get all users with scores
  const allScores = await UserScore.findAll({
    where: { 
      user_id: { [Op.ne]: userId },
      total_score: { [Op.gt]: 0 }
    },
    limit: 100, // Check top 100 active users
  });

  // Calculate match for each
  const matches = await Promise.all(
    allScores.map(async (score) => {
      const matchPercent = await calculateMatch(userId, score.user_id);
      return {
        userId: score.user_id,
        matchPercent,
        totalScore: score.total_score,
        topCategories: getTopCategories(score),
      };
    })
  );

  // Filter and sort
  return matches
    .filter(m => m.matchPercent >= minScore)
    .sort((a, b) => b.matchPercent - a.matchPercent)
    .slice(0, limit);
}

// Get user's top 3 categories
function getTopCategories(score) {
  const categories = [
    { name: 'music', score: score.music_score, emoji: '🎸' },
    { name: 'sports', score: score.sports_score, emoji: '🏃' },
    { name: 'comedy', score: score.comedy_score, emoji: '🎭' },
    { name: 'arts', score: score.arts_score, emoji: '🎨' },
    { name: 'nightlife', score: score.nightlife_score, emoji: '🌙' },
    { name: 'food', score: score.food_score, emoji: '🍕' },
    { name: 'community', score: score.community_score, emoji: '👥' },
  ];

  return categories
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(c => ({ name: c.name, emoji: c.emoji }));
}

// Find users interested in same event
async function findEventMatches(userId, eventId) {
  const interactions = await UserEventInteraction.findAll({
    where: {
      event_id: eventId,
      user_id: { [Op.ne]: userId },
      status: { [Op.in]: ['interested', 'going'] },
    },
    limit: 50,
  });

  const matches = await Promise.all(
    interactions.map(async (interaction) => {
      const matchPercent = await calculateMatch(userId, interaction.user_id);
      const score = await UserScore.findOne({ where: { user_id: interaction.user_id } });
      return {
        userId: interaction.user_id,
        status: interaction.status,
        matchPercent,
        totalScore: score?.total_score || 0,
        topCategories: score ? getTopCategories(score) : [],
      };
    })
  );

  return matches.sort((a, b) => b.matchPercent - a.matchPercent);
}

module.exports = {
  calculateMatch,
  findMatches,
  findEventMatches,
  getTopCategories,
};
