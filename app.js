var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var RedisStore = require('connect-redis')(session);

var mysql = require('mysql');
var multer = require('multer');
var connection = require('express-myconnection'); 

var routes = require('./routes/index');
var articles = require('./routes/articles');

var app = express();
var ECT = require('ect');
var ectRenderer = ECT({ watch: true, root: __dirname + '/views', ext : '.ect' });

// view engine setup
app.engine('ect', ectRenderer.render);
app.set("views", __dirname + '/views');
app.set("view engine", "ect");

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
	secret:'mintgom#2014#@)',
	saveUninitialized: true,
	resave:true,
	store: new RedisStore({
		host: '127.0.0.1',
		port: 6379
	}),
}));
// multipart upload
app.use(multer({ dest: 'files/'}))

app.use(
    connection(mysql,{
        host: 'localhost',
        user: 'gom',
        password : 'gom!@!@',
        port : 3306, //port mysql
        database:'gom'
    },'request')
);

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/articles', articles);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
	        status: err.status || 500,
			req: req,
			res: res,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        status: err.status || 500,
		req: req,
		res: res,
        error: {}
    });
});

module.exports = app;
