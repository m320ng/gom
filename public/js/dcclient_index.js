// jquery
jQuery.extend({
	create : function() {
		return function() {
			return this.initialize.apply(this, arguments);
		}
	}
});

jQuery.extend(Array.prototype, {
	first : function() {
		return this[0];
	},
	last : function() {
		return this[this.length-1];
	}
});

// client
var ArticleVO = {
	id : 0,
	subject : '',
	content : '',
	name : '',
	userid : '',
	userpic : '',
	ip : '',
	date : '',
	detail_date : ''
}
var CommentVO = {
	content : '',
	name : '',
	ip : '',
	userid : '',
	userpic : '',
	article_id : '',
	date : ''
}
var BaseArticle = $.create();
BaseArticle.prototype = {
	/* data */
	articles : null,
	articleFirst : 0,
	articleCount : 0,

	/* que */
	allQue : null,
	updateQue : null,
	insertQue : null,
	
	previewQue : null,
	previewTimer : null,

	/* predict helper */
	helperPage : 0,
	helperFirst : 0,
	helperLast : 0,

	insertFirst : 0,
	insertLast : 0,

	eventButton : null,

	/* field */
	requesting : false,
	container : null,

	initialize : function(id) {
		if (!id) id = 'article';
		this.articles = [];
		this.previewQue = [];
		this.container = $('#'+id);
		this.container.append($('<div class="article-dock"></div>'));
	},

	decoDate : function(date) {
		var ago = strtotime('now') - strtotime(date);
		if (ago > 365 * 24 * 60 * 60) {
			date = date.split(' ')[0] + ' (' + Math.round(ago / (365 * 24 * 60 * 60)) + '년전)';
		} else if (ago > 24 * 60 * 60) {
			date = date.split(' ')[0] + ' (' + Math.round(ago / (24 * 60 * 60)) + '일전)';
		} else if (ago > 60 * 60) {
			date = date.split(' ')[1] + ' (' + Math.round(ago / (60 * 60)) + '시간전)';
		} else if (ago > 60) {
			date = date.split(' ')[1] + ' (' + Math.round(ago / 60) + '분전)';
		} else {
			date = date.split(' ')[1] + ' (' + ago + '초전)';
		}
		return date;
	},
	decoArticle : function(pure) {
		var article = $.extend({}, pure);

		if (article.userid) {
			article.userpic = '<span class="pic"><a class="userpic" href="http://gallog.dcinside.com/'+article.userid+'" target="_blank"><img src="http://gom.heyo.me/articles/userpic/'+article.userid+'" width="50" height="50" style="width:50px; height:50px;"/></a></span>'
			article.name = '<span class="nic">'+article.name+'</span>';
		} else if (article.is_notice==1) {
			article.userpic = '<span class="pic"><a class="nouser">Notice</a></span>'
			article.name = '<span class="nic">'+article.name+'</span>';
			article.name = '';
		} else {
			article.userpic = '<span class="pic"><a class="nouser">'+(article.ip?article.ip:'')+'&nbsp;</a></span>'
			article.name = '<span class="nic">'+article.name+'</span>';
		}

		article.datestr = article.date;
		if (article.detail_date) {
			article.datestr = this.decoDate(article.detail_date);
		}
		////////////////////
		article.subject = '<a href="javascript:Client.view('+article.id+');">'+article.subject+'</a>';

		var content = strip_tags(article.content);
		if (article.content) {
			if (this.articles[article.id] && !this.articles[article.id].content) {
				this.articles[article.id].content = article.content;
			}
			content = content.replace(/&nbsp;/g,' ').trim();
			content = content.replace(/^(램|랜)덤짤 출처 \(@.+\)/g, '');
			content = content.replace(/by[ ]+heyo\.meIP : [0-9]+\.[0-9]+\.\*\*\*\.\*\*\*$/g, '');
			if (content.length > 100) content = content.substring(0, 97) + '...<span style="font:8pt 돋움; color:#bbb;">생략</span>';
			article.content = '<a href="javascript:Client.view('+article.id+');">'+content+'</a>';
		} else {
			article.content = '<a href="javascript:Client.preview('+article.id+');" style="font:bold 12pt 굴림; color:#c8c8c8;">.................................</a>';
		}
		return article;
	},

	layerCrack : function(first, last) {
		first--;
		last++;
		if (first==last) return;
		var label = '<a href="#'+first+'"><b>Crack Page '+first+' ~ '+last+'</b></a>';
		var self = this;
		return $('<div class="crack"></div>').attr({
			'first' : first,
			'last' : last
		}).css('cursor', 'pointer').html(label).click(function(event) {
			$(this).hide();
			self.select(first);
		});
	},
	layerCut : function(id) {
		return $('<div class="cut"><hr/></div>');
	},
	layerNext : function(id) {
		id--;
		var label = '<b>다음페이지</b>';

		var self = this;
		return $('<div class="next"></div>').css('cursor', 'pointer').html(label).click(function(event) {
			$(this).hide();
			self.select(id);
		});
	},
	layerImageList : function(list, opt) {
		var image_list = $('<p class="image-list" style="position:relative; display:inline-block;"></p>');
		image_list.mouseenter(function(e) {
			$('img', this).each(function(index) {
				if (index>0) {
					var col = (index-1) % 5;
					var row = Math.floor((index-1) / 5);
					$(this).animate({
						left:5+80+col*80,
						top:2+row*80
					});
				}
			});
		});
		image_list.mouseleave(function(e) {
			$('img', this).each(function(index) {
				if (index>0) {
					$(this).animate({
						left:2,
						top:2
					});
				}
			});
		});

		if (list.length > 1) {
			image_list.append($('<div></div>').css({
				position:'absolute',
				font:'8pt tahoma',
				width:'15px',
				height:'15px',
				background:'#369',
				color:'#fff',
				textAlign:'center',
				zIndex:list.length+1
			}).html(list.length));
		}

		var loop = list.length;
		if (loop > 3) loop = 3;
		var url = [];
		for (var i=0; i<loop; i++) {
			url.push(encodeURIComponent(list[i].replace(/&amp;/g, '&')));
		}
		image_list.append($('<img width="80" height="80"/>').css({
		}).attr('src', 'http://img.gom.heyo.me/thumb.php?id='+opt+'&url='+url.join('::')));

		/*
		for (var i=0; i<list.length; i++) {
			var src = list[i].replace(/&amp;/g, '&');
			var img = $('<img width="80" height="80"/>').css({
				position:'absolute',
				zIndex:list.length-i,
				top:'2px',
				left:'2px'
			}).attr('src', '/thumb.php?width=80&height=80&opt='+opt+'&url='+encodeURIComponent(src));
			var popup = '/home/image?link='+encodeURIComponent(src);
			image_list.append($('<a></a>').css('float', 'left').attr('href', popup).attr('target', '_blank').append(img));
		}
		*/
		return image_list;
	},
	layerArticle : function(article, force) {
		var row = $('<li></li>').attr({
			'id' : this.container.attr('id')+'-'+article.id,
			'class' : 'article',
			'article' : article.id
		});
		var self = this;
		if (!article.subject) article.subject = '';

		if (article.is_delete==1 && article.is_notice!=1 && !force) {
			return row.addClass('delete').html(article.id+' '+article.subject.substring(0, 20));
		}
		article = this.decoArticle(article);

		var plus_hit = '';
		if (0) {
		} else if (article.hit_count >= 1000) {
			plus_hit = ' hit1000';
		} else if (article.hit_count >= 500) {
			plus_hit = ' hit500';
		} else if (article.hit_count >= 200) {
			plus_hit = ' hit200';
		} else if (article.hit_count >= 100) {
			plus_hit = ' hit100';
		}

		if (article.is_best==1) {
			plus_hit = plus_hit + ' best';
		}

		var temp_name = '';
		if (article.name) temp_name = article.name.replace(/[^가-하]/g, '');
		var temp_content = '';
		if (article.content) temp_content = article.content.substring(0, 50).replace(/[^가-하]/g, '');
		var temp_subject = '';
		if (article.subject) temp_subject = article.subject.replace(/[^가-하]/g, '');
		var banner_singo = '';
		var banner = false;
		if (temp_name.indexOf('인터넷배팅')!=-1) {
			banner = true;
		}
		if (temp_subject.indexOf('스포츠토토')!=-1||temp_subject.indexOf('카지노')!=-1||temp_subject.indexOf('웹하드')!=-1) {
			banner = true;
		}
		if (temp_content.indexOf('스포츠토토')!=-1||temp_content.indexOf('카지노')!=-1||temp_content.indexOf('웹하드')!=-1) {
			banner = true;
		}
		if (banner) {
			banner_singo = '<br/><a href="http://gall.dcinside.com/article_write.php?id=singo&sin_cno=0&sin_id=hwawon&sin_name='+encodeURIComponent('바람의화원')+'&sin_no='+article.id+'&subject='+encodeURIComponent('광고')+'" target="_blank">[신고]</a>'
		}

		var html = [
		  '<div class="',plus_hit,'">'
			,'<p class="name">'
			,article.userpic,article.name,banner_singo
			,'</p>'
			,'<p class="message">'
			  ,'<span class="msg-subject">',article.subject,'</span>'
			  ,'<span class="msg-content">',article.content,'</span>'
			,'</p>'
			,'<p class="state">'
			  ,'<span class="hit">',article.hit_count,' Hit</span>'
			  ,'<span class="rep">',article.comments,' 덧글</span>'
			  ,'<span class="date">',article.datestr,'</span>'
			,'</p>'
		  ,'</div>'
		];

		var container = $(html.join(''));
		if (article.image_list && article.image_list.length && Client.previewImageList) {
			$('.image-list', container).remove();
			$(container).prepend(
				this.layerImageList(article.image_list, article.id)
			);
		}

		return row.html(container);
	},

	render : function(one) {
		var button;
		var dock = null;
		var init = this.articleFirst?true:false;
		var self = this;

		button = this.container.find('.article-dock').next();
		if (button.attr('class')=='recent') button.remove();
		button = this.container.find('.article:last').next();
		if (button.attr('class')=='next') button.remove();

		//dock position
		//crack
		$('.crack', this.container).each(function() {
			var first = $(this).attr('first');
			var last = $(this).attr('last');
			if (self.insertFirst <= first && self.insertLast >= last) {
				dock = $(this);
			}
		});
		//last
		if (this.articleFirst) {
			if (dock==null && this.container.find('.article:last').attr('article') >= this.insertLast) {
				dock = this.container.find('.article:last');
			}
		}
		//first
		if (dock==null) dock = this.container.find('.article-dock');

		//insert
		if (this.insertQue.length) {
			for (var i=0; i<this.insertQue.length; i++) {
				//render
				dock = dock.after(this.layerArticle(this.articles[this.insertQue[i]])).next();
				this.articleCount++;
			}

			// first
			if (this.articleFirst < this.insertQue[0]) this.articleFirst = this.insertQue[0];
			this.insertQue = [];
		}

		//추가하고이제 크랙삭제
		if (dock.attr('class')=='crack') dock.remove();

		//update
		if (this.updateQue.length) {
			for (var i=0; i<this.updateQue.length; i++) {
				//render
				dock = $('#'+this.container.attr('id')+'-'+this.updateQue[i]);
				dock.after(this.layerArticle(this.articles[this.updateQue[i]])).remove();
			}
			this.updateQue = [];
		}

		//crack
		if (this.insertQue.length) {
			if (!this.articles[this.insertFirst+1] && this.articleFirst && this.insertFirst!=this.articleFirst) {
				//top crack
				var prev = $('#'+this.container.attr('id')+'-'+this.insertFirst).prev();
				if (prev.attr('class')!='article-dock') {
					$('#'+this.container.attr('id')+'-'+this.helperFirst).before(this.layerCrack(prev.attr('article'), this.insertFirst));
				}
			}
			if (!this.articles[this.insertLast-1]) {
				var next = $('#'+this.container.attr('id')+'-'+this.insertLast).next();
				//bottom crack
				if (next.attr('class')=='article') {
					dock.after(this.layerCrack(this.insertLast, next.attr('article')));
				}
			}
		}

		//resent
		//dock = this.container.find('.article:first');
		//dock.before(this.layerResent());

		//next
		dock = this.container.find('.article:last');
		dock.after(this.layerNext(dock.attr('article')));

	},

	update : function(url, callback) {
		if (this.requesting) return;
		this.requesting = true;
		this.container.append($('<li id="'+this.container.attr('id')+'-loading" class="loading"><span class="spin"></span> Loading...</li>'));
		var self = this;
		$.getJSON(url+'?'+Math.random(), function(data) {
			self.requesting = false;
			$('#'+self.container.attr('id')+'-loading').remove();

			if (!data) return;

			self.optional = data.optional;
			self.list = data.list;

			if (self.optional) {
				self.helperPage = self.optional.page;
				self.helperFirst = self.optional.first_article_id;
				self.helperLast = self.optional.last_article_id;
			}
			self.insertFirst = 0;
			self.insertLast = 0;

			var update = [];
			var insert = [];
			var all = [];
			if (self.list) {
				for (var i=0; i<self.list.length; i++) {
					if (!self.list[i]) continue;
					var vo = $.extend({}, ArticleVO, self.list[i]);
					vo.id = parseInt(vo.id);
					if (vo && vo.id) {
						if (self.articles[vo.id]) {
							//update
							update.push(vo.id);
							for (var key in vo) {
								if (vo[key]) self.articles[vo.id][key] = vo[key];
							}
						} else {
							//insert
							insert.push(vo.id);
							self.articles[vo.id] = vo;
							if (self.helperFirst >= vo.id && vo.id >= self.helperLast) {
								if (!self.insertFirst) self.insertFirst = vo.id;
								self.insertLast = vo.id;
							}

							if (!vo.content) self.previewQue.push(vo.id);
						}
						all.push(vo.id);
					}
				}
			}

			if (callback) callback(insert, update, all);
		});
	},

	recent : function(force, callback) {
		var self = this;
		this.update('/articles/recent/'+force+'?'+Math.random(), function(insert, update, all) {
			self.insertQue = insert;
			self.updateQue = update;
			self.allQue = all;
			if (!self.articleFirst) {
				self.render();
			} else {
				self.render(true);
			}
			if (callback) callback();

			self.readyPreview();
		});
	},
	list : function(action, callback) {
		var self = this;
		this.update('/articles/'+action+'?'+Math.random(), function(insert, update, all) {
			self.insertQue = insert;
			self.updateQue = update;
			self.allQue = all;
			self.render(true);
			if (callback) callback();
		});
	},
	select : function(id, callback) {
		var self = this;
		this.update('/articles/select/'+id+'?'+Math.random(), function(insert, update, all) {
			/*
			if (this.articleCount > 100) {
				var layer = Client.layerArticle(this.insertLast + 50);
				for (var i=0; i<25; i++) {
					layer.next().hide();
					layer = layer.next();
				}
			}
			*/

			self.insertQue = insert;
			self.updateQue = update;
			self.allQue = all;
			self.render();
			if (callback) callback();

			self.readyPreview();
		});
	},
	next : function(callback) {
		this.select(this.insertLast, callback);
	}, 
	page : function(page, callback) {
		var self = this;
		this.update('/articles/select_page/'+page+'?'+Math.random(), function(insert, update, all) {
			self.insertQue = insert;
			self.updateQue = update;
			self.allQue = all;
			self.render();
			if (callback) callback();

			self.readyPreview();
		});
	},
	select_date : function(date, callback) {
		var self = this;
		this.update('/articles/select_date/'+date+'?'+Math.random(), function(insert, update, all) {
			self.insertQue = insert;
			self.updateQue = update;
			self.allQue = all;
			self.render();
			if (callback) callback();

			self.readyPreview();
		});
	},

	readyPreview : function() {
		if (this.previewTimer) clearTimeout(this.previewTimer);
		var self = this;
		this.previewTimer = setTimeout(function() {
			self.preview();
		}, 5000);
	},

	preview : function() {
		if (this.previewQue.length) {
			var id = this.previewQue[0];
			this.previewQue = this.previewQue.slice(1, this.previewQue.length);
			if (this.articles[id] && !this.articles[id].content) {
				Client.preview(id);
			}
		}

		var self = this;
		this.previewTimer = setTimeout(function() {
			self.preview();
		}, 5000);
	}
}

