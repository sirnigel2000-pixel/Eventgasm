const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserScore = sequelize.define('UserScore', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
  },
  total_score: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // Category breakdowns
  music_score: { type: DataTypes.INTEGER, defaultValue: 0 },
  sports_score: { type: DataTypes.INTEGER, defaultValue: 0 },
  comedy_score: { type: DataTypes.INTEGER, defaultValue: 0 },
  arts_score: { type: DataTypes.INTEGER, defaultValue: 0 },
  nightlife_score: { type: DataTypes.INTEGER, defaultValue: 0 },
  food_score: { type: DataTypes.INTEGER, defaultValue: 0 },
  community_score: { type: DataTypes.INTEGER, defaultValue: 0 },
  // Stats
  events_interested: { type: DataTypes.INTEGER, defaultValue: 0 },
  events_attended: { type: DataTypes.INTEGER, defaultValue: 0 },
  events_going: { type: DataTypes.INTEGER, defaultValue: 0 },
  // Badges (JSON array)
  badges: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'user_scores',
  timestamps: true,
  createdAt: false,
  updatedAt: 'updated_at',
});

// Point values
const POINTS = {
  interested: 5,
  going: 15,
  attended: 50,
};

UserScore.addPoints = async function(userId, category, status) {
  const points = POINTS[status] || 0;
  const categoryField = `${category.toLowerCase()}_score`;
  
  let score = await this.findOne({ where: { user_id: userId } });
  
  if (!score) {
    score = await this.create({ user_id: userId });
  }
  
  // Update total
  score.total_score += points;
  
  // Update category if valid
  if (score[categoryField] !== undefined) {
    score[categoryField] += points;
  }
  
  // Update status counts
  if (status === 'interested') score.events_interested++;
  if (status === 'going') score.events_going++;
  if (status === 'attended') score.events_attended++;
  
  await score.save();
  return score;
};

module.exports = UserScore;
