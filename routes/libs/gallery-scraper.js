var _url = require('url');
var querystring = require('querystring');
var cheerio = require('cheerio');
var async = require('async');

var HttpClient = require('./http-client');

function strip_tags(input, allowed) {
  //  discuss at: http://phpjs.org/functions/strip_tags/
  // original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // improved by: Luke Godfrey
  // improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  //    input by: Pul
  //    input by: Alex
  //    input by: Marc Palau
  //    input by: Brett Zamir (http://brett-zamir.me)
  //    input by: Bobby Drake
  //    input by: Evertjan Garretsen
  // bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // bugfixed by: Onno Marsman
  // bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // bugfixed by: Eric Nagel
  // bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // bugfixed by: Tomasz Wesolowski
  //  revised by: Rafał Kukawski (http://blog.kukawski.pl/)
  //   example 1: strip_tags('<p>Kevin</p> <br /><b>van</b> <i>Zonneveld</i>', '<i><b>');
  //   returns 1: 'Kevin <b>van</b> <i>Zonneveld</i>'
  //   example 2: strip_tags('<p>Kevin <img src="someimage.png" onmouseover="someFunction()">van <i>Zonneveld</i></p>', '<p>');
  //   returns 2: '<p>Kevin van Zonneveld</p>'
  //   example 3: strip_tags("<a href='http://kevin.vanzonneveld.net'>Kevin van Zonneveld</a>", "<a>");
  //   returns 3: "<a href='http://kevin.vanzonneveld.net'>Kevin van Zonneveld</a>"
  //   example 4: strip_tags('1 < 5 5 > 1');
  //   returns 4: '1 < 5 5 > 1'
  //   example 5: strip_tags('1 <br/> 1');
  //   returns 5: '1  1'
  //   example 6: strip_tags('1 <br/> 1', '<br>');
  //   returns 6: '1 <br/> 1'
  //   example 7: strip_tags('1 <br/> 1', '<br><br/>');
  //   returns 7: '1 <br/> 1'

  allowed = (((allowed || '') + '')
    .toLowerCase()
    .match(/<[a-z][a-z0-9]*>/g) || [])
    .join(''); // making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
  var tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
    commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;
  return input.replace(commentsAndPhpTags, '')
    .replace(tags, function ($0, $1) {
      return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : '';
    });
}

var engine = new HttpClient;
var gallid = 'hwawon';

