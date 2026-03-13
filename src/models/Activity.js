const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Activity = sequelize.define('Activity', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  activity_type: {
    type: DataTypes.ENUM('interested', 'going', 'attended', 'squad_joined', 'squad_created', 'friend_added'),
    allowNull: false,
  },
  event_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  squad_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  target_user_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'activities',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['created_at'] },
    { fields: ['activity_type'] },
  ],
});

module.exports = Activity;
