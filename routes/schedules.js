const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const uuid = require('uuid');
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');
const User = require('../models/user');
const Availability = require('../models/availability');
const Comment = require('../models/comment');

/**
 * 関数 createCandidatesAndRedirect()
 * 候補の作成とリダイレクトを行う
 * @param {*} candidateNames 
 * @param {*} scheduleId 
 * @param {*} res 
 */
const createCandidatesAndRedirect = (candidateNames, scheduleId, res) => {
  const candidates = candidateNames.map((c) => {
    return {
      candidateName: c,
      scheduleId: scheduleId,
    };
  });
  Candidate.bulkCreate(candidates).then(() => {
    res.redirect('/schedules/' + scheduleId);
  });
};

/**
 * 関数 parseCandidateNames()
 * 候補日程の配列をパースする
 * @param {*} req 
 */
const parseCandidateNames = (req) => {
  return req.body.candidates.trim().split('\n').map(s => s.trim()).filter(s => s !== '');
};

// router 処理
router.get('/new', authenticationEnsurer, (req, res) => {
  res.render('new', { user: req.user });
});

router.post('/', authenticationEnsurer, (req, res) => {
  const scheduleId = uuid.v4();
  const updatedAt = new Date();
  Schedule.create({
    scheduleId: scheduleId,
    scheduleName: req.body.scheduleName.slice(0, 255) || '（名称未設定）',
    memo: req.body.memo,
    createdBy: req.user.id,
    updatedAt: updatedAt,
  }).then((schedule) => {
    createCandidatesAndRedirect(parseCandidateNames(req), scheduleId, res);
  });
});

router.get('/:scheduleId', authenticationEnsurer, (req, res, next) => {
  let storedSchedule = null;
  let storedCandidates = null;
  Schedule.findOne({
    include: [
      {
        model: User,
        attributes: ['userId', 'username'],
      }
    ],
    where: {
      scheduleId: req.params.scheduleId,
    },
    order: [['updatedAt', 'DESC']],
  })
    .then((schedule) => {
      if (schedule) {
        storedSchedule = schedule;
        return Candidate.findAll({
          where: { scheduleId: schedule.scheduleId },
          order: [['candidateId', 'ASC']]
        });
      } else {
        const err = new Error('指定された予定は見つかりません');
        err.status = 404;
        next(err);
      }
    })
    .then((candidates) => {
      // データベースからその予定の全ての出欠を取得する
      storedCandidates = candidates;
      return Availability.findAll({
        include: [
          {
            model: User,
            attributes: ['userId', 'username'],
          }
        ],
        where: { scheduleId: storedSchedule.scheduleId },
        order: [[User, 'username', 'ASC'], ['candidateId', 'ASC']],
      });
    })
    .then((availabilities) => {
      // 出欠 MapMap(キー:ユーザー ID, 値:出欠Map(キー:候補 ID, 値:出欠)) を作成する
      const availabilityMapMap = new Map();
      availabilities.forEach((a) => {
        const map = availabilityMapMap.get(a.user.userId) || new Map();
        map.set(a.candidateId, a.availability);

        // key: userId, value: Map(key: candidateId, availability)
        availabilityMapMap.set(a.user.userId, map);
      });

      // 閲覧ユーザーと出欠に紐づくユーザーからユーザー Map (キー:ユーザー ID, 値:ユーザー) を作る
      const userMap = new Map();

      // key: userId, value: User
      userMap.set(parseInt(req.user.id), {
        isSelf: true,
        userId: parseInt(req.user.id),
        username: req.user.username,
      });
      availabilities.forEach((a) => {
        userMap.set(a.user.userId, {
          // 閲覧ユーザー自身であるかを含める
          isSelf: parseInt(req.user.id) === a.user.userId,
          userId: a.user.userId,
          username: a.user.username,
        });
      });

      // 全ユーザー、全候補で二重ループしてそれぞれの出欠の値がない場合には、「欠席」を設定する
      const users = Array.from(userMap).map(keyValue => keyValue[1]);
      users.forEach((u) => {
        storedCandidates.forEach((c) => {
          const map = availabilityMapMap.get(u.userId) || new Map();

          // デフォルト値は0
          const a = map.get(c.candidateId) || 0;
          map.set(c.candidateId, a);
          availabilityMapMap.set(u.userId, map);
        });
      });

      // コメント取得
      return Comment.findAll({
        where: { scheduleId: storedSchedule.scheduleId },
      }).then((comments) => {
        const commentMap = new Map();
        comments.forEach((comment) => {
          // key: userId, value: comment
          commentMap.set(comment.userId, comment.comment);
        });
        res.render('schedule', {
          user: req.user,
          schedule: storedSchedule,
          candidates: storedCandidates,
          users: users,
          availabilityMapMap: availabilityMapMap,
          commentMap: commentMap,
        });
      });

    });

});

/**
 * 関数 isMySchedule()
 * schedule が自分の作成したものか判定する
 * @param {*} req 
 * @param {*} schedule 
 * @return {Boolean} 
 */
const isMySchedule = (req, schedule) => {
  return schedule && parseInt(schedule.createdBy) === parseInt(req.user.id);
};

router.get('/:scheduleId/edit', authenticationEnsurer, (req, res, next) => {
  let storedSchedule = null;
  Promise.resolve()
  .then(() => {
    return Schedule.findOne({
      where: {
        scheduleId: req.params.scheduleId,
      },
    });
  })
  .then((schedule) => {
    // 作成者のみが編集フォームを開ける
    if (isMySchedule(req, schedule)) return Promise.resolve(schedule);
    return Promise.reject();
  })
  .then((schedule) => {
    storedSchedule = schedule;
    return Candidate.findAll({
      where: { scheduleId: schedule.scheduleId },
      order: [['candidateId', 'ASC']],
    });
  })
  .then((candidates) => {
    res.render('edit', {
      user: req.user,
      schedule: storedSchedule,
      candidates: candidates,
    });
    return Promise.resolve();
  })
  .catch(() => {
    const err = new Error('指定された予定がない、または、予定する権限がありません');
    err.status = 404;
    next(err);
  });

});

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

router.deleteScheduleAggregate = deleteScheduleAggregate;


router.post('/:scheduleId', authenticationEnsurer, (req, res, next) => {
  Schedule.findOne({
    where: {
      scheduleId: req.params.scheduleId,
    },
  }).then((schedule) => {
    if (schedule && isMySchedule(req, schedule)) {
      if (parseInt(req.query.edit) === 1) {
        const updatedAt = new Date();
        schedule.update({
          scheduleId: schedule.scheduleId,
          scheduleName: req.body.scheduleName.slice(0, 255) || '（名称未設定）',
          memo: req.body.memo,
          createdBy: req.user.id,
          updatedAt: updatedAt,
        }).then((schedule) => {
          // 追加されているかチェック
          const candidateNames = parseCandidateNames(req);
          if (candidateNames) {
            createCandidatesAndRedirect(candidateNames, schedule.scheduleId, res);
          } else {
            res.redirect('/schedules/' + schedule.scheduleId);
          }
        });
      } else if (parseInt(req.query.delete) === 1) {
        deleteScheduleAggregate(req.params.scheduleId, () => {
          res.redirect('/');
        });
      } else {
        const err = new Error('不正なリクエストです');
        err.status = 400;
        next(err);
      }
    } else {
      const err = new Error('指定された予定がない、または、編集する権限がありません');
      err.status = 404;
      next(err);
    }
  });
});


module.exports = router;