var ArticleList = $.create();
var ArticleNotice = $.create();
var ArticleIssue = $.create();
var ArticleRecover = $.create();
$.extend(ArticleList.prototype, BaseArticle.prototype, {
});
$.extend(ArticleNotice.prototype, BaseArticle.prototype, {
});
$.extend(ArticleIssue.prototype, BaseArticle.prototype, {
	layerArticle : function(article) {
		var row = $('<div></div>').attr({
			'id' : this.container.attr('id')+'-'+article.id,
			'class' : 'issue',
			'article' : article.id
		});
		var self = this;
		if (article.is_delete==1 && article.is_notice!=1) {
			return row.addClass('delete').html(article.id);
		}

		article = this.decoArticle(article);

		var html = [
			'<table class="item">',
				'<tr>',
					'<td class="left">',article.hit_count,'</td>',
					'<td class="message">',
						'<div class="subject">',article.subject,'</div>',
						'<table class="addtional">',
							'<tr>',
								'<td class="name">',article.name,'</td>',
								'<td class="comments">',article.comments,' 댓글</td>',
								'<td class="date">',article.datestr.split(' ').pop().replace('(','').replace(')',''),'</td>',
							'</tr>',
						'</table>',
					'</td>',
				'</tr>',
			'</table>'
		];

		return row.html(html.join(''));
	}
});
$.extend(ArticleRecover.prototype, BaseArticle.prototype, {
	layerArticle : function(article) {
		var row = $('<div></div>').attr({
			'id' : this.container.attr('id')+'-'+article.id,
			'class' : 'check-delete',
			'article' : article.id
		});
		var self = this;
		if (article.is_delete==1 && article.is_notice!=1) {
			//return row.addClass('delete').html(article.id+' '+article.subject.substring(0, 20));
		}

		deco = this.decoArticle(article);

		var html = [
			'<table>',
				'<tr>',
					'<td class="left">',deco.id,'</td>',
					'<td class="message">',
						'<div class="subject"><a href="javascript:Client.view(',article.id,', true);">',article.subject,'</a> (',deco.comments,') ',(deco.detail_date?deco.detail_date:deco.date),'</div>',
					'</td>',
				'</tr>',
			'</table>'
		];

		return row.html(html.join(''));
	}
});

