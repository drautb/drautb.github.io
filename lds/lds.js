var app = angular.module('drautb.lds', []);

app.controller('LdsController', ['$scope', '$http', function($scope, $http) {

  var PP6_UNIT_ID = 15172;

  var DOMAIN = 'https://lcr-proxy.herokuapp.com/';
  var SIGNIN_URL = DOMAIN + 'login.html';
  var MEMBER_INFO_URL = DOMAIN + 'htvt/services/v1/' + PP6_UNIT_ID + '/members';

  $scope.loggedIn = false;
  $scope.user = {};
  $scope.memberInfo = {};

  function login() {
    return $http({
      method: 'POST',
      url: SIGNIN_URL,
      data: $.param({
        username: $scope.user.name, 
        password: $scope.user.password
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      withCredentials: true
    });
  };

  function getMemberInfo() {
    $http({
      method: 'GET',
      url: MEMBER_INFO_URL,
      withCredentials: true
    }).then(function(response) {
      $scope.memberInfo = response.data;
    });
  };

  $scope.login = function() {
    login().then(function(response) {
      console.log('RESPONSE STATUS: ' + response.status);
      if (response.status == 200) {
        $scope.loggedIn = true;
        getMemberInfo();
      } else {
        alert('Login Failed! ' + response.status);
      }
    });
  };

}]);

