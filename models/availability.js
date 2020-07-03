const loader = require('./sequelize-loader');
const Datatypes = loader.Datatypes;

const Availability = loader.database.define(
  'availabilities',
  {
    candidateId: {
      type: Datatypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    userId: {
      type: Datatypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    availability: {
      type: Datatypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    scheduleId: {
      type: Datatypes.UUID,
      allowNull: false
    }
  },
  {
    freezeTableName: true,
    timestamps: false,
    indexes: [
      {
        fields: ['scheduleId']
      }
    ]
  }
);

module.exports = Availability;