var Comment = $.create();
Comment.prototype = {
	id : null,
	count : 0,
	total : 0,
	comments : null,
	adding : false,
	ajax : null,

	container : null,

	initialize : function(id) {
		if (!id) id = 'comment-list';
		this.container = $('#'+id);
		this.comments = [];
	},

	layerComment : function(pure) {
		var comment = pure;
		var row = $('<li></li>');
		var self = this;

		comment.userpic = '';
		if (comment.userid) {
			comment.userpic = '<span class="pic"><a class="userpic" href="http://gallog.dcinside.com/'+comment.userid+'" target="_blank"><img width="50" height="50" src="http://gom.heyo.me/articles/userpic/'+comment.userid+'"/></a></span>'
			comment.name = '<span class="nic">'+comment.name+'</span>';
		} else {
			comment.userpic = '<span class="pic"><a class="nouser">'+(comment.ip?comment.ip:'')+'&nbsp;</a></span>'
			comment.name = '<span class="nic">'+comment.name+'</span>';
		}


		if (comment.content) {
			comment.content = comment.content.replace(/(㉳[ ]?[0-9]+\.[0-9]+)/g, '<span style="color:#dedede;">$1</span>');
			comment.content = comment.content.replace(/(http:\/\/[a-zA-Z0-9&%;.?/=]+)/g, '<a href="$1" style="text-decoration:underline;" target="_blank">$1</a>');
		}

		var html = [
		  '<div id="comment',comment.id,'">'
			,'<p class="name">'
			,comment.userpic
			,'</p>'
			,'<p class="message">'
			  ,'',comment.content,''
			,'</p>'
			,'<p class="state">'
			  ,comment.name
			  ,'<span class="date">',comment.date.substring(0, 16),'</span>'
			,'</p>'
		  ,'</div>'
		];

		return row.html(html.join(''));
	},

	layerAddComment : function(id) {
		var html = [
			'<table>',
				'<tr>',
					'<th align="center">이름</th>',
					'<th align="center">댓글</th>',
					'<th align="center">비번</th>',
					'<th align="center"><a href="javascript:Client.article_view.comment_list.refresh();">새로고침</a></th>',
				'</tr>',
				'<tr>',
					'<td align="center"><input type="text" id="comment-name" class="text" value="',Client.udong_name,'" size="8"/></td>',
					'<td align="center"><input type="text" id="comment-memo" class="text" value="',Client.backup_memo,'" onkeydown="Client.article_view.comment_list.keydownComment(event, this);" size="40" maxlength="200"/></td>',
					'<td align="center"><input type="password" id="comment-password" class="text" onkeydown="Client.article_view.comment_list.keydownComment(event, this);" value="',Client.udong_password,'" size="8"/></td>',
					'<td align="center"><input type="button" value="등록" id="comment-button" onclick="Client.article_view.comment_list.addCommentInput();"/></td>',
				'</tr>',
			'</table>'
		];


		return $('<div class="comment-add"></div>').html(html.join(''))
	},

	layerNext : function (id, page, remain, fail) {
		var self = this;
		var label = '이전 댓글';
		if (fail) {
			label += ' (Failed)';
		} else {
			label += ' ('+remain+'개 남음)';
		}
		return $('<div class="next"></div>').css('cursor', 'pointer').html(label).click(function(event) {
			$(this).remove();
			self.select(id, page);
		});
	},

	render : function(id, page) {
		var wrap = $('<div></div>');
		var comment;
		for (var i=0; i<this.comments.length; i++) {
			comment = this.comments[i];
			wrap.prepend(this.layerComment(comment));
		}

		if (page==1) {
			this.container.html(wrap.html());
		} else {
			this.container.prepend(wrap.html());
		}

		var layer = Client.layerArticle(this.id);
		var comments;
		if (layer.get().length && $('.comments', layer).get().length) {
			comments = $('.comments', layer).html().replace(' 댓글', '');
			if (comments < this.comments.length) {
				$('.comments', layer).html(this.comments.length + ' 댓글');
			}
		}

		if (this.total > this.count) {
			this.container.prepend(this.layerNext(id, page+1, this.total - this.count));
		}
		
		if (page==1) {
			if (this.comments.length && this.comments[0].content) {
				this.comments[0].content = this.comments[0].content.replace('<span style="color:#dedede;">㉳', '㉳');
				var temp = this.comments[0].content.split('㉳');
				if (temp[0].trim()==Client.backup_memo.trim()) {
					Client.backup_memo = '';
				}
			}
			//this.container.append(this.layerAddComment(id));
		}
	},

	update : function(id, page, callback) {
		if (this.requesting) return;
		this.requesting = true;

		this.container.prepend($('<div class="loading"><img src="/img/loading.gif"/> Loading...</div>'));

		var self = this;
		if (this.ajax) {
			this.ajax.abort();
			this.ajax = null;
		}
		this.ajax = $.getJSON('/articles/comments/'+id+'/'+page+'?'+Math.random(), function(data) {
			self.requesting = false;
			self.container.find('.loading').remove();

			if (!data) return;

			if (page==1) self.count = 0;
			self.comments = [];
			for (var i=0; i<data.length; i++) {
				if (!data[i]) continue;
				if (!data[i]) continue;

				self.total = data[i]['total_count'];

				var vo = $.extend({}, CommentVO, data[i]);
				vo.id = parseInt(vo.id);

				self.comments.push(vo); self.count++;
			}

			if (callback) callback();
		});
	},

	refresh : function() {
		this.select(this.id, 1);
	},

	select : function(id, page) {
		this.id = id;

		if (page==1) this.total = 0;

		var self = this;
		this.update(id, page, function() {
			self.render(id, page);
		});
	}, 

	keydownComment : function(event, input) {
		if (event.keyCode==13) {
			this.addCommentInput();
		}
	},

	addCommentInput : function() {
		var name = $('#comment-name').val();
		var memo = $('#comment-memo').val();
		var password = $('#comment-password').val();

		this.addComment(this.id, name, memo, password);
	},

	addComment : function(id, name, memo, password) {
		if (this.adding) {
			alert('댓글이 등록중입니다.');
			return;
		}
		if (!id) {
			alert('게시글번호가 누락되었습니다.');
			return;
		}
		if (!name.trim()) {
			alert('이름을 입력해주세요.');
			return;
		}
		if (!memo.trim()) {
			alert('댓글을 입력해주세요.');
			return;
		}
		if (!password.trim()) {
			alert('비밀번호를 입력해주세요.');
			return;
		}
		Client.udong(name, password);
		Client.backup_memo = memo;

		if ($('.message', this.container).length) {
			var count = 0;
			$('.message', this.container).each(function() {
				if (-1!=$(this).html().indexOf(' ㉳ ')) {
					count++;
				} else {
					count = 0;
				}
			});
			if (count > 6) {
				alert('연속으로 6개 이상 작성할 수 없습니다.');
				this.select(id, 1);
				return;
			}
		}

		//$('.comment-add', this.container).remove();
		//this.container.append($('<div class="loading"><img src="/img/loading.gif"/> 등록중...</div>'));		
		$.mobile.showPageLoadingMsg();
		this.adding = true;
		var self = this;
		$.ajax({
			url:'/articles/add_comment/'+id+'?'+Math.random(),
			type:'POST',
			data:{
				id:id,
				name:name,
				memo:memo,
				password:password
			},
			success:function(html) {
				$.mobile.hidePageLoadingMsg();
				//$('.loading', self.container).remove();
				self.adding = false;
				if (html.trim()) {
					alert(html);
				} else {
					$('#comment-memo').val('');
				}
				self.select(id, 1);
			}, 
			error:function(res) {
				$.mobile.hidePageLoadingMsg();
				//$('.loading', self.container).remove();
				self.adding = false;
			}
		});
	}
}

