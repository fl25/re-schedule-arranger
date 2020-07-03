const loader = require('./sequelize-loader');
const Datatypes = loader.Datatypes;

const Candidate = loader.database.define(
  'candidates',
  {
    candidateId: {
      type: Datatypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    candidateName: {
      type: Datatypes.STRING,
      allowNull: false
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

module.exports = Candidate;
