const express = require('express');
const createError = require('http-errors');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const helmet = require('helmet');
const session = require('express-session');
const passport = require('passport');

// モデルの読み込み
const User = require('./models/user');
const Schedule = require('./models/schedule');
const Availability = require('./models/availability');
const Candidate = require('./models/candidate');
const Comment = require('./models/comment');

/**
 * データベースにモデルを登録する関数
 */
const syncDb = async () => {
  await User.sync();
  Schedule.belongsTo(User, {foreignKey: 'createdBy'});
  await Schedule.sync();
  Comment.belongsTo(User, {foreignKey: 'userId'});
  await Comment.sync();
  Availability.belongsTo(User, {foreignKey: 'userId'});
  await Candidate.sync();
  Availability.belongsTo(Candidate, {foreignKey: 'candidateId'});
  await Availability.sync();
};

syncDb();

const GitHubStrategy = require('passport-github2').Strategy;

const GITHUB_CLIENT_ID = '64b8d049ec7d60d85dc6';
const GITHUB_CLIENT_SECRET = '1c923017e27cd6aa2f7e6f7888e72ae95b1c35f1';

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(
  new GitHubStrategy(
    {
      clientID: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      callbackURL: 'http://localhost:8000/auth/github/callback',
    },
    (accessToken, refreshToken, profile, done) => {
      process.nextTick(() => {
        User.upsert({
          userId: profile.id,
          username: profile.username
        }).then(() => {
          done(null, profile);
        });
      });
    }
  )
);

const indexRouter = require('./routes/index');
const loginRouter = require('./routes/login');
const logoutRouter = require('./routes/logout');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(helmet());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: 'e55be81b307c1c09',
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.use('/', indexRouter);
app.use('/login', loginRouter);
app.use('/logout', logoutRouter);

app.get(
  '/auth/github',
  passport.authenticate('github', { scope: ['user:email'] }),
  () => {}
);

app.get(
  '/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/');
  }
);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
app.use((err, req, res) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
