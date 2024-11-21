const announcement = require('./announcement');
const user = require('./user');
const feedback = require('./feedback');
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'index' });
});

router.use('/user',user);

router.use('/feedback',feedback);

router.use('/announcement', announcement);

module.exports = router;