var fs = require('fs');
var crypto = require('crypto');
var util = require('util');
var async = require('async');
var moment = require('moment');
var express = require('express');
var cheerio = require('cheerio');
var mysql = require('mysql');
var im = require('imagemagick');
var scraper = require('./libs/gallery-scraper');
var router = express.Router();

var pool = mysql.createPool({
    host: 'localhost',
    port: 9306,
    user: '',
});

function _rand(low, high) {
	return Math.floor(Math.random() * (high - low) + low);
};

function _md5(param) {
	var md5hash = crypto.createHash('md5');
	md5hash.update(param);
	return md5hash.digest('hex');
}

function _clientip(req) {
        return (req.headers['x-forwarded-for'] || '').split(',')[0] 
        || req.connection.remoteAddress;
};

function _touch(path) {
	try {
		fs.openSync(path, 'w');
		fs.utimesSync(path, moment().unix(), moment().unix());
	} catch(e) {};
}
function _ctime(path) {
	var ctime = 0;
	try {
		ctime = fs.statSync(path)['ctime'];
	} catch (e) {}
	return ctime;
}

function _page_helper(id, conn, callback) {
	id = parseInt(id);
	var updated = moment().subtract(10, 'minutes');
	conn.query('select * from gom_pages where updated >= ? and last_article_id > ? order by id desc', [updated.format('YYYY-MM-DD HH:mm:ss'), id], function(err, rows) {
		var page = 0;
		var helper = {};
		if (rows && rows.length) {
			helper = rows[0];
		}
		if (helper) {
			page = parseInt(helper.id) + Math.ceil((parseInt(helper.last_article_id) - parseInt(id)) / 25);
			return callback(page);
		} else {
			var max_id = 0;
			var notice_count = 0;
			async.series([
				function(next) {
					conn.query('select * from gom_articles order by id desc limit 1', function(err, rows) {
						console.log(rows);
						max_id = parseInt(rows[0].id);
						next();
					});
				}, 
				function(next) {
					conn.query('select count(*) from gom_articles where is_notice = 1', function(err, rows) {
						console.log(rows);
						notice_count = parseInt(rows[0]['count(*)']);
						next();
					});
				}
			], function(err) {
				console.log(max_id);
				console.log(id);
				console.log(notice_count);
				page = Math.ceil((max_id - id + notice_count) / 25);
				return callback(page);
			});
		}
	});
}

function _page(page, conn, callback) {
	if (!page) page = 1;
	scraper.list(page, function(err, result) {
		var list = [];
		if (err) {
			console.log(result);
			return callback(null);
		}
		list = result;

		var last_article_id = 0;
		var gap = 0;
		var min = 0;
		var first_article_id = 0;
		var last_article_id = 0;

		list.forEach(function(row) {
			var article_id = parseInt(row.id);
			if (!min || gap > Math.abs(last_article_id - article_id)) {
				gap = Math.abs(last_article_id - article_id);
				min = last_article_id;
				if (gap==1) return;
			}
			last_article_id = article_id;
		});

		list.forEach(function(row) {
			var article_id = parseInt(row.id);
			if (article_id <= min + 40 && article_id >= min - 40) {
				if (!first_article_id) first_article_id = article_id;
				last_article_id = article_id;
			}
		});

		var data = {
			id: page,
			first_article_id: first_article_id,
			last_article_id: last_article_id,
			updated: moment().format('YYYY-MM-DD HH:mm:ss'),
		};
		conn.query('insert into gom_pages set ? on duplicate key update ?', [util._extend(data,{created:data.updated}),data], function(err, result) {
			if (err) return callback('추가(수정)하지 못하였습니다.');
			console.log('page saved');
			callback({
				first_article_id: first_article_id,
				last_article_id: last_article_id,
				list: list
			});
		});
	});
}