var ArticleView = $.create();
ArticleView.prototype = {
	comment_list : null,
	article : null,

	id : null,
	recover : null,
	embed : null,

	/* event */
	afterRender : function(data){},
	beforeRender : function(data){},

	/* field */
	requesting : false,
	container : null,

	initialize : function(id) {
		if (!id) id = 'article-view';
		this.container = $('#'+id);
		this.comment_list = new Comment('comment-list');
	},

	render : function(recover) {
		var layer = Client.layerArticle(this.article.id);
		var tab = Client.article_list.layerArticle(this.article, recover);
		$('.msg-content', tab).remove();
		$('.state', tab).prepend($('.name>.nic', tab));

		this.container.html('');

		if (this.article.is_delete==1 && !recover || this.article.is_delete==1 && recover && this.article.comments < 5) {
			var html = '게시물이 삭제되었습니다.<br/><br/>';
			if (recover) {
				html += '(5개 이상의 댓글이 있을경우 임시조회가능)<br/><br/>';
			}
			this.container.append($('<div class="delete"></div>').html('삭제된 게시글입니다.'));
			this.container.append(
				$('<ul class="listing"></ul>').append(tab)
			).append(
				$('<div class="inner"></div>').html(html)
			);
			layer.after($('<div class="article"></div>').addClass('delete').html(this.article.id)).remove();

			this.comment_list.select(this.article.id, 1);
			$('.image-list', tab).remove();
			return;
		} else if (this.article.is_delete==1) {
			this.container.append($('<div class="delete"></div>').html('삭제된 게시글 임시조회입니다.'));
		}

		this.container.append(
			$('<ul class="listing"></ul>').append(tab)
		);

		if (this.embed) {
			this.container.append(
				$('<div class="inner"></div>').html(this.embed)
			);
		}

		// 필터
		this.article.content = this.article.content.replace('http://gall.dcinside.com/list.php?id=hwawon&no=', 'http://heyo.me/');
		this.article.content = this.article.content.replace(/<iframe(.+)><\/iframe>/g, '<span style="font:bold 8pt 돋움; color:#900;">악성코드제거</span>');
		this.article.content = this.article.content.replace(/<embed(.+)>/g, '<embed id="movie1" $1>');

		this.beforeRender(this.article);
		this.container.append($('<div class="inner content"></div>'));

		if (this.container[0].outerHTML) {
			$('.content', this.container).append($('<div class="outer-content"></div>'));
			$('.outer-content', this.container)[0].outerHTML = this.article.content;
		} else {
			$('.content', this.container).html(this.article.content);
		}

		$('img', this.container).click(function(e) {
			$(this)[0].removeAttribute('height');
			$(this)[0].removeAttribute('width');
		});

		this.afterRender(this.article);
		this.comment_list.select(this.article.id, 1);

		// 조회수
		//$('.inner', this.container).append(
			//$('<img src="http://gall.dcinside.com/list.php?id=hwawon&no='+this.article.id+'&rnd='+Math.random()+'" width="1" height="1"/>')
		//);

		if (layer.get().length) {
			this.article.content = this.article.content_hint;
			var article = Client.article_list.decoArticle(this.article);

//			layer.find('.pic').html(article.userpic);
//			layer.find('.nic').html(article.name);
			layer.find('.date').html(article.datestr);
			layer.find('.rep').html(article.comments+' 댓글');
			layer.find('.msg-subject').html(article.subject);
			layer.find('.msg-content').empty().append(article.content);

			if (article.image_list && article.image_list.length && Client.previewImageList) {
				$('.image-list', layer).remove();
				layer.prepend(
					Client.article_list.layerImageList(article.image_list, article.id)
				);
			}
		}
	},

	update : function(id, callback) {
		if (this.requesting) return;
		this.requesting = true;

		var self = this;
		$.getJSON('/articles/article/'+id+'?'+Math.random(), function(data) {
			self.requesting = false;

			if (!data) return;
			var article = data;

			var layer = $('#'+Client.article_list.container.attr('id')+'-'+article.id);

			if (!article.date) {
				article.date = layer.find('.date').html();
			}
			if (!article.userpic) {
				article.userpic = layer.find('.left').html();
			}
			if (!article.name) {
				article.name = layer.find('.name').html();
			}

			if (!article.content) article.content = '';
			article.content = article.content.trim();
			article.content = article.content.replace(/^<span style=line-height:160%>/g, '');
			article.content = article.content.replace(/<div id='bgRela' style='position:;width:100%;'>/g, '');

			var pos = pos2 = article.content.indexOf('insertFlash(');
			if (-1!=pos) {
				pos2 = article.content.indexOf(');', pos);
				eval('self.embed = '+article.content.substring(pos, pos2+2));
			}

			article.content = article.content.replace(/dcimg2\.dcinside\.com\/viewimage\.php/g, 'image.dcinside.com/viewimage.php');
			article.content = article.content.replace(/dcimg1\.dcinside\.com\/viewimage\.php/g, 'image.dcinside.com/viewimage.php');

			article.content = article.content.replace(/onerror/gi, '');
			article.content = article.content.replace(/onload/gi, '');
			article.content = article.content.replace(/onmouseover/gi, '');
			article.content = article.content.replace(/onmouseout/gi, '');
			article.content = article.content.replace(/onclick/gi, '');
			article.content = article.content.replace(new RegExp('<sc'+'ript[^>]*>[^~]*<\/sc'+'ript>', 'ig'), '');

			if (callback) callback(article);
		});
	},

	view : function(id, recover) {
		this.container.append($('<div id="'+this.container.attr('id')+'-loading" class="loading"><span class="spin"></span> Loading...</div>'));
		this.comment_list.container.html('');

		$('#content-container .new-link').attr('href', 'http://heyo.me/'+id);
		$('#content-container .source').attr('href', 'http://gall.dcinside.com/list.php?id=hwawon&no='+id);

		this.id = id;
		this.recover = recover;
		this.embed = '';

		var self = this;
		this.update(id, function(article) {
			$('#'+self.container.attr('id')+'-loading').remove();

			self.article = article;
			self.render(recover);
		});
	},

	refresh : function() {
		this.view(this.id, this.recover);
	},

	preview : function(id) {
		Client.layerArticle(id).find('.msg-content').html('<div class="loading"><img src="/img/loading.gif"/> Loading..</div>');

		var self = this;
		this.update(id, function(article) {
			self.article = article;

			var layer = Client.layerArticle(article.id);
			if (article.is_delete==1) {
				layer.after($('<li></li>').addClass('delete').html(id)).remove();
				return;
			}

			article = Client.article_list.decoArticle(article);

			layer.find('.date').html(article.datestr);
			layer.find('.rep').html(article.comments+' 댓글');
			layer.find('.msg-subject').html(article.subject);
			layer.find('.msg-content').empty().append(article.content);
			if (article.image_list.length && Client.previewImageList) {
				$('.image-list', layer).remove();
				layer.prepend(
					Client.article_list.layerImageList(article.image_list, article.id)
				);
			}
		});
	}
}