module.exports = {
	list: function(page, callback) {
		if (!page) page = 1;
		engine.request({host:'gall.dcinside.com', path:'/board/lists/?id='+gallid+'&page='+page, encoding:'utf-8'}, function(err, body) {
			if (err) return callback(err, '가져오는데 실패하였습니다.');
			var $ = cheerio.load(body, {
				decodeEntities: false
			});
			var result = [];
			$('tr', '.gallery_list table').each(function() {
				var data = {};
				var td = $('td.t_subject', this);
				if (td.length) {
					var href = $('a', td).first().attr('href');
					if (href && href.indexOf('id='+gallid)!=-1) {
						var match = href.match(/no\=([0-9]+)/);
						if (match) data.id = match[1];
						if (data.id) {
							data.is_notice = 0;
							data.is_delete = 0;
							data.is_best = 0;
							var link = $('a', td).first();
							data.subject = link.text().trim();
							if (link.attr('class').indexOf('icon_pic_b')!=-1) data.is_best = 1;
							data.comments = $('em', td).text().replace(/[^0-9]/g, '').trim();
							if ($('td.t_notice', this).text().trim()=='공지') data.is_notice = 1;
							td = $('td.t_writer', this);
							data.userid = td.attr('user_id');
							data.name = td.text().trim();
							data.date = $('td.t_date', this).text().trim();
							data.hit_count = $('td.t_hits', this).first().text().trim();
							result.push(data);
						}
					}
				}
			});
			return callback(false, result);
		});
	}, 
	view: function(no, callback) {
		engine.request({host:'gall.dcinside.com', path:'/board/view/?id='+gallid+'&no='+no, encoding:'utf-8'}, function(err, body) {
			if (err) return callback(err, '가져오는데 실패하였습니다.');
			var $ = cheerio.load(body, {
				decodeEntities: false
			});
			var data = {};
			var container = $('#dgn_gallery_detail');
			if (!container.length) {
				if (body.indexOf("사용권한이 없습니다")!=-1) {
					return callback(1, 'AccessDeny');
				} else if (body.indexOf("/error/deleted/hwawon")!=-1) {
					return callback(false, {
						id: no,
						is_delete: 1,
					});
				} else if (body.indexOf("해당 게시물은 삭제 되었습니다")!=-1) {
					return callback(false, {
						id: no,
						is_delete: 1,
					});
				} else {
					return callback(1, null);
				}
			}
			var info1 = $('.w_top_left dd', container);
			var info2 = $('.w_top_right li', container);
			if (info1.length>=4) {
				data.subject = info1.eq(0).text().trim();
				data.name = info1.eq(1).text().trim();
				data.hit_count = info1.eq(2).text().trim();
				data.comments = info1.eq(3).text().replace(/[^0-9]/g, '').trim();
			}
			if (info2.length>=2) {
				data.detail_date = info2.eq(0).text().trim();
				data.ip = info2.eq(1).text().trim();
			}
			var content = $('.con_substance .s_write', container);
			if (content.length) {
				$('#zzbang_div', content).remove();
				data.content = content.html().trim();
				data.content_hint = strip_tags(data.content.replace(/<br[/]?>/gi, ' ').replace(/nbsp;/g, ' ')).trim();
				data.content_hint = data.content_hint.replace(/랜덤짤 출처 \(@[0-9]+[^\)]*\)/g, '');
				data.content_hint = data.content_hint.replace(/by  gom\.heyo\.me/g, '');
				data.content_hint = data.content_hint.replace(/IP : [0-9]+\.[0-9]+\.\*\*\*\.\*\*\*/g, '');
				data.content_hint = data.content_hint.replace(/[^0-9a-zA-Z가-힣\?\- \.]/g, '').replace(/[ ]+/g, ' ').substring(0, 200);
				data.is_delete = 0;
				data.id = no;
			}

			return callback(false, data);
		});
	},

	comments: function(no, page, callback) {
		var ci_c = engine.cookie('ci_c');
		if (!ci_c) {
			console.log('ci_c empty.');
			var self = this;
			engine.request({host:'gall.dcinside.com', path:'/board/view/?id='+gallid+'&no='+no}, function(err, body, headers) {
				if (err) return callback(err, '연결에 문제가 있습니다.');
				if (!engine.cookie('ci_c')) return callback(1, '연결에 문제가 있습니다.');
				return self.comments(no, page, callback);
			});
			return;
		}

		console.log('ci_t='+ci_c+'&id=hwawon&no='+no+'&comment_page='+page);

		var total_comment_count = 0;
		var list = [];

		var referer = 'http://gall.dcinside.com/board/view/?id='+gallid+'&no='+no;
		async.series([
			function(next) {
				engine.request({host:'gall.dcinside.com', path:'/comment/count', post:'ci_t='+ci_c+'&id='+gallid+'&no='+no+'&comment_page=1', encoding:'utf-8', referer:referer, addheaders:{'X-Requested-With':'XMLHttpRequest'}}, function(err, body) {
					console.log(body);
					total_comment_count = body;
					next();
				});
			},
			function(next) {
				engine.request({host:'gall.dcinside.com', path:'/comment/view', post:'ci_t='+ci_c+'&id='+gallid+'&no='+no+'&comment_page=1', encoding:'utf-8', referer:referer, addheaders:{'X-Requested-With':'XMLHttpRequest'}}, function(err, body) {
					if (err) return callback(err, '가져오는데 실패하였습니다.');
					var $ = cheerio.load(body, {
						decodeEntities: false
					});

					var container = $('#comment_list');
					if (!container.length) {
						return callback(1, null);
					}

					$('tr.reply_line', container).each(function() {
						var data = {};
						data.userid = $('td.user', this).attr('user_id').trim();
						data.name = $('td.user', this).text().trim();
						var td = $('td.reply', this);
						data.ip = $('span.etc_ip', td).text().trim();
						$('span.etc_ip', td).remove();
						data.content = td.text().trim();
						data.date = $('td.retime', this).text().replace(/\./g, '-').trim();
						data.total_count = total_comment_count;
						data.article_id = no;
						data.page = page;
						list.push(data);
					});
					next();
				});
			},
		], function(err) {
			return callback(false, list);
		});

	}, 

	add_comment: function(no, comment, loginCookies, callback) {
		var ci_c = engine.cookie('ci_c');
		if (!ci_c) {
			console.log('ci_c empty.');
			var self = this;
			engine.request({host:'gall.dcinside.com', path:'/board/view/?id='+gallid+'&no='+no}, function(err, headers) {
				if (err) return callback(err, '연결에 문제가 있습니다.');
				if (!engine.cookie('ci_c')) return callback(1, '연결에 문제가 있습니다.');
				return self.add_comment(no, comment, loginCookies, callback);
			});
			return;
		}

		var data = {};
		data['ci_t'] = ci_c;
		data['name'] = comment.name;
		data['password'] = comment.password;
		data['memo'] = comment.memo;
		data['id'] = gallid;
		data['no'] = no;

		engine.request({host:'gall.dcinside.com', path:'/forms/comment_submit', post:querystring.stringify(data), encoding:'utf-8', addheaders:{'X-Requested-With':'XMLHttpRequest', 'Referer':'http://gall.dcinside.com/board/view/?id='+gallid+'&no='+no}}, function(err, body) {
			if (err) return callback(err, '가져오는데 실패하였습니다.');
			console.log(body);
			return callback(false, body);
		});
	}, 

	login: function(userid, password, callback) {
		var cookies = {};
		var tasks = [];

		tasks.push(function(next) {
			engine.request({host:'dcid.dcinside.com', path:'/join/login.php?s_url=http%3A%2F%2Fgall.dcinside.com'}, function(err, body, header) {
				if (err) return callback(err, '연결오류가 발생하였습니다.');
				//console.log(header);
				if (header['set-cookie']) {
					header['set-cookie'].forEach(function(cookie) {
						var item = cookie.split(';')[0];
						if (item) {
							var c = item.split('=');
							cookies[c[0]] = c[1];
						}
					});
					console.log('cookies');
					console.log(cookies);
				}
				next();
			});
		});

		tasks.push(function(next) {
			var data = {
				's_url':'http%253A%252F%252Fgall.dcinside.com%252Flist.php%253Fid%253Dhwawon',
				'user_id':userid,
				'password':password,
				'ssl_chk':'on',
			};
			var referer = 'http://dcid.dcinside.com/join/login.php?s_url=http%3A%2F%2Fgall.dcinside.com';
			engine.request({host:'dcid.dcinside.com', path:'/join/member_check.php', post:querystring.stringify(data), encoding:'utf-8', referer:referer, cookies:cookies}, function(err, body, header) {
				//console.log(body);
				console.log(header);
				if (!err && header) {
					if (header['set-cookie']) {
						header['set-cookie'].forEach(function(cookie) {
							var item = cookie.split(';')[0];
							if (item) {
								var c = item.split('=');
								cookies[c[0]] = c[1];
							}
						});
						console.log('cookies');
						console.log(cookies);
					}
				}

				if (-1!=body.indexOf('등록된 아이디가 아닙니다')) {
					return callback(true, '등록된 아이디가 아닙니다');
				}
				if (-1!=body.indexOf('비밀번호가 틀렸습니다')) {
					return callback(true, '비밀번호가 틀렸습니다');
				}
				if (-1!=body.indexOf('실패 하셨습니다')) {
					console.log(body);
					return callback(true, "로그인을 여러번 실패 하셨습니다. 내일 다시 이용해 주세요");
				}

				if (err) return callback(err, '로그인을 실패하였습니다. 잠시후 다시 시도해주세요.' + err);

				next();
			});
		});

		tasks.push(function(next) {
			var referer = 'http://dcid.dcinside.com/join/login.php?s_url=http%3A%2F%2Fgall.dcinside.com';
			engine.request({host:'www.dcinside.com', path:'/', encoding:'utf-8', referer:referer, cookies:cookies}, function(err, body, header) {
				var $ = cheerio.load(body, {
					decodeEntities: false
				});

				var container = $('#member_login');
				var nickname = $('.id', container).text().trim();

				if (!nickname) return callback(err, '로그인에 실패하였습니다.');

				return callback(false, {
					nickname: nickname,
					userid: userid,
				}, cookies);
			});

		});

		async.series(tasks);
	}, 

	add_article: function(article, loginCookies, callback) {
		//var gallid = 'gp506';

		var data = {};
		var ci_t = '';
		var c_key = '';
		var r_key = '';
		var block_key = '';

		var tasks = [];

		var loginMode = false;
		if (loginCookies) loginMode = true;

		tasks.push(function(next) {
			console.log('--write'); 
			engine.request({host:'gall.dcinside.com', path:'/board/write/?id='+gallid, encoding:'utf-8', cookies:loginCookies}, function(err, body, headers, cookies) {
				if (loginCookies) loginCookies = cookies;
				if (err) return callback(err, '가져오는데 실패하였습니다.');
				var $ = cheerio.load(body, {
					decodeEntities: false
				});
				var form = $('form#write');
				ci_t = $('input[name="ci_t"]', form).val();
				c_key = $('input[name="c_key"]', form).val();
				r_key = $('input[name="r_key"]', form).val();
				block_key = $('input[name="block_key"]', form).val();
				var namecheck = $('input[name="name"]', form).val();
				if (loginMode && !namecheck) {
					return callback(-99, '로그인이 만료되었습니다. 다시 로그인해주세요.');
				}
				console.log('block_key:'+block_key);
				next();
			});
		});

		if (article.files && article.files.length) {
			tasks.push(function(next) {
				var post = 'r_key=' + r_key;
				engine.upload('upimg.dcinside.com', '/upimg_file.php?id='+gallid, post, 'utf-8', article.files, function(err, body) {
					console.log('--upimg.dcinside.com');
					var json = null;
					try {
						json = JSON.parse(body.replace('[object Object]',''));
					} catch (e) {}
					if (json && json.files && json.files.length) {
						for (var i=0; i<json.files.length; i++) {
							article.memo = '<img src="'+json.files[i].url+'"/><br/><br/>' + article.memo;
							data['file_write['+i+'][file_no]'] = json.files[i].file_temp_no;
						}
					}
					console.log(json);
					next();
				});
			});
		}

		tasks.push(function(next) {
			setTimeout(function() {
				next();
			}, 3000);
		});

		tasks.push(function(next) {
			console.log('--block-block'); 
			console.log('ci_t='+ci_t+'&id='+gallid+'&block_key='+block_key);
			engine.request({host:'gall.dcinside.com', path:'/block/block/', post:'ci_t='+ci_t+'&id='+gallid+'&block_key='+block_key, encoding:'utf-8', cookies:loginCookies, addheaders:{'X-Requested-With':'XMLHttpRequest'}}, function(err, body, headers, cookies) {
				if (loginCookies) loginCookies = cookies;
				if (err) return callback(err, '가져오는데 실패하였습니다.');
				if (body.length > 500) {
					console.log(body);
					return callback(1, '가져오는데 실패하였습니다.');
				}
				block_key = body;
				next();
			});
		});

		var success = false;
		var message = false;

		tasks.push(function(next) {
			console.log('--add-article'); 
			console.log(loginCookies);

			data['ci_t'] = ci_t;
			data['block_key'] = block_key;
			data['name'] = article.name;
			data['password'] = article.password;
			data['subject'] = article.subject;
			data['memo'] = article.memo;
			data['id'] = gallid;
			data['r_key'] = r_key;
			data['upload_status'] = 'N';
			if (article.files && article.files.length) {
				data['upload_status'] = 'Y';
			}
			console.log(data);

			var referer = 'http://gall.dcinside.com/board/write/?id='+gallid;
			engine.request({host:'gall.dcinside.com', path:'/forms/article_submit', post:querystring.stringify(data), encoding:'utf-8', cookies:loginCookies, referer:referer, addheaders:{'X-Requested-With':'XMLHttpRequest'}}, function(err, body, headers, cookies) {
				if (loginCookies) loginCookies = cookies;
				if (err) return callback(err, '가져오는데 실패하였습니다.');
				
				if (body.indexOf('true')==0) {
					success = true;
					message = body.split('||')[1];
				} else if (body.indexOf('false')==0) {
					success = false;
					message = body.split('||')[1];
				} else {
					success = false;
					message = body;
				}

				next();
			});
		});

		async.series(tasks, function(err) {
			if (err) return callback(err, '등록을 하지 못했습니다.');
			return callback(!success, message, loginCookies);
		});
	},

	userpic: function(userid, destfile, callback) {
		engine.request({host:'gallog.dcinside.com', path:'/'+userid, encoding:'utf-8'}, function(err, body) {
			if (err) return callback(null);
			var $ = cheerio.load(body, {
				decodeEntities: false
			});
			if (!$('#ProfileImg').length) {
				return callback(null);
			}
			var src = $('#ProfileImg').attr('src');
			console.log(src);
			var uri = _url.parse(src);
			engine.download(uri.host, uri.path, destfile, 'utf-8', function(err, result) {
				if (err) return callback(null);
				callback(result);
			});
		});
	}, 

	download: function(url, destfile, callback) {
		var uri = _url.parse(url);
		engine.download(uri.host, uri.path, destfile, 'utf-8', callback);
	}, 

	// util
	urlcheck: function(url, callback) {
        var uri = _url.parse(url);
        var request = http.request({
			'method': 'HEAD', 
			'path': uri.path, 
			'host' : uri.host, 
			'headers': {
				'Referer': 'http://gall.dcinside.com',
				'User-Agent': 'Mozilla/5.0 (Windows; U; Windows NT 5.1; ko; rv:1.8.1.11) Gecko/".date("Ymd")." Firefox/2.0.0.11',
			},
			agent: false
		});
        request.end();
        request.on('response', function(res) {
			res.resume();
			res.on('end', function() {
				callback(0, res.headers['content-length']);
			});
        });
		request.on('error',function(e){
			console.log("Error: " + uri.host + "\n" + e.message); 
			console.log( e.stack );
			callback(-1, e.message);
		});
	},
};