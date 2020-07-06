/* eslint-disable jest/expect-expect */
const request = require('supertest');
const passportStub = require('passport-stub');
const app = require('../app');
const User = require('../models/user');
const Candidate = require('../models/candidate');
const Schedule = require('../models/schedule');

describe('/login', () => {
  beforeAll(() => {
    passportStub.install(app);
    passportStub.login({ username: 'testuser' });
  });

  afterAll(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  test('ログインのためのリンクが含まれる', () => {
    return request(app)
      .get('/login')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(/<a href="\/auth\/github"/)
      .expect(200);
  });

  test('ログイン時はユーザー名が表示される', () => {
    return request(app)
      .get('/login')
      .expect(/testuser/)
      .expect(200);
  });
});

describe('/logout', () => {
  test('/ にリダイレクトされる', () => {
    return request(app).get('/logout').expect('Location', '/').expect(302);
  });
});

describe('/schedules', () => {
  beforeAll(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  afterAll(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  test('予定が作成でき、表示される', (done) => {
    User.upsert({ userId: 0, username: 'testuser' }).then(() => {
      request(app)
        .post('/schedules')
        .send({
          scheduleName: 'テスト予定１',
          memo: 'テストメモ１\r\nテストメモ２',
          candidates: 'テスト候補１\r\nテスト候補２\r\nテスト候補３',
        })
        .expect('Location', /schedules/)
        .expect(302)
        .end((err, res) => {
          const createdSchedulePath = res.headers.location;
          request(app)
          .get(createdSchedulePath)
          // sendした情報と照合する
          .expect(/テスト予定１/)
          .expect(/テストメモ１/)
          .expect(/テストメモ２/)
          .expect(/テスト候補１/)
          .expect(/テスト候補２/)
          .expect(/テスト候補３/)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);

            // テストで作成したデータを削除する
            const scheduleId = createdSchedulePath.split('/schedules/')[1];
            Candidate.findAll({
              where: { scheduleId: scheduleId },
            }).then((candidates) => {
              const promises = candidates.map(c => c.destroy());
              Promise.all(promises).then(() => {
                Schedule.findByPk(scheduleId).then(s => s.destroy().then(() => {
                  if (err) return done(err);
                  done();
                }));
              });
            });
          });
        });
    });
  });
});
