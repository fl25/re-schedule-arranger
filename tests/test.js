/* eslint-disable jest/expect-expect */
const request = require('supertest');
const assert = require('assert');
const passportStub = require('passport-stub');
const app = require('../app');
const User = require('../models/user');
const Candidate = require('../models/candidate');
const Schedule = require('../models/schedule');
const Availability = require('../models/availability');
const Comment = require('../models/comment');

/**
 * 関数 deleteScheduleAggregate()
 * テストで作成したデータを削除する
 * @param {*} scheduleId 
 * @param {*} done 
 * @param {*} err 
 */
const deleteScheduleAggregate = (scheduleId, done, err) => {
  const promiseCommentDestroy = Comment.findAll({
    where: { scheduleId: scheduleId },
  }).then(comments => Promise.all(comments.map(c => c.destroy())));
  
  Availability.findAll({
    where: { scheduleId: scheduleId },
  })
    .then((availabilities) => {
    const promises = availabilities.map(a => a.destroy());
    return Promise.all(promises);
    })
    .then(() => {
      return Candidate.findAll({
        where: { scheduleId: scheduleId },
      });
    })
    .then((candidates) => {
      const promises = candidates.map(c => c.destroy());
      promises.push(promiseCommentDestroy);
      return Promise.all(promises);
    })
    .then(() => {
      return Schedule.findByPk(scheduleId).then(s => s.destroy());
    })
    .then(() => {
      if (err) return done(err);
      done();
    });
};

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
          .end((err) => {
            return deleteScheduleAggregate(createdSchedulePath.split('/schedules/')[1], done, err);
          });
        });
    });
  });
});

describe('/schedules/:scheduleId/users/:userId/candidates/:candidateId', () => {
  beforeAll(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  afterAll(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  test('出欠が更新できる', (done) => {
    User.upsert({ userId: 0, username: 'testuser' }).then(() => {
      request(app)
        .post('/schedules')
        .send({ scheduleName: 'テスト出欠更新予定１', memo: 'テスト出欠更新メモ１', candidates: 'テスト出欠更新候補１' })
        .end((err, res) => {
          const createdSchedulePath = res.headers.location;
          const scheduleId = createdSchedulePath.split('/schedules/')[1];
          Candidate.findOne({
            where: { scheduleId: scheduleId },
          }).then((candidate) => {
            // 更新がされることをテスト
            const userId = 0;
            request(app)
              .post(`/schedules/${scheduleId}/users/${userId}/candidates/${candidate.candidateId}`)

              // 出席(=2)に更新
              .send({ availability: 2 })
              .expect('{"status":"OK","availability":2}')
              .end((err, res) => {
                Availability.findAll({
                  where: { scheduleId: scheduleId },
                }).then((availabilities) => {
                  assert.equal(availabilities.length, 1);
                  assert.equal(availabilities[0].availability, 2);
                  deleteScheduleAggregate(scheduleId, done, err);
                });
              });
          });
        });
    });
  });
});

describe('/schedules/:scheduleId/users/:userId/comments', () => {
  beforeAll(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  afterAll(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  test('コメントが更新できる', (done) => {
    User.upsert({ userId: 0, username: 'testuser' }).then(() => {
      request(app)
        .post('/schedules')
        .send({ scheduleName: 'テストコメント更新予定１', memo: 'テストコメント更新メモ１', candidates: 'テストコメント更新候補１' })
        .end((err, res) => {
          const createdSchedulePath = res.headers.location;
          const scheduleId = createdSchedulePath.split('/schedules/')[1];

          // 更新がされることをテスト
          const userId = 0;
          request(app)
            .post(`/schedules/${scheduleId}/users/${userId}/comments`)
            .send({ comment: 'testcomment' })
            .expect('{"status":"OK","comment":"testcomment"}')
            .end((err, res) => {
              Comment.findAll({
                where: { scheduleId: scheduleId },
              }).then((comments) => {
                assert.equal(comments.length, 1);
                assert.equal(comments[0].comment, 'testcomment');
                deleteScheduleAggregate(scheduleId, done, err);
              });
            });
        });
    });
  });
});