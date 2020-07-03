const loader = require('./sequelize-loader');
const Datatypes = loader.Datatypes;

const Comment = loader.database.define(
  'comments',
  {
    scheduleId: {
      type: Datatypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    userId: {
      type: Datatypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    comment: {
      type: Datatypes.STRING,
      allowNull: false
    }
  },
  {
    freezeTableName: true,
    timestamps: false
  }
);

module.exports = Comment;
