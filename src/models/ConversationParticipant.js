const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ConversationParticipant = sequelize.define('ConversationParticipant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  conversation_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  last_read_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  joined_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'conversation_participants',
  timestamps: false,
  indexes: [
    { fields: ['conversation_id'] },
    { fields: ['user_id'] },
    { fields: ['conversation_id', 'user_id'], unique: true },
  ],
});

module.exports = ConversationParticipant;
