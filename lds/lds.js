var stocksApp = angular.module('lds-app', []);

stocksApp.controller('ldsCtrl', ['$scope', '$http', function($scope, $http) {

  var SIGNIN_URL = "https://ident.lds.org/sso/UI/Login";

  $scope.loggedIn = false;
  $scope.authToken = undefined;

  $scope.login = function() {
    $http.post(SIGNIN_URL, {
      headers: {
        "Content-Type": "application/json"
      },
      data: {
        username: $scope.username,
        password: $scope.password
    }}).then(function(response) {
      consol.log(response);
    });
  };

}]);

