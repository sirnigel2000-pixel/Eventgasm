const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SquadMember = sequelize.define('SquadMember', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  squad_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('creator', 'member'),
    defaultValue: 'member',
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'declined'),
    defaultValue: 'pending',
  },
  joined_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'squad_members',
  timestamps: false,
  indexes: [
    { fields: ['squad_id'] },
    { fields: ['user_id'] },
    { fields: ['squad_id', 'user_id'], unique: true },
  ],
});

module.exports = SquadMember;
