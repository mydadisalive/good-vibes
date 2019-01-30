const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const _ = require('lodash');
const express = require('express');
const TeleBot = require('slimbot');
const moment = require('moment');

const plotly = require('plotly')(process.env.PLOTLY_USER, process.env.PLOTLY_TOKEN);

const bot = new TeleBot(process.env.TELEGRAM_TOKEN);

const app = express();
const mlabUser = process.env.MLAB_USER;
const mlabPass = process.env.MLAB_PASS;
const mlabDb = process.env.MLAB_DB;

function connect() {
  return new Promise((resolve, reject) => {
    const mlabUrl = `mongodb://${mlabUser}:${mlabPass}@ds131743.mlab.com:31743/${mlabDb}`;
    MongoClient.connect(mlabUrl)
      .then((client) => {
        const db = client.db(mlabDb);
        return resolve(db);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

function isNumber(param) {
  return !Number.isNaN(+param);
}

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

async function feelGoodMessage(chatId) {
  const keyboard = {
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({
      inline_keyboard: [[
        { text: '-5', callback_data: '/-5' },
      ], [
        { text: '-4', callback_data: '/-4' },
        { text: '-3', callback_data: '/-3' },
        { text: '-2', callback_data: '/-2' },
      ], [
        { text: '-1', callback_data: '/-1' },
        { text: '0', callback_data: '/0' },
        { text: '1', callback_data: '/1' },
      ], [
        { text: '2', callback_data: '/2' },
        { text: '3', callback_data: '/3' },
        { text: '4', callback_data: '/4' },
      ], [
        { text: '5', callback_data: '/5' },
      ], [
        { text: 'create report', callback_data: '/report' },
        { text: 'stop', callback_data: '/stop' },
      ],
      ],
    }),
  };
  await bot.sendMessage(chatId, 'How you doing? (0 ok, 1 good, 2 very good, 3 amazing!, -1 not so well, -2 bad, -3 very bad)', keyboard);
}

async function createReport(chatId) {
  const db = await connect();
  const reports = await db.collection('report').find({ chatId }).sort({ date: 1 }).toArray();
  const x = [];
  const y = [];
  const type = 'scatter';
  reports.forEach((report) => {
    x.push(moment(report.date).format('YYYY-MM-DD H:mm:ss'));
    y.push(report.report);
  });
  const data = [{ x, y, type }];
  const graphOptions = {
    filename: `date-axes-test-${chatId}`,
    fileopt: 'overwrite',
  };
  return new Promise((resolve, reject) => {
    plotly.plot(data, graphOptions, (err, msg) => {
      if (err) {
        reject(err);
      } else {
        resolve(msg);
      }
    });
  });
}

app.get('/get-message', async (req, res) => {
  const db = await connect();
  const cursor = db.collection('users').find({ status: 'on' });
  for (let user = await cursor.next(); user != null; user = await cursor.next()) {
    console.log(`Sending message to ${user.firstName}`);
    if (user._id == 184823763) { // avicii id
    	await feelGoodMessage(user._id);
    }
  }
  res.send('get Hello World!');
});

app.post('/post-message', async (req, res) => {
  console.log(JSON.stringify(req.body, 2, 2));
  try {
    let messageBody = null;
    if (req.body.message != null) {
      messageBody = req.body.message;
    } else if (req.body.callback_query != null) {
      messageBody = req.body.callback_query.message;
    } else {
      return res.status('500').send('unknown');
    }

    let text = _.get(req.body, 'callback_query.data');
    if (!text) {
      ({ text } = messageBody);
    }
    if (text.charAt(0) === '/') {
      text = text.slice(1);
    }

    const date = new Date();
    const chatId = _.get(messageBody, 'chat.id');

    console.log({ text });
    console.log({ chatId });
    console.log({ date });

    const db = await connect();

    if (text === 'start') {
      // first message "/start"
      // will record the user in db
      const firstName = _.get(messageBody, 'chat.first_name');
      const lastName = _.get(messageBody, 'chat.last_name');
      const status = 'on';

      await db.collection('users').save({
        _id: chatId, firstName, lastName, date, status,
      });
      await bot.sendMessage(chatId, 'added user');
      await feelGoodMessage(chatId);
      return res.send('added user');
    }

    if (text === 'stop') {
      await db.collection('users').update({ _id: chatId }, { $set: { status: 'off' } });
      const replyMessage = 'shut off';
      console.log({ replyMessage });
      await bot.sendMessage(chatId, replyMessage);
      return res.send(replyMessage.url);
    }

    if (text === 'report') {
      const replyMessage = await createReport(chatId);
      console.log({ replyMessage });
      await bot.sendMessage(chatId, replyMessage.url);
      return res.send(replyMessage.url);
    }

    if (isNumber(text)) {
      const report = Number(text);
      console.log({ report });
      let replyMessage = 'shut off';
      if (report > 5 || report < -5) {
        replyMessage = 'report should be between -5 and 5';
      } else {
        await db.collection('report').insert({ chatId, report, date });
        if (report > 0) {
          replyMessage = 'doing good!';
        } else if (report <= -3) {
          replyMessage = 'Call for help!';
        } else {
          replyMessage = 'good vibes are coming';
        }
      }
      console.log({ replyMessage });
      await bot.sendMessage(chatId, replyMessage);
      return res.send(replyMessage);
    }

    await bot.sendMessage(chatId, 'bad text');
    return res.send('bad text');
    //
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});

module.exports.handler = serverless(app);
