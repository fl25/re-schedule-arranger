const loader = require('./sequelize-loader');
const Datatypes = loader.Datatypes;

const User = loader.database.define(
  'users',
  {
    userId: {
      type: Datatypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    username: {
      type: Datatypes.STRING,
      allowNull: false
    }
  },
  {
    freezeTableName: true,
    timestamps: false
  }
);

module.exports = User;
