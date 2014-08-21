postiesApp.controller('PageIndexCtrl', function($scope, $http, $timeout, $upload,  
	config, SettingsService, LoaderService, FlashService) {

	$scope.posts = [];
	$scope.isStartPage = true;
	$scope.user = {};

	$scope.settingsService = SettingsService;
	$scope.userSettings = $scope.settingsService.getSettings();
	$scope.loader = LoaderService.getLoader();
	$scope.flash = FlashService.getFlash();

	$scope.addPost = function($event) {
		var post = {
			id : Math.round(Math.random() * 1000),
			sortrank : $scope.posts.length + 1,
			content : $event.target.getAttribute('data-content'),
			type : $event.target.getAttribute('data-type'),
			template : $event.target.getAttribute('data-template')
		};

		$scope.posts.unshift(post);
		$scope.showPostTypes = false;
		$timeout(function() {
			$('#posts li:first-child pre:eq(0)').focus();
		}, 100);
	};

	$scope.savePost = function($event, post) {
		if($($event.target).data('changed')) {
			$($event.target).data('changed', false);
			$scope.flash.showMessage('saved...');

			//TODO: Two way binding doesn't work with contenteditable, even though it should.
			post.content = $event.target.innerHTML; 
		}
	};

	$scope.savePostImage = function($files) {
		var imageType = /image.*/;
		
		for (var i = 0; i < $files.length; i++) {
			var file = $files[i];

			if(file.type.match(imageType)) {
				$scope.loader.show();

				var reader = new FileReader();
				
				reader.onload = function(e) {
					$scope.$apply(function() {
						var imagePost = {
							type : 2,
							sortRank : $scope.posts.length + 1,
							template : 'postImage.html',
							key : reader.result,
							file : file
						};
						
						$scope.posts.unshift(imagePost);
						$scope.loader.hide();
					});
				}

				reader.readAsDataURL(file);
			}
	    }
	};

	$scope.movePost = function(currentIndex, newIndex) {
		posties.util.swapItems($scope.posts, currentIndex, newIndex);

		for(i = 0; i < $scope.posts.length; i++) {
			$scope.posts[i].sortrank = $scope.posts.length - i;
		}
	};

	$scope.deletePost = function(currentIndex, post) {
		$scope.posts.splice(currentIndex, 1);
	};

	$scope.validateUserEmail = function($event) {
		if($scope.formCreateUser.email.$viewValue && $scope.formCreateUser.email.$invalid) {
			$scope.formCreateUser.email.error = 'Your email needs to be between 5 and 40 characters';

			return;
		} else {
			delete $scope.formCreateUser.email.error;
		}

		$http({
			url: '/api/users/email',
			method: 'get',
			params: { email : $scope.user.email }
		}).then(function(response) {
			if(response.data.user) {
				$scope.formCreateUser.email.$invalid = true;
				$scope.formCreateUser.email.error = 'The email address is already taken!';
			} else {
				$scope.formCreateUser.email.$invalid = false;
				delete $scope.formCreateUser.email.error;
			}
		}, function(response) {
			console.log(response);
		});
	};

	$scope.validateUserUsername = function($event) {
		if($scope.formCreateUser.username.$viewValue && $scope.formCreateUser.username.$invalid) {
			$scope.formCreateUser.username.error = 'The username needs to be between 3 and 20 characters';

			return;
		} else {
			delete $scope.formCreateUser.username.error;
		}

		$http({
			url: '/api/users',
			method: 'get',
			params: { username : $scope.user.username }
		}).then(function(response) {
			if(response.data.user) {
				$scope.formCreateUser.username.$invalid = true;
				$scope.formCreateUser.username.error = 'The username is already taken!';
			} else {
				$scope.formCreateUser.username.$invalid = false;
				delete $scope.formCreateUser.username.error;
			}
		}, function(response) {
			console.log(response);
		});
	};

	$scope.validateUserPassword = function($event) {
		if($scope.formCreateUser.password.$viewValue && $scope.formCreateUser.password.$invalid) {
			$scope.formCreateUser.password.error = 'Your password needs to be between 5 and 20 characters long';

			return;
		} else {
			delete $scope.formCreateUser.password.error;
		}
	};

	$scope.submitCreateUser = function() {
		if($scope.formCreateUser.$valid) {
			var jsonPost = { 
				email : $scope.user.email,
				username : $scope.user.username,
				password : $scope.user.password,
				posts : $scope.posts,
				settings : $scope.userSettings
			};

			jsonPost.settings['username'] = $scope.user.username;

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
	};

	//Angular doesn't do ng-change on contenteditable, using jQuery
	$('#posts').on('propertychange, input', 'pre', function(el) {
		$(this).data('changed', true);
	});
});

postiesApp.controller('PageLoginCtrl', function($scope, AuthService, FlashService) {

	$scope.flash = FlashService.getFlash();

	$scope.submitLogin = function() {
		var jsonPost = JSON.stringify({ 
			'email' : $scope.user.email,
			'password' : $scope.user.password
		});

		AuthService.login(jsonPost).then(function(response) {
			if(response.status == 200) {
				window.location = "/by/" + response.data.username;
			} else {
				$scope.flash.showPermanentMessage(response.data.error);
			}
		});
	};

});

postiesApp.controller('PagePostsByUserCtrl', function($scope, $http, $timeout, $upload, 
	config, SettingsService, 
	LoaderService, FlashService) {

	$scope.posts = [];
	$scope.userOwnsPage = $('body').hasClass('userOwnsPage');
	$scope.settingsService = SettingsService;
	$scope.loader = LoaderService.getLoader();
	$scope.flash = FlashService.getFlash();

	if(posties.util.getQueryParamByName('intro')) {
		$scope.flash.showPermanentMessage('Welcome to your new Posties page! \n Your address is ' + window.location.host + window.location.pathname);
	}

	/*$scope.settingsService.getSettings().then(function(data) {
		$scope.settings = data;
	});*/

	var urlPathName = location.pathname;
	var username = urlPathName.substr(urlPathName.lastIndexOf('/') + 1, urlPathName.length);

	//Fetch user posts
	$http({
		url: '/api/user',
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
				post.key = 'https://s3-eu-west-1.amazonaws.com/postiesimages/' + post.key;
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

	$scope.savePostImage = function($files) {
		var jsonPost = {
			type : 2,
			sortRank : $scope.posts.length + 1
		};

		for (var i = 0; i < $files.length; i++) {
			$scope.loader.show();
			var file = $files[i];
			$scope.upload = $upload.upload({
				url: '/api/postImage',
				method: 'post',
				//withCredentials: true,
				data: jsonPost,
				file: file,
			}).progress(function(evt) {
				$scope.loader.setMessage('uploaded ' + parseInt(100.0 * evt.loaded / evt.total) + "%");
			}).success(function(data, status, headers, config) {
				data.template = 'postImage.html';
				data.key = 'https://s3-eu-west-1.amazonaws.com/postiesimages/' + data.key;
				$scope.posts.unshift(data);
				$scope.loader.hide();
			}).error(function(response) {
				console.log(response);
			});
		}
	};

	$scope.savePost = function($event, post) {
		//Fix for Angulars non-handling of ng-model/two way data binding for contenteditable
		var postTextContent = $event.target.innerHTML;

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
				$($event.target).data('changed', false);
				$scope.flash.showMessage('saved...');
			}, function(response) {
				console.log(response);
			});
		}
	};

	$scope.movePost = function(currentIndex, newIndex) {
		posties.util.swapItems($scope.posts, currentIndex, newIndex);

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

postiesApp.controller('PageErrorCtrl', function() {});