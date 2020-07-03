const loader = require('./sequelize-loader');
const Datatypes = loader.Datatypes;

const Schedule = loader.database.define(
  'schedules',
  {
    scheduleId: {
      type: Datatypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    scheduleName: {
      type: Datatypes.STRING,
      allowNull: false
    },
    memo: {
      type: Datatypes.TEXT,
      allowNull: false
    },
    createdBy: {
      type: Datatypes.INTEGER,
      allowNull: false
    },
    updatedAt: {
      type: Datatypes.DATE,
      allowNull: false
    }
  },
  {
    freezeTableName: true,
    timestamps: false,
    indexes: [
      {
        fields: ['createdBy']
      }
    ]
  }
);

module.exports = Schedule;
