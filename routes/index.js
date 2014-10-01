var express = require('express');
var fs = require('fs');
var moment = require('moment');
var scraper = require('./libs/gallery-scraper');
var router = express.Router();

/* GET home page. */
router.get('/:id?', function(req, res, next) {
	var id = req.params.id;
	if (!id) id = null;

	var agent = req.headers['user-agent'];
	if (agent.indexOf('iPhone')!=-1 || agent.indexOf('Android')!=-1) {
		return res.redirect('http://m.gom.heyo.me');
	}

	res.render('index', {
		title: 'heyo.me',
		article_id: id,
		day1go: moment().subtract(1, 'days').format('YYYY-MM-DD'),
		day2go: moment().subtract(2, 'days').format('YYYY-MM-DD'),
		session: req.session,
	});
});

router.get('/d/:date?', function(req, res, next) {
	var date = req.params.date;
	res.render('index', {
		title: 'heyo.me',
		date: date,
		day1go: moment().subtract(1, 'days').format('YYYY-MM-DD'),
		day2go: moment().subtract(2, 'days').format('YYYY-MM-DD'),
		session: req.session,
	});
});

router.get('/p/:page?', function(req, res, next) {
	var date = req.params.date;
	res.render('index', {
		title: 'heyo.me',
		page: page,
		day1go: moment().subtract(1, 'days').format('YYYY-MM-DD'),
		day2go: moment().subtract(2, 'days').format('YYYY-MM-DD'),
		session: req.session,
	});
});

router.get('/pc', function(req, res, next) {
	res.render('index', {
		title: 'heyo.me',
		session: req.session,
	});
});

/*
router.get('/view', function(req, res, next) {
	scraper.view(1, function(err, result) {
		if (err) {
			console.log(result);
			return next(err);
		}
		console.log(err);
		console.log(result);
		res.render('index', { title: 'Express' });
	});
});

router.get('/comments', function(req, res, next) {
	scraper.comments(1, 1, function(err, result) {
		if (err) {
			console.log(result);
			return next(err);
		}
		console.log(err);
		console.log(result);
		res.render('index', { title: 'Express' });
	});
});

router.post('/upload', function(req, res, next) {
	console.log(req.files);
	console.log(req.body);

	var files = [];
	for (var k in req.files) {
		var file = req.files[k];
		files.push({
			//name:file.fieldname,
			name:'files[]',
			filename:file.originalname,
			tmp_name:file.path,
		});
	}

	scraper.upload('cook.byus.net', '/info.php', '', 'utf-8', files, function(err, result) {
		if (err) {
			console.log(result);
			return next(err);
		}
		console.log(err);
		console.log(result);
		return res.render('index', { title: 'upload' });
	});
	//console.log(unescape('\uc9c0\uc6d0\ub418\uc9c0 \uc54a\ub294 \ud655\uc7a5\uc790 \uc785\ub2c8\ub2e4'));

	scraper.add_article({name:'aaa', subject:'fewojewoifjwoj', memo:'fj32ofj320fj320f0', password:'!@!@', files:files}, function(err, result) {
		if (err) {
			console.log(result);
			return next(err);
		}
		console.log(result);
		return res.render('index', { title: 'add-article' });
	});

	//return;
	//console.log('files:');
	//console.log(req.files);
	//return res.render('index', { title: 'upload' });

});

router.get('/add_comment', function(req, res, next) {
	scraper.add_comment(9859, {name:'aaa', memo:'fj32ofj320fj320f0', password:'!@!@'}, function(err, result) {
		if (err) {
			console.log(result);
			return next(err);
		}
		console.log(result);
		return res.render('index', { title: 'add-comment' });
	});
});

router.get('/db', function(req, res, next) {
	req.getConnection(function(err, conn) {
		if (err) return next(err);
		conn.query('select * from gom_articles limit 1', function(err, rows) {
			if (err) return next(err);
			console.log(rows);
			res.render('index', { title: 'Express' });
		});
	});
});
*/

module.exports = router;