function _image_list(content) {
	if (!content) return null;
	var $ = cheerio.load(content, {
		decodeEntities: false
	});
	var image_list = [];
	$('img').each(function() {
		var src = $(this).attr('src');
		if (!src) return;
		if (src.indexOf('http://wstatic.dcinside.com')!=-1) return;
		if (src.indexOf('http://zzbang.dcinside.com')!=-1) return;
		if (src.indexOf('http://heyo.me/logo.php')!=-1) return;

		src = src.replace(/dcimg2\.dcinside\.com\/viewimage\.php/g, 'image.dcinside.com/viewimage.php');
		src = src.replace(/dcimg1\.dcinside\.com\/viewimage\.php/g, 'image.dcinside.com/viewimage.php');
		src = src.replace(/dcimg2\.dcinside\.co.kr\/viewimage\.php/g, 'image.dcinside.com/viewimage.php');
		src = src.replace(/dcimg1\.dcinside\.co.kr\/viewimage\.php/g, 'image.dcinside.com/viewimage.php');
		//src = src.replace(/img2\.dcinside\.com\/viewimage\.php/g, 'image.dcinside.com/viewimage.php');
		//src = src.replace(/img1\.dcinside\.com\/viewimage\.php/g, 'image.dcinside.com/viewimage.php');
		src = src.replace(/&amp;/g, '&');
		image_list.push(src);
	});
	return image_list;
}

function _random_hint(hint, count, conn, callback) {
	if (!count) count = 1;
	//var row_count = 0;
	//var min_id = 0;
	//var max_id = 0;
	var ids = [];
	var ret_list = [];
	//var try_count = count * 2;
	var where = "is_delete=0 and hwawon_temp=0 and random=0 and image=1";
	if (hint) where += " and match('"+hint+"')";
	async.series([
		function(next) {
			console.log('$1');
			pool.getConnection(function(err, connection) {
				console.log('$2');
				connection.query('select id from article where '+where+' order by rand() limit '+count, function(err, rows) {
					connection.release(); // return to pool before evaluating error.
					console.log('$3');
					if (err || !rows || !rows.length) return callback(null);
					for (var i=0; i<rows.length; i++) {
						ids.push(rows[i]['id']);
					}
					next();
				});
			});
		},
		function(next) {
			console.log('$4');
			conn.query('select id, content from gom_articles where id in (?)', [ids], function(err, rows) {
				console.log('$5');
				if (err || !rows || !rows.length) return callback(null);
				for (var i=0; i<rows.length; i++) {
					var row = rows[i];
					var image_list = _image_list(row.content);
					//console.log(image_list);
					if (image_list && image_list.length) {
						ret_list.push([row.id, image_list[_rand(0, image_list.length-1)]]);
					}
				}
				next();
			});
		},
	], function(err) {
		//console.log(ret_list);
		return callback(ret_list);
	});
}

function _random_hint_old(hint, count, conn, callback) {
	if (!count) count = 1;
	//var row_count = 0;
	var min_id = 0;
	var max_id = 0;
	var ret_list = [];
	var try_count = count * 2;
	var where = "is_delete=0 and hwawon_temp=0 and random=0 and image=1";
	if (hint) where += " and match(subject,content_hint) against ('"+hint+"*' in boolean mode)";
	async.series([
		/*
		function(next) {
			conn.query('select count(id) from gom_articles where '+where, function(err, rows) {
				if (err || !rows || !rows.length) return callback(null);
				row_count = parseInt(rows[0]['count(id)']);
				if (!row_count) return callback(null);
				console.log(row_count);
				next();
			});
		},*/
		function(next) {
			conn.query('select id from gom_articles where '+where+' order by id asc limit 1', function(err, rows) {
				if (err || !rows || !rows.length) return callback(null);
				min_id = parseInt(rows[0].id);
				console.log(min_id);
				next();
			});
		},
		function(next) {
			conn.query('select id from gom_articles where '+where+' order by id desc limit 1', function(err, rows) {
				if (err || !rows || !rows.length) return callback(null);
				max_id = parseInt(rows[0].id);
				console.log(max_id);
				next();
			});
		},
	], function(err) {
		var pick_image = function() {
			var rand_id = _rand(min_id, max_id);
			console.log(rand_id);
			conn.query('select id,content from gom_articles where '+where+' and id <= '+rand_id+' order by id desc limit 1', function(err, rows) {
				var row = rows[0];
				var image_list = _image_list(row.content);
				if (image_list && image_list.length) {
					ret_list.push([row.id, image_list[_rand(0, image_list.length-1)]]);
				}
				if (ret_list.length==count) {
					return callback(ret_list);
				}
				if (--try_count==0) {
					return callback(ret_list);
				}
				pick_image();
			});
		};
		pick_image();
	});
}

