postiesApp.controller('PageIndexCtrl', function($scope, $http, $timeout, SettingsService, config) {

	$scope.posts = [];
	$scope.isStartPage = true;

	$scope.settingsService = SettingsService;
	$scope.userSettings = $scope.settingsService.getSettings();

	$scope.addPost = function($event) {
		var post = {
			'id' : Math.round(Math.random() * 1000),
			'sortrank' : $scope.posts.length + 1,
			'content' : $event.target.getAttribute('data-content'),
			'type' : $event.target.getAttribute('data-type'),
			'template' : $event.target.getAttribute('data-template')
		}

		$scope.posts.unshift(post);
		$scope.showPostTypes = false;
		$timeout(function() {
			$('#posts li:first-child pre:eq(0)').focus();
		}, 100);
	};

	$scope.savePost = function($event, post) {
		if($($event.target).data('changed')) {
			$('#flashSaved').fadeIn().delay(500).fadeOut();
			$($event.target).data('changed', false);
		}
	};

	$scope.movePost = function(currentIndex, newIndex) {
		swapItems($scope.posts, currentIndex, newIndex);
	}

	$scope.deletePost = function(currentIndex, post) {
		$scope.posts.splice(currentIndex, 1);
	}

	$scope.publish = function() {
		$('.modal.createUser').toggle();
	}

	$scope.submitCreateUser = function() {
		if($scope.userForm.$valid) {
			var formCreateUser = $('#formCreateUser');

			var posts = [];
			
			var numberOfPosts = $('#posts > li').length;
			$('.postText, .postHeadline').each(function(index) { 
				var content = $(this).text();
				var type = $(this).hasClass('postText') ? 0 : 1;

				posts.push({ 'content' : content, 'sortrank' : numberOfPosts - index, 'type' : type });
			});

			var jsonPost = JSON.stringify({ 
				'email' : formCreateUser.find('.email:eq(0)').val(),
				'username' : formCreateUser.find('.username:eq(0)').val(),
				'password' : formCreateUser.find('.password:eq(0)').val(),
				'posts' : posts,
				'settings' : $scope.userSettings
			});

			$http({
				url: '/api/users',
				method: 'post',
				data: jsonPost,
				headers: config.headerJSON
			}).then(function(response) {
				console.log(response);
				window.location = "/by/" + response.data.username + "?intro=true";
			}, function(response) {
				console.log(response);
			});

		} else {
			console.log("form is invalid");
		}
	}

	//Angular doesn't do ng-change on contenteditable, using jQuery
	$('#posts').on('propertychange, input', 'pre', function(el) {
		$(this).data('changed', true);
	});
});

postiesApp.controller('PageLoginCtrl', function($scope, $http, SettingsService, AuthService, config) {

	$scope.submitLogin = function() {
		var jsonPost = JSON.stringify({ 
			'email' : $scope.user.email,
			'password' : $scope.user.password
		});

		AuthService.login(jsonPost).then(function(response) {
			if(response.status == 200) {
				window.location = "/by/" + response.data.username;
			} else {
				$scope.formLogin.error = response.data.error;
			}
		});
	}

});

