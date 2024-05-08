var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require("./funcs/logger");
var morganLogger = require("morgan");
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var testAPIRouter = require("./routes/testAPI");
var ovDoorRouter = require("./routes/ovDoor");
var restartRouter = require("./routes/restart");
var ipRouter = require("./routes/ip");
var logsRouter = require("./routes/logs");
var uploadRouter = require("./routes/upload");
const mqttClient = require("./funcs/mqtt");
const { execSync } = require('child_process');
const updateUserTime = require("./funcs/updateUsertime");

setInterval(updateUserTime, 60 * 1000);

  


var app = express();
var cors = require("cors");
// view engine setup

app.use(cors());
app.use(morganLogger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use("/testAPI", testAPIRouter);
app.use("/ovDoor", ovDoorRouter);
app.use("/restart", restartRouter);
app.use("/ip", ipRouter);
app.use("/logs", logsRouter);
app.use("/upload", uploadRouter);



try {
  const stdout = execSync('./setup.sh');
  logger.info(`Git pull stdout: ${stdout}`);
} catch (error) {
  logger.error(`Error pulling code from Git: ${error}`);
  return;
}



// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});
console.log("App.js is running")

module.exports = app;