router.get('/random_image_list', function(req, res) {
	console.log(req.headers);

	req.getConnection(function(err, conn) {
		_random_hint('', 9, conn, function(result) {
			console.log(result);
			res.render('articles/random_image_list', { list: result });
			//res.send(result);
		});
	});
});

router.get('/real_random', function(req, res) {
	req.getConnection(function(err, conn) {
		_random_hint('', 9, conn, function(result) {
			//console.log(result);

			//var item = result[0];
			async.eachSeries(result, function(it, next) {
				console.log('it[1]:'+it[1]);
				scraper.urlcheck(it[1], function(err, check) {
					if (!err && check && check!='0') {
						//console.log('check:'+check);
						//return;
					}
					console.log('err:'+check);
					next();
				});
			});
		});
	});
	res.end();
});

router.use('/logout', function(req, res) {
	req.session.destroy();
	res.redirect('/');
});

router.post('/login', function(req, res) {
	var userid = req.body.userid;
	var password = req.body.password;
	var force_cookie = req.body.cookie;

	if (force_cookie) {
		req.session['loginCookies'] = require('querystring').parse(force_cookie.replace(/; /g, '&'));
		console.log(req.session['loginCookies']);
		req.session['loginName'] = userid;
		req.session['loginUserId'] = userid;
		res.json({
			success: true,
			message: '로그인하였습니다.',
			name: userid,
		});
		return;
	}

	scraper.login(userid, password, function(err, result, cookies) {
		if (err) {
			return res.json({
				success: false,
				message: result,
			});
		}

		console.log(cookies);
		req.session['loginCookies'] = cookies;
		req.session['loginName'] = result.nickname;
		req.session['loginUserId'] = userid;

		res.json({
			success: true,
			message: '로그인하였습니다.',
			name: result.nickname,
		});
	});
});

router.get('/article/:id?', function(req, res) {
	var id = req.params.id;
	var article = {};
	var force = req.query.force;
	req.getConnection(function(err, conn) {
		conn.query('select * from gom_articles where id = ?', id, function(err, rows) {
			if (rows && rows.length) {
				article = rows[0];
				article.detail_date = moment(article.detail_date).format('YYYY-MM-DD HH:mm:ss');
				article.date = moment(article.date).format('YYYY-MM-DD');
				article.updated = moment(article.updated).format('YYYY-MM-DD HH:mm:ss');
				article.created = moment(article.created).format('YYYY-MM-DD HH:mm:ss');
				//delete article.content_hint;
			}
			console.log('detail_updated:'+article.detail_updated);
			var timediff = moment().diff(moment(article.detail_updated), 'minutes');

			if (force || !article || (!article.is_delete && (!article.content || (article.content && timediff >= 5)))) {
				scraper.view(id, function(err, data) {
					if (err) {
						res.json(article);
						return;
					}
					if (article.content && article.content!=data.content) {
						data.is_sphinx = '0';
					}
					data.detail_updated = moment().format('YYYY-MM-DD HH:mm:ss');
					conn.query('insert into gom_articles set ? on duplicate key update ?', [util._extend(data,{created:data.detail_updated}),data], function(err, result) {
						if (err) {
							res.json(article);
							return;
						}
						console.log('article saved');
						article = util._extend(article, data);
						res.json(article);
					});
				});
			} else {
				res.json(article);
			}
		});

	});
});