var Gallery = $.create();
Gallery.prototype = {
	image_list : null,
	
	page : null,

	/* field */
	requesting : false,
	container : null,

	initialize : function(id) {
		if (!id) id = 'gallery-list';
		this.container = $('#'+id);
		this.image_list = [];
	},

	layerNext : function(page) {
		var self = this;
		return $('<div class="next"></div>').html('다음페이지').click(function(e) {
			$(this).remove();
			self.select(page+1);
		});
	},

	layerPrev : function(page) {
		var self = this;
		return $('<div class="prev"></div>').html('이전페이지').click(function(e) {
			$(this).remove();
			self.select(page-1);
		});
	},

	render : function(page) {
		var wrap = $('<div class="gallery-wrap clearfix"></div>');
		for (var i=0; i<this.image_list.length; i++) {
			var id = this.image_list[i].id;
			var src = this.image_list[i].img.replace('&amp;', '&');
			img = $('<img width="80" height="80"/>').attr('src', '/thumb.php?width=80&height=80&opt='+id+'&url='+encodeURIComponent(src)).attr('org', src);
			img.one('error', function() {
				$(this).css('visibility', 'hidden');
				$(this).attr('src', $(this).attr('org')).one('error', function() {
					$(this).css('visibility', 'visible');
					$(this).attr('src', '/img/nouser.gif');
				}).one('load', function() {
					$(this).css('visibility', 'visible');
				});
			});
			wrap.append(
				$('<div class="gallery"></div>')
					.append(
						$('<a class="img" href="'+src+'"></a>').append(img))
					.append(
						$('<a class="article" href="/'+id+'" target="_blank"></a>').append(id)
					)
			);
		}
		this.container.append(wrap);

		var self = this;
		this.container.append(this.layerNext(page));
		if (page > 1) this.container.prepend(this.layerPrev(page));

		$('a.img', this.container).lightBox({
			imageLoading:			'/js/jquery/lightbox/images/lightbox-ico-loading.gif',
			imageBtnPrev:			'/js/jquery/lightbox/images/lightbox-btn-prev.gif',
			imageBtnNext:			'/js/jquery/lightbox/images/lightbox-btn-next.gif',
			imageBtnClose:			'/js/jquery/lightbox/images/lightbox-btn-close.gif',
			imageBlank:				'/js/jquery/lightbox/images/lightbox-blank.gif'
		});
	},

	update : function(page, callback) {
		if (this.requesting) return;
		this.requesting = true;

		this.image_list = [];

		var self = this;
		$.getJSON('/articles/gallery/'+page+'?'+Math.random(), function(data) {
			self.requesting = false;

			if (!data) return;

			for (var i=0; i<data.length; i++) {
				if (!data[i].img) continue;
				self.image_list.push(data[i]);
			}

			if (callback) callback();
		});
	},

	refresh : function() {
		this.select(this.page);
	},

	select : function(page) {
		this.page = page;
		this.container.append($('<div id="'+this.container.attr('id')+'-loading" class="loading"><img src="/img/loading.gif"/> Loading...</div>'));
		this.container.html('');
		var self = this;
		this.update(page, function() {
			$('#'+self.container.attr('id')+'-loading').remove();
			self.render(page);
		});
	}
}

