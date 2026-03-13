const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserEventInteraction = sequelize.define('UserEventInteraction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  event_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('interested', 'going', 'attended', 'not_interested'),
    defaultValue: 'interested',
  },
  points_earned: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'user_event_interactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['event_id'] },
    { fields: ['user_id', 'event_id'], unique: true },
    { fields: ['status'] },
  ],
});

// Class methods
UserEventInteraction.getEventStats = async function(eventId) {
  const stats = await this.findAll({
    where: { event_id: eventId },
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['status'],
    raw: true,
  });
  
  const result = { interested: 0, going: 0, attended: 0 };
  stats.forEach(s => {
    result[s.status] = parseInt(s.count);
  });
  return result;
};

UserEventInteraction.getUserScore = async function(userId) {
  const result = await this.sum('points_earned', {
    where: { user_id: userId }
  });
  return result || 0;
};

module.exports = UserEventInteraction;