router.get('/select/:id', function(req, res) {
	req.getConnection(function(err, conn) {
		var locals = {
			id: parseInt(req.params.id),
			first_article_id: 0,
			last_article_id: 0,
			page: 0,
			list : [],
		};
		console.log('#id ' + locals.id);

		var tasks = [];

		tasks.push(function(next) {
			console.log('#1');
			_page_helper(locals.id, conn, function(page) {
				console.log('page:'+page);
				locals.page = page;
				next();
			});
		});

		tasks.push(function(next) {
			console.log('#2');
			console.log(locals.id+', '+(locals.id - 25));
			conn.query('select * from gom_articles where id <= ? and id > ? order by id desc', [locals.id, locals.id - 25], function(err, rows) {
				if (!rows || !rows.length) {
					return next();
				}
				locals.list = rows;
				locals.first_article_id = rows[0].id;
				locals.last_article_id = rows[rows.length-1].id;
				next();
			});
		});

		tasks.push(function(next) {
			console.log('#3');
			var timediff = 0;
			if (locals.list && locals.list.length) {
				timediff = moment().diff(moment(locals.list[0].updated), 'minutes');
			}
			console.log(locals.list.length)
			console.log(timediff)
			if (locals.list.length < 25 || (locals.list.length >= 25 && timediff > 5 * locals.page)) {
				var update_list = [];
				async.series([
					function(sub_next) {
						console.log('#3-1');
						_page(locals.page, conn, function(result) {
							if (typeof(result)=='object') {
								update_list = result.list;
								locals.first_article_id = result.first_article_id;
								locals.last_article_id = result.last_article_id;
								sub_next();
							}
						});
					},
					function(sub_next) {
						console.log('#3-2');
						if (locals.first_article_id < locals.id) {
							_page(locals.page - 1, conn, function(result) {
								if (typeof(result)=='object') {
									var prev_list = result.list;
									locals.first_article_id = result.first_article_id;
									update_list = prev_list.concat(update_list);
									sub_next();
								}
							});
						} else if (locals.last_article_id > locals.id) {
							_page(locals.page + 1, conn, function(result) {
								if (typeof(result)=='object') {
									var next_list = result.list;
									locals.last_article_id = result.last_article_id;
									update_list = update_list.concat(next_list);
									sub_next();
								}
							});
						} else {
							sub_next();
						}
					},
				], function(err) {
					console.log('#3-3');
					if (update_list && update_list.length)  {
						console.log('update_list save-all');
						update_list.forEach(function(data) {
							data.updated = moment().format('YYYY-MM-DD HH:mm:ss');
							conn.query('insert into gom_articles set ? on duplicate key update ?', [util._extend(data,{created:data.updated}),data], function(err, result) {
								if (err) {
									console.log(result);
									return;
								}
								//console.log(result);
							});
						});
						//if (locals.list.length < 25) locals.list = update_list;
						next();
					}
				});
			} else {
				next();
			}
		});

		async.series(tasks, function(err) {
			locals.list.forEach(function(row) {
				row.image_list = _image_list(row.content);
				if (row.content) {
					if (row.content_hint) {
						row.content = row.content_hint;
					} else {
						row.content = '.';
					}
				}
				delete row.content_hint;
				if (row.detail_date) {
					row.detail_date = moment(row.detail_date).format('YYYY-MM-DD HH:mm:ss');
				}
				row.date = moment(row.date).format('YYYY-MM-DD');
			});
			res.json({
				optional: {
					first_article_id:locals.first_article_id,
					last_article_id:locals.last_article_id,
				},
				list:locals.list
			});
		});
		
	});
});

router.get('/list_issue', function(req, res) {
	req.getConnection(function(err, conn) {
		var day1ago = moment().subtract(1, 'days').format('YYYY-MM-DD HH:mm:ss');

		conn.query('select * from gom_articles where detail_date >= ? order by hit_count desc limit 25', [day1ago], function(err, rows) {
			if (!rows || !rows.length) {
				if (err) {
					console.log(err);
				}
				return res.json({});
			}

			rows.forEach(function(row) {
				row.image_list = _image_list(row.content);
				if (row.content) {
					if (row.content_hint) {
						row.content = row.content_hint;
					} else {
						row.content = '.';
					}
				}
				delete row.content_hint;
				if (row.detail_date) {
					row.detail_date = moment(row.detail_date).format('YYYY-MM-DD HH:mm:ss');
				}
				row.date = moment(row.date).format('YYYY-MM-DD');
			});

			res.json({list:rows});
		});
		
	});
});