var Client = {
	previewImageList : true,

	article_view : null,
	article_list : null,
	article_notice : null,
	article_issue : null,
	article_recover : null,
	gallery_list : null,

	scroll_top : 0,

	udong_name : '곰',
	udong_password : '1',
	backup_subject : '',
	backup_content : '',
	backup_memo : '',

	scroll : function() {
		if ($('#article-container').css('display')=='none') return;
		var point = $(window).scrollTop() + $(window).height();
		var max = $('#page-container').height();

		if ((max - point) < 10) {
			$('.next', Client.article_list.container).click();
		}
	},

	layerArticle : function(id) {
		var layer = $('#'+this.article_list.container.attr('id')+'-'+id);
		return layer;
	},

	udong : function(name, password) {
		if (name) $.cookie('udong_name', name);
		if (password) $.cookie('udong_password', password);
		if (name) this.udong_name = name;
		if (password) this.udong_password = password;
	},

	preinit : function() {
		var names = '북극곰,불곰,회색곰,검은곰,반달곰,말레이곰,팬더곰,안경곰,판다곰,푸우곰,테디베어,백곰,리락쿠마,순정곰,변태곰,미친곰,밥먹은곰,바람곰,흑곰,까만곰,거문곰,하얀곰,허연곰,빨간곰,파란곰,녹색곰,노란곰,초록곰'.split(',');
		this.udong_name = names[Math.round(Math.random()*(names.length-1))];
		if ($.cookie('udong_name')) {
			this.udong_name = $.cookie('udong_name');
		}
		if ($.cookie('udong_password')) {
			this.udong_password = $.cookie('udong_password');
		}

		if (!$('#add-name').val()) {
			$('#add-name').val(this.udong_name);
		}
		var self = this;
		var writing = false;
		$('#add-button').click(function(e) {
			if (writing) {
				alert('등록중입니다. 잠시만 기다려주세요.');
				return;
			}
			//$(this).attr('disabled', true);
			if (!$('#add-name').val()) {
				alert('이름을 입력해주세요');
				$(this).attr('disabled', false);
				return;
			}
			if (!$('#add-subject').val()) {
				alert('제목을 입력해주세요');
				$(this).attr('disabled', false);
				return;
			}
			if (!$('#add-memo').val()) {
				alert('내용을 입력해주세요');
				$(this).attr('disabled', false);
				return;
			}
			if ($('#add-memo').val().length < 10) {
				alert('내용을 10글자이상 입력해주세요');
				$(this).attr('disabled', false);
				return;
			}

			var form = document.forms['write-form'];

			self.udong($('#add-name').val());
			self.backup_subject = $('#add-subject').val();
			self.backup_content = $('#add-memo').val();

			/*
			var data = {
				name : $('#add-name').val(),
				subject : $('#add-subject').val(),
				content : $('#add-memo').val()
			};
			*/
			form.rand_mode.value = '';
			//alert($('#check-all-random')[0].checked);
			if ($('#check-all-random').length) {
				form.rand_mode.value = $('#check-all-random')[0].checked?'real':'';
			}
			if ($('#check-hint-random').length) {
				form.rand_mode.value = $('#check-hint-random')[0].checked?'hint':form.rand_mode.value;
				//data.rand_hint = $('#random-hint').val();
				if (form.rand_mode.value=='hint') {
					if (form.rand_hint.value.length > 10) {
						alert('힌트를 10글자 이내로 입력해주세요');
						//$(this).attr('disabled', false);
						return;
					}
					if (form.rand_hint.value.length < 2) {
						alert('힌트를 2글자 이상로 입력해주세요');
						//$(this).attr('disabled', false);
						return;
					}
				}
			}

			$('#add-button').css('opacity', 0.5);
			writing = true;

			//alert('랜덤모드:' + form.rand_mode.value);

			form.action = '/articles/add_article';
			$(form).ajaxSubmit(function(result) {
					$('#add-button').css('opacity', 1);
					writing = false;
					var json = result;
					if (!json.success) {
							alert(json.message||'등록에 실패하였습니다.');
							$.cookie('temp_content', form.content.value);
							$.cookie('temp_subject', form.subject.value);
							return;
					}
					alert(json.message);

					$.cookie('temp_content', '');
					$.cookie('temp_subject', '');
					form.subject.value = '';
					form.content.value = '';
					//form.userid.value = '';
					//$('#check-none-random').attr('checked',true);
					//$('#check-none-random').parent().find('label').click();
					//form.name.value = '';
					self.recent();
					//$('.article-content').hide();$('#article').show();
			}); 

			/*
			if ($('#check-capture').length && jwplayer()) {
				data.movie = $('#select-movie').val();
				data.movie_name = $('#select-movie-name').val();
				data.pos = (parseFloat(jwplayer().getPosition())-0.66);
			}

			$.mobile.showPageLoadingMsg();

			self.adding = true;
			$.ajaxFileUpload({
				url : '/articles/add_article',
				data : data,
				fileElementId : 'add-file',
				secureuri : false,
				dataType : 'text',
				success : function(data) {
					$.mobile.hidePageLoadingMsg();
					self.adding = false;
					//$('#add-button').attr('disabled', false);
					if (data) alert(data);
					else {
						$('#add-memo').val('');
						$('#check-all-random').attr('checked',true);
						$('#check-all-random').parent().find('label').click();

						self.backup_subject = '';
						self.backup_content = '';
						self.recent();
						$('.article-content').hide();$('#article').show();
					}
				},
				error : function(res) {
					$.mobile.hidePageLoadingMsg();
					self.adding = false;
				}
			});
			*/
		});

		this.article_list = new ArticleList('article-list');
		this.article_notice = new ArticleNotice('notice-list');
		this.article_issue = new ArticleIssue('issue-list');
		this.article_recover = new ArticleRecover('recover-list');
		this.gallery_list = new Gallery('gallery-list');

		this.article_view = new ArticleView('content-view');

		$('#login-userid').keydown(function(e) {
			if (e.keyCode==13) {
				$('#login-password').focus();
				e.stopPropagation();
			}
		});
		$('#login-password').keydown(function(e) {
			if (e.keyCode==13) {
				Client.loginOK();
				e.stopPropagation();
			}
		});

		$(window).bind('scroll', Client.scroll);
	},

	load : function() {
		if ($.mobile.ver!='mobile') {
			this.article_notice.list('notice');
			this.article_issue.list('list_issue');
			this.article_recover.list('list_delete');
			this.comments();
		}

		//this.baksang();
		//setInterval(function() {
		//	Client.comments();
		//}, 30000);
	},
	
	comments : function() {
		var self = this;
		$('#recent-comments').html('<div class="loading"><img src="/img/loading.gif"/> Loading...</div>');

		$.getJSON('/articles/recent_comments?'+Math.random(), function(data) {
			if (!data) return;
			$('#recent-comments').html('');
			for (var i=0; i<data.length; i++) {
				if (!data[i]) continue;
				if (!data[i]) continue;

				var total = data[i]['total_count'];

				var vo = $.extend({}, CommentVO, data[i]);
				vo.id = parseInt(vo.id);

				vo.content = vo.content.replace(/(㉳[ ]?[0-9]+\.[0-9]+)/g, '<span style="color:#dedede;">$1</span>');

				$('#recent-comments').append($('<div class="item"></div>').append(
					$('<a></a>').attr('href', 'javascript:Client.view('+vo.article_id+');').html(
						'['+vo.name+'] '+vo.content
					)
				).append(
					$('<span class="date"></span>').html('&nbsp;&nbsp;'+vo.date)
				));

			}

		});
	},

	baksang : function() {
		$('#recent-baksang .listing').html('<div class="loading"><img src="/img/loading.gif"/> Loading...</div>');
		$.get('/home/baksang?'+Math.random(), function(html) {
			$('#recent-baksang .listing').html(html);
		});
	},

	init : function() {
		this.preinit();

		var self = this;
		this.article_list.recent(false, function() {
			//setTimeout(function() {
			//	Client.article_list.next();
			//}, 500);
		});

		this.load();
	},

	page : function(page) {
		this.preinit();
		this.load();
		Client.article_list.page(page);
	},

	date : function(date) {
		this.preinit();
		this.load();
		Client.article_list.select_date(date);
	},

	gallery : function() {
		$('#content-container').hide();
		$('#banner-container').hide();
		$('#article-container').hide();
		$('#gallery-container').show();
		this.gallery_list.select(1);
	},

	back : function() {
		$('#gallery-container').hide();
		$('#content-container').hide();
		$('#banner-container').show();
		$('#article-container').show();
		$(window).scrollTop(this.scroll_top);

		this.article_view.container.html('');
	},

	recent : function() {
		if (!this.article_list.requesting) {
			$.mobile.showPageLoadingMsg();
			//this.article_list.container.before($('<div id="recent-loading" style="position:absolute; top:137px; left:1px; font:bold 8pt tahoma; color:#666;"><img src="/img/loading.gif"/> Loading...</div>'));
			this.article_list.recent(true, function() {
				$.mobile.hidePageLoadingMsg();
				//$('#recent-loading').remove();
			});
		}
	},
	view : function(id, recover) {
		this.scroll_top = $(window).scrollTop();
		$(window).scrollTop(0);
		$('#gallery-container').hide();
		$('#banner-container').hide();
		$('#article-container').hide();
		$('#content-container').show();
		this.article_view.view(id, recover);
	},

	alert : function(message) {
		alert(message);
		//$.growlUI('알림', message);
		/*
		$.blockUI.defaults.css = {}; 
		$.blockUI({message:message});
		setTimeout(function() {
			$.unblockUI();
		}, 1000);
		*/
	},
	
	loginOK : function() {
		if (!$('#login-userid').val()) {
			Client.alert('아이디를 입력해주세요.'); return;
		}
		if (!$('#login-password').val()) {
			Client.alert('비밀번호를 입력해주세요.'); return;
		}

		$('#login').dialog('close');
		//$('#login-page').hide();
		//$('#article-container').show();
		/*
		$('#login-loading').dialog({
			show : 'fade'
			//hide : 'blind'
		});
		*/

		$.post('/articles/login', {
			'userid':$('#login-userid').val(),
			'password':$('#login-password').val()
		}, function(json) {
			try {
				if (!json) {
					Client.alert('서버에 접속할 수 없습니다.');
					return;
				}
				if (!json.success) {
					Client.alert(json.message);
					return;
				}
				$('#login-userid').val('');
				$('#login-password').val('');
				alert('\''+json.name+'\' 어서오라능');
				location = '/';
				return;

				//$('#login-loading').dialog('close');
				$('#login-page').hide();
				$('#article-container').show();
				//$.cookie('udong_name', json.name);
				$('#add-name').val(json.name);

				$('#header li.login').hide();
				$('#header li.logout').show();
			} catch(e) {
				alert(e);
			}
		},'json');
	},

	login : function() {
		//$('#gallery-container').hide();
		//$('#banner-container').hide();
		//$('#article-container').hide();
		//$('#content-container').hide();
		//$('#login-page').show();

		$('#login-button').unbind('click');
		$('#login-cancel-button').unbind('click');

		/*
		$('#login-button').bind('click',function() {
			Client.loginOK();
		});
		$('#login-cancel-button').bind('click',function() {
			$('#login-page').hide();
			$('#article-container').show();
		});
		*/

		$('#login').dialog({
			title:'로그인',
			show:'fade',
			//hide:'blind',
			buttons:{
				'확인':function() {
					Client.loginOK();
				},
				'닫기':function() {
					$(this).dialog('close');
				}
			},
			open : function(event, ui) {
				$('#login-userid').focus();
			}
		});

	},
	
	preview : function(id) {
		this.article_view.preview(id);
	}
}