postiesApp.controller('PagePostsByUserCtrl', function($scope, $http, $timeout, SettingsService, config, $upload) {

	$scope.posts = [];
	$scope.userOwnsPage = $('body').hasClass('userOwnsPage');
	$scope.settingsService = SettingsService;
	
	/*$scope.settingsService.getSettings().then(function(data) {
		$scope.settings = data;
	});*/

	var urlPathName = location.pathname;
	var username = urlPathName.substr(urlPathName.lastIndexOf('/') + 1, urlPathName.length);

	//Fetch user posts
	$http({
		url: '/api/users',
		method: 'get',
		params: { 'username' : username },
		headers: config.headerJSON
	}).then(function(response) {
		$scope.userSettings = response.data.settings;
		$scope.user = { 'username' : response.data.username, 'isAuthenticated' : response.data.is_authenticated };

		for(i = 0; i < response.data.posts.length; i++) {
			var post = response.data.posts[i];

			if(post.type == 0) {
				post.template = 'postText.html';
			} else if(post.type == 1) {
				post.template = 'postHeadline.html';
			} else if(post.type == 2) {
				post.template = 'postImage.html';
			}

			$scope.posts.push(post);
		}
	}, function(response) {
		console.log(response);
	});

	$scope.addPost = function($event) {
		var jsonPost = {
			type : $event.target.getAttribute('data-type'),
			content : '',
			sortRank : $scope.posts.length
		};

		$http({
			url: '/api/postText',
			method: 'post',
			data: jsonPost,
			headers: config.headerJSON
		}).then(function(response) {
			var post = response.data;
			
			if(post.type == 0) {
				post.template = 'postText.html';
			} else if(post.type == 1) {
				post.template = 'postHeadline.html';
			} else if(post.type == 2) {
				post.template = 'postImage.html';
			}

			$scope.posts.unshift(post);
			$timeout(function() {
				$('#posts li:first-child pre:eq(0)').focus();
			}, 100);
		}, function(response) {
			console.log(response);
		});

		$scope.showPostTypes = false;
	};

	$scope.togglePostImageUploadForm = function($event) {
		$scope.showPostImageUploadForm = true;
		$scope.showPostTypes = false;
	};

	$scope.savePostImage = function($files) {
		var jsonPost = {
			type : 2,
			sortRank : $scope.posts.length
		};

		for (var i = 0; i < $files.length; i++) {
			var file = $files[i];
			$scope.upload = $upload.upload({
				url: '/api/postImage',
				method: 'post',
				//withCredentials: true,
				data: jsonPost,
				file: file,
			}).progress(function(evt) {
				console.log('percent: ' + parseInt(100.0 * evt.loaded / evt.total));
			}).success(function(data, status, headers, config) {
				data.template = 'postImage.html';
				$scope.posts.unshift(data);
				$scope.showPostImageUploadForm = false;
			}).error(function(response) {
				console.log(response);
			});
	    }
	};

	$scope.savePost = function($event, $index, post) {
		//Fix for Angulars non-handling of ng-model/two way data binding for contenteditable
		postTextContent = angular.element($event)[0].currentTarget.innerHTML;

		if(postTextContent.length && $($event.target).data('changed')) {
			var jsonPost = {
				content: postTextContent,
				id: post.id
			};
			
			$http({
				url: '/api/postText',
				method: 'put',
				data: jsonPost,
				headers: config.headerJSON
			}).then(function(response) {
				$('#flashSaved').fadeIn().delay(500).fadeOut();
				$($event.target).data('changed', false);
			}, function(response) {
				console.log(response);
			});
		}
	};

	$scope.movePost = function(currentIndex, newIndex) {
		swapItems($scope.posts, currentIndex, newIndex);

		var jsonPost = [];
		for(i = 0; i < $scope.posts.length; i++) {
			var post = $scope.posts[i];
			jsonPost.push({ id : post.id, sortrank : $scope.posts.length - i });
		}

		$http({
			url: '/api/postrank',
			method: 'post',
			data: jsonPost,
			headers: config.headerJSON
		}).then(function(response) {
			console.log(response);
		}, function(response) {
			console.log(response);
		});
	};

	$scope.deletePost = function(currentIndex, post) {
		$http({
			url: '/api/posts',
			method: 'delete',
			data: post,
			headers: config.headerJSON
		}).then(function(response) {
			$scope.posts.splice(currentIndex, 1);
		}, function(response) {
			console.log(response);
		});
	};

	//Angular doesn't do ng-change on contenteditable, using jQuery
	$('#posts').on('propertychange, input', 'pre', function(el) {
		$(this).data('changed', true);
	});
});