router.get('/list_delete', function(req, res) {
	req.getConnection(function(err, conn) {
		var day2ago = moment().subtract(2, 'days').format('YYYY-MM-DD HH:mm:ss');

		conn.query('select * from gom_articles where detail_date >= ? and is_delete = 1 and is_notice = 0 order by id desc limit 25', [day2ago], function(err, rows) {
			if (!rows || !rows.length) {
				return res.json({});
			}

			rows.forEach(function(row) {
				row.image_list = _image_list(row.content);
				if (row.content) {
					if (row.content_hint) {
						row.content = row.content_hint;
					} else {
						row.content = '.';
					}
				}
				delete row.content_hint;
				if (row.detail_date) {
					row.detail_date = moment(row.detail_date).format('YYYY-MM-DD HH:mm:ss');
				}
				row.date = moment(row.date).format('YYYY-MM-DD');
			});

			res.json({list:rows});
		});
		
	});
});

router.get('/notice', function(req, res) {
	req.getConnection(function(err, conn) {
		conn.query('select * from gom_articles where is_notice = 1 order by id desc', function(err, rows) {
			if (!rows || !rows.length) {
				return res.json({});
			}

			rows.forEach(function(row) {
				row.image_list = _image_list(row.content);
				if (row.content) {
					if (row.content_hint) {
						row.content = row.content_hint;
					} else {
						row.content = '.';
					}
				}
				delete row.content_hint;
				if (row.detail_date) {
					row.detail_date = moment(row.detail_date).format('YYYY-MM-DD HH:mm:ss');
				}
				row.date = moment(row.date).format('YYYY-MM-DD');
			});

			res.json({list:rows});
		});
		
	});
});

router.get('/recent/:force?', function(req, res) {
	console.log('req.session.view:'+req.session.view);
	req.session.view = Math.random();
	req.getConnection(function(err, conn) {
		var force = req.params.force;
		var first_article_id = 0;
		var last_article_id = 0;
		var list = [];

		var tasks = [];

		var tmpfile = __dirname+'/../tmp/list_updated';
		var ctime = _ctime(tmpfile);
		var timediff = moment().diff(moment(ctime), 'minutes');
		console.log('force:'+force);
		console.log('timediff:'+timediff);
		if (force=='true' || timediff > 5) {
			console.log('reload');
			_touch(tmpfile);

			tasks.push(function(next) {
				// force
				_page(1, conn, function(result) {
					if (typeof(result)=='object') {
						list = result.list;
						first_article_id = result.first_article_id;
						last_article_id = result.last_article_id;

						// save all
						console.log('save-all');
						list.forEach(function(data) {
							data.updated = moment().format('YYYY-MM-DD HH:mm:ss');
							conn.query('insert into gom_articles set ? on duplicate key update ?', [util._extend(data,{created:data.updated}),data], function(err, result) {
								if (err) {
									console.log(result);
									return;
								}
								//console.log(result);
							});
						});

						next();
					}
				});
			});
		}

		tasks.push(function(next) {
			conn.query('select * from gom_articles where is_notice = 0 order by id desc limit 25', function(err, rows) {
				if (err) throw err;
				if (!rows) rows = [];
				if (rows.length > 0) {
					first_article_id = rows[0].id;
					last_article_id = rows[rows.length-1].id;
					list = rows;
				}
				console.log('#next');
				next();
			});
		});

		async.series(tasks, function(err) {
			list.forEach(function(row) {
				row.image_list = _image_list(row.content);
				if (row.content) {
					if (row.content_hint) {
						row.content = row.content_hint;
					} else {
						row.content = '.';
					}
				}
				delete row.content_hint;
				if (row.detail_date) {
					row.detail_date = moment(row.detail_date).format('YYYY-MM-DD HH:mm:ss');
				}
				row.date = moment(row.date).format('YYYY-MM-DD');
			});
			res.json({
				optional: {
					first_article_id:first_article_id,
					last_article_id:last_article_id
				},
				list:list
			});
		});

	});
});

router.get('/recent_comments', function(req, res) {
	req.getConnection(function(err, conn) {

		conn.query('select * from gom_comments order by date desc limit 10', function(err, rows) {
			if (!rows || !rows.length) {
				return res.json({});
			}

			rows.forEach(function(row) {
				row.date = moment(row.date).format('YYYY-MM-DD HH:mm:ss');
			});

			res.json(rows);
		});
		
	});
});

router.get('/comments/:no/:page?', function(req, res) {
	req.getConnection(function(err, conn) {
		var locals = {
			page: req.params.page?parseInt(req.params.page):1,
			no: parseInt(req.params.no),
			last_created: 0,
		};
		console.log(locals);
		var tasks = [];

		tasks.push(function(next) {
			conn.query('select created from gom_comments where page = ? and article_id = ? order by date desc', [locals.page, locals.no], function(err, rows) {
				if (rows && rows.length) {
					locals.last_created = rows[0].created;
				}
				next();
			});
		});

		tasks.push(function(next) {
			var timediff = moment().diff(moment(locals.last_created), 'minutes');
			if (locals.page == 1 || timediff > 1 * locals.page) {
				scraper.comments(locals.no, locals.page, function(err, list) {
					if (err) {
						console.log(err);
						next();
						return;
					}
					if (list && list.length) {
						conn.query('delete from gom_comments where article_id = ? and page = ?', [locals.no, locals.page], function(err, result) {
							if (err) {
								console.log(err);
								next();
								return;
							}
							// save all
							console.log('save-all');
							list.forEach(function(data) {
								var updated = moment().format('YYYY-MM-DD HH:mm:ss');
								conn.query('insert into gom_comments set ? on duplicate key update ?', [util._extend(data,{created:updated}),data], function(err, result) {
									if (err) {
										console.log(err);
										next();
										return;
									}
								});
							});

							next();
						});
					} else {
						next();
					}
				});
			}
		});

		async.series(tasks, function(err) {
			conn.query('select * from gom_comments where article_id = ? and page = ? order by date desc', [locals.no, locals.page], function(err, rows) {
				if (err) throw err;
				if (!rows) rows = [];
				//console.log(rows);
				rows.forEach(function(row) {
					row.date = moment(row.date).format('YYYY-MM-DD HH:mm:ss');
				});
				res.json(rows);
			});
		});

	});
});

router.post('/add_comment/:no', function(req, res) {
	var no = req.params.no;

	req.getConnection(function(err, conn) {
		var form = req.body;
		form.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

		if (form && form.name && form.memo && form.password) {
			form.memo = form.memo + " ㉳";
			if (!req.session.loginCookies) {
				var ip = _clientip(req);
				var ipnode = ip.split('.');
				form.memo = ' '+form.memo+ipnode[0];
				if (ip.length >= 2) {
					form.memo += '.'+ipnode[1];
				}
			}

			scraper.add_comment(no, form, req.session.loginCookies, function(err, result) {
				if (err) {
					res.send(result);
					return;
				}
				res.send('등록되었습니다.');
			});
		} else {
			req.send('입력값이 잘못되었습니다.');
		}
	});
});

