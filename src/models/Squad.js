const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Squad = sequelize.define('Squad', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  event_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  creator_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  max_members: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  status: {
    type: DataTypes.ENUM('open', 'full', 'closed'),
    defaultValue: 'open',
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'squads',
  timestamps: false,
  indexes: [
    { fields: ['event_id'] },
    { fields: ['creator_id'] },
    { fields: ['status'] },
  ],
});

module.exports = Squad;
