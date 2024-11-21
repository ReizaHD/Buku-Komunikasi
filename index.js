// api/index.js
const express = require('express');
const path = require('path');
const app = express();
const apiRoutes = require('./routes/api');
const viewRoutes = require('./routes/views');
global.__basedir = __dirname;

app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', viewRoutes);

app.use('/api', apiRoutes);

module.exports = app;