router.post('/add_article', function(req, res) {
	req.getConnection(function(err, conn) {
		var tasks = [];
		var form = req.body;
		console.log(form);

		form.password = 'ba0924!@!@';
		//form.password = '!@!@';
		form.memo = form.content.replace(/\n/g, '<br/>');
		form.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

		if (form && form.name && form.subject && form.memo && form.password) {
			form.files = [];
			var prefix_list = [];
			var postfix_list = [];

			if (form.rand_mode && form.rand_mode!="none") {
				form.files.push({
					'name': 'files[]',
					'filename': "random.jpg",
					'tmp_name': '/home/gom/www/img/random.gif',
				});
			}

			tasks.push(function(next) {
				if (form.rand_mode=='hint' || form.rand_mode=='real') {
					_random_hint('', 9, conn, function(result) {
						//console.log(result);

						//var item = result[0];
						async.eachSeries(result, function(item, callback) {
							var rand_id = item[0];
							var rand_img = item[1];
							console.log('rand_id:'+rand_id);
							scraper.urlcheck(rand_img, function(err, check) {
								if (!err && check && check!='0') {
									console.log('check:'+check);

									prefix_list.push('<img src="'+rand_img+'"/><br/>');
									if (form.rand_hint) {
										prefix_list.push('<p><a href="http://gall.dcinside.com/list.php?id=hwawon&no='+rand_id+'" target="_blank"><font color="#c8c8c8">랜덤짤 출처 (@'+rand_id+' 힌트:'+form.rand_hint+')</font></a></p>');
									} else {
										prefix_list.push('<p><a href="http://gall.dcinside.com/list.php?id=hwawon&no='+rand_id+'" target="_blank"><font color="#c8c8c8">랜덤짤 출처 (@'+rand_id+')</font></a></p>');
									}

									form.random = 1;

									next();
									return;
								}
								console.log('err:'+check);
								callback();
							});
						}, function() {
							prefix_list.push('꽝.');
							next();
						});
					});
					/*
					_random_hint(form.rand_hint, 3, conn, function(result) {
						console.log('--ramdom--');
						console.log(result);
						var item = result[0];
						result.each(function(it) {
							if (it[1].indexOf('/img1.')=-1 && it[1].indexOf('/img2.')=-1) {
								item = it;
								return;
							}
						});
						var rand_id = '';
						var rand_image = '';
						if (item && item.length>=2) {
							rand_id = item[0];
							rand_image = item[1];
							console.log('push push');
							prefix_list.push('<img src="'+rand_image+'"/><br/>');
							form.random = 1;
						} else {
							prefix_list.push('꽝.');
						}
						
						if (rand_id) {
							if (form.rand_hint) {
								prefix_list.push('<p><a href="http://gall.dcinside.com/list.php?id=hwawon&no='+rand_id+'" target="_blank"><font color="#c8c8c8">랜덤짤 출처 (@'+rand_id+' 힌트:'+form.rand_hint+')</font></a></p>');
							} else {
								prefix_list.push('<p><a href="http://gall.dcinside.com/list.php?id=hwawon&no='+rand_id+'" target="_blank"><font color="#c8c8c8">랜덤짤 출처 (@'+rand_id+')</font></a></p>');
							}
						}
						next();
					});
					*/
				} else if (form.rand_mode=="select" || form.rand_mode=="recent") {
					if (form.rand_select_id && form.rand_select_img) {
						form.random = 1;
						prefix_list.push('<img src="'+form.rand_select_img+'"/><br/>');
						prefix_list.push('<p><a href="http://gall.dcinside.com/list.php?id=hwawon&no='+form.rand_select_id+'" target="_blank"><font color="#c8c8c8">랜덤짤 출처 (@'+form.rand_select_id+' 선택)</font></a></p>');
						next();
					}
				} else {
					next();
				}
			});

			tasks.push(function(next) {
				// files
				console.log(typeof(req.files));
				if (req.files) {
					for (var k in req.files) {
						var file = req.files[k];
						form.files.push({
							name:'files[]',
							filename:file.originalname,
							tmp_name:file.path,
						});
					}
				}

				console.log('prefix_list.length '+prefix_list.length);
				if (prefix_list.length) {
					form.memo = prefix_list.join("<br/>")+"<br/><br/><br/>"+form.memo;
					console.log(form.memo);
				}
				if (postfix_list.length) {
					form.memo = form.memo+"<br/><br/><br/>"+postfix_list.join("<br/>");
				}

				console.log(form);
				next();
			});

			async.series(tasks, function(err) {
				form.memo = form.memo+"<br/><br/><br/><br/> <p>by <img src=\"http://img.gom.heyo.me/logo.php\" align=\"absmiddle\"> <a href=\"http://gom.heyo.me\">gom.heyo.me</a></p>";
				if (!req.session.loginCookies) {
					var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
					var ipnode = ip.split('.');
					if (ipnode.length<2) ipnode.push('?');
					form.memo = form.memo+"<p><font color=\"#c8c8c8\">IP : "+ipnode[0]+'.'+ipnode[1]+".***.***</font></p>";
				}

				scraper.add_article(form, req.session.loginCookies, function(err, result) {
					console.log(result);
					if (err) {
						res.json({success:false,message:result,code:err});
						return;
					}
					res.json({success:true,message:'등록되었습니다.',no:result});
				});
			});
		} else {
			res.json({success:false,message:'입력값이 잘못되었습니다.'});
		}
	});
});