// local functions
function strip_tags (input, allowed) {
   if (!input) input = '';

   allowed = (((allowed || "") + "")
	  .toLowerCase()
	  .match(/<[a-z][a-z0-9]*>/g) || [])
	  .join(''); // making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
	var tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
	commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;
	return input.replace(commentsAndPhpTags, '').replace(tags, function($0, $1){
		return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : '';
   });
}

function strtotime(str, now) {
    var i, match, s, strTmp = '', parse = '';

    strTmp = str;
    strTmp = strTmp.replace(/\s{2,}|^\s|\s$/g, ' '); // unecessary spaces
    strTmp = strTmp.replace(/[\t\r\n]/g, ''); // unecessary chars

    if (strTmp == 'now') {
        return parseInt((new Date()).getTime()/1000);
    } else if (!isNaN(parse = Date.parse(strTmp))) {
        return parse/1000;
    } else if (now) {
        now = new Date(now);
    } else {
        now = new Date();
    }

    strTmp = strTmp.toLowerCase();

    var process = function (m) {
        var ago = (m[2] && m[2] == 'ago');
        var num = (num = m[0] == 'last' ? -1 : 1) * (ago ? -1 : 1);

        switch (m[0]) {
            case 'last':
            case 'next':
                switch (m[1].substring(0, 3)) {
                    case 'yea':
                        now.setFullYear(now.getFullYear() + num);
                        break;
                    case 'mon':
                        now.setMonth(now.getMonth() + num);
                        break;
                    case 'wee':
                        now.setDate(now.getDate() + (num * 7));
                        break;
                    case 'day':
                        now.setDate(now.getDate() + num);
                        break;
                    case 'hou':
                        now.setHours(now.getHours() + num);
                        break;
                    case 'min':
                        now.setMinutes(now.getMinutes() + num);
                        break;
                    case 'sec':
                        now.setSeconds(now.getSeconds() + num);
                        break;
                    default:
                        var day;
                        if (typeof (day = __is_day[m[1].substring(0, 3)]) != 'undefined') {
                            var diff = day - now.getDay();
                            if (diff == 0) {
                                diff = 7 * num;
                            } else if (diff > 0) {
                                if (m[0] == 'last') diff -= 7;
                            } else {
                                if (m[0] == 'next') diff += 7;
                            }

                            now.setDate(now.getDate() + diff);
                        }
                }

                break;

            default:
                if (/\d+/.test(m[0])) {
                    num *= parseInt(m[0]);

                    switch (m[1].substring(0, 3)) {
                        case 'yea':
                            now.setFullYear(now.getFullYear() + num);
                            break;
                        case 'mon':
                            now.setMonth(now.getMonth() + num);
                            break;
                        case 'wee':
                            now.setDate(now.getDate() + (num * 7));
                            break;
                        case 'day':
                            now.setDate(now.getDate() + num);
                            break;
                        case 'hou':
                            now.setHours(now.getHours() + num);
                            break;
                        case 'min':
                            now.setMinutes(now.getMinutes() + num);
                            break;
                        case 'sec':
                            now.setSeconds(now.getSeconds() + num);
                            break;
                    }
                } else {
                    return false;
                }

                break;
        }

        return true;
    }

    var __is =
    {
        day:
        {
            'sun': 0,
            'mon': 1,
            'tue': 2,
            'wed': 3,
            'thu': 4,
            'fri': 5,
            'sat': 6
        },
        mon:
        {
            'jan': 0,
            'feb': 1,
            'mar': 2,
            'apr': 3,
            'may': 4,
            'jun': 5,
            'jul': 6,
            'aug': 7,
            'sep': 8,
            'oct': 9,
            'nov': 10,
            'dec': 11
        }
    }

	strTmp = strTmp.replace(/\./g, '-');
    match = strTmp.match(/^(\d{2,4}-\d{2}-\d{2})(\s\d{1,2}:\d{1,2}(:\d{1,2})?)?$/);

    if (match != null) {
        if (!match[2]) {
            match[2] = '00:00:00';
        } else if (!match[3]) {
            match[2] += ':00';
        }

        s = match[1].split(/-/g);

        for (i in __is.mon) {
            if (__is.mon[i] == s[1] - 1) {
                s[1] = i;
            }
        }

        return strtotime(s[2] + ' ' + s[1] + ' ' + s[0] + ' ' + match[2]);
    }

    var regex = '([+-]?\\d+\\s'
    + '(years?|months?|weeks?|days?|hours?|min|minutes?|sec|seconds?'
    + '|sun\.?|sunday|mon\.?|monday|tue\.?|tuesday|wed\.?|wednesday'
    + '|thu\.?|thursday|fri\.?|friday|sat\.?|saturday)'
    + '|(last|next)\\s'
    + '(years?|months?|weeks?|days?|hours?|min|minutes?|sec|seconds?'
    + '|sun\.?|sunday|mon\.?|monday|tue\.?|tuesday|wed\.?|wednesday'
    + '|thu\.?|thursday|fri\.?|friday|sat\.?|saturday))'
    + '(\\sago)?';

    match = strTmp.match(new RegExp(regex, 'g'));

    if (match == null) {
        return false;
    }

    for (i in match) {
        if (!process(match[i].split(' '))) {
            return false;
        }
    }

    return (now);
}