/*
var request = require('request');
router.get('/thumb', function(req, res) {
	var width = req.query.width;
	var height = req.query.height;
	var url = req.query.url;
	var opt = req.query.opt;
	opt = Math.ceil(opt / 1000) * 1000;

	request.get(url).pipe(res);
});
*/
/*
router.get('/thumb', function(req, res) {
	var width = req.query.width;
	var height = req.query.height;
	var url = req.query.url;
	var opt = req.query.opt;
	opt = Math.ceil(opt / 1000) * 1000;

	if (!width) width = 80;
	var cut = true;
	if (!url) {
		return res.end();
	}
	if (!width) {
		return res.end();
	}

	var alias = url;
	if (url.substring(0, 7).toLowerCase()=="http://") {
		alias = url.substring(7);
	}
	alias = _md5(url);

	// config
	base_path = '/home/gom/www';
	temp_path = '/home/gom/www';

	if (height) {
		size = ''+width+'x'+height;
	} else {
		size = width;
	}

	var target_path = base_path+"/files/thumb";
	var org_path = target_path+"/temp";
	var thumb_path = target_path+'/'+size+'/'+opt;

	var org_file = org_path+'/'+alias;
	var thumb_file = thumb_path+'/'+alias;

	if (!fs.existsSync(org_path)) fs.mkdirSync(org_path);
	if (!fs.existsSync(thumb_path)) fs.mkdirSync(thumb_path);

	var blank = new Buffer('47494638396101000100910000000000ffffffffffff00000021f90405140002002c00000000010001000002025401003b', 'hex');

	var render = function() {
		console.log(org_file);

		if (!fs.existsSync(thumb_file)) {
			return res.send(blank);
		}
		var stats = fs.statSync(thumb_file);
		if (!stats['size']) {
			console.log('no-size');
			return res.send(blank);
		}
		var file = fs.createReadStream(thumb_file);
		file.pipe(res);
		file.on('error', function(err) {
			console.log('error');
			res.send(blank);
		});
		file.on('end', function() {
			console.log('end');
			res.end();
		});
	}
	if (fs.existsSync(thumb_file)) {
		console.log('###1');
		render();
	} else {
		console.log('###2');
		scraper.download(url, org_file, function(err, result) {
			if (err) {
				console.log('error');
				res.send(blank);
			} else {
				im.resize({
					srcPath: org_file,
					dstPath: thumb_file,
					width: width,
					height: height,
					quality: 0.8,
					format: 'jpg',
				}, function(err) {
					if (err) {
						console.log(err);
						return res.send(blank);
					}
					render();
				});
			}
		});
	}
});

router.get('/userpic/:id?', function(req, res) {
	res.end();
});

*/

router.get('/userpic/:id?', function(req, res) {
	var baseimg = 'http://img.gom.heyo.me/img/user.jpg';
	var userid = req.params.id;
	var userimg = '/home/gom/www/img/user.jpg';
	var picfile = '/home/gom/www/files/user/'+userid+'.jpg';
	var picfile50 = '/home/gom/www/files/user/'+userid+'_50.jpg';
	var tmpfile = __dirname+'/../tmp/user_'+userid+'.jpg';

	var render = function() {
		var file = fs.createReadStream(picfile50);
		file.on('end', function() {
			console.log('end');
			res.end();
		});
		file.on('error', function(err) {
			console.log('error');
			res.redirect(baseimg);
		});
		file.pipe(res);
	};

	var ctime = 0;
	try {
		ctime = fs.statSync(picfile)['ctime'];
	} catch (e) {}
	var timediff = moment().diff(moment(ctime), 'hours');
	if (timediff >= 6) {
		scraper.userpic(userid, tmpfile, function(result) {
			if (!result) {
				res.redirect(baseimg);
			} else {
				if (result=="b_img.gif") {
					fs.writeFileSync(picfile, fs.readFileSync(userimg));
					fs.writeFileSync(picfile50, fs.readFileSync(userimg));
					res.redirect(baseimg);
				} else {
					fs.writeFileSync(picfile, fs.readFileSync(tmpfile));
					im.resize({
						srcPath: tmpfile,
						dstPath: picfile50,
						format: 'jpg',
						strip: false,
						width: 120,
						height: 120,
						quality: 0.8,
						sharpening: 0.2,
					}, function(error, stdout, stderror) {
						if (error) {
							console.error(error);
						}
						if (fs.existsSync(tmpfile))
							fs.unlinkSync(tmpfile);
						console.log(result);
						render();
					});
				}
			}
		});
	} else {
		render();
	}
});

module.exports = router;