// dc functions
var AjaxClass = {};

function insertFlash(swf, width, height, bgcolor, id, flashvars)
{
	var strFlashTag = new String();

	if (navigator.appName.indexOf("Microsoft") != -1)
	{
		strFlashTag += '<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" ';
		strFlashTag += 'codebase="http://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=version=8,0,0,0" ';
		strFlashTag += 'id="' + id + '" width="' + width + '" height="' + height + '">';
		strFlashTag += '<param name="movie" value="' + swf + '"/>';

		if(flashvars != null) {strFlashTag += '<param name="flashvars" value="' + flashvars + '"/>'};
		strFlashTag += '<param name="quality" value="best"/>';
		strFlashTag += '<param name="bgcolor" value="' + bgcolor + '"/>';
		strFlashTag += '<param name="menu" value="false"/>';
		strFlashTag += '<param name="salign" value="LT"/>';
		strFlashTag += '<param name="scale" value="noscale"/>';
		strFlashTag += '<param name="wmode" value="transparent"/>';
		strFlashTag += '<param name="allowScriptAccess" value="always"/>';
		strFlashTag += '<param name="allowFullScreen" value="true" />';
		
		strFlashTag += '</object>';
	}
	else
	{
		strFlashTag += '<embed src="' + swf + '" ';
		strFlashTag += 'quality="best" ';
		strFlashTag += 'bgcolor="' + bgcolor + '" ';
		strFlashTag += 'width="' + width + '" ';
		strFlashTag += 'height="' + height + '" ';
		strFlashTag += 'menu="false" ';
		strFlashTag += 'scale="noscale" ';
		strFlashTag += 'id="' + id + '" ';
		strFlashTag += 'salign="LT" ';
		strFlashTag += 'wmode="transparent" ';
		strFlashTag += 'allowScriptAccess="always" ';
		if(flashvars != null) {strFlashTag += 'flashvars="' + flashvars + '" '};
		strFlashTag += 'type="application/x-shockwave-flash" allowFullScreen="true"  ';
		strFlashTag += 'pluginspage="http://www.macromedia.com/go/getflashplayer">';
		strFlashTag += '</embed>';
	}
	return strFlashTag;
}
