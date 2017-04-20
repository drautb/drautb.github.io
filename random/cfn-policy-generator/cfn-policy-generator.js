var app = angular.module('cfn-policy-generator-app', []);

app.controller('defaultCtrl', ['$scope', '$http', function($scope, $http) {

  $scope.templateType = 'json';

  $scope.generatePolicy = function() {
    console.log('Generating policy...');

    var contentType = 'application/' + $scope.templateType;

    // $http.post('http://pseudo-localhost:5000/cloudformation/2010-09-09/template',
    $http.post('https://cfn-policy-generator.herokuapp.com/cloudformation/2010-09-09/template',
      $scope.templateBody,
      {
        headers: {
          'content-type': contentType
        }
      }).then(function(response, _) {
        console.log('Response received. status=' + response.status);
        $scope.policyBody = JSON.stringify(response.data, null, 2);
      }, function(_, error) {
        console.log('Error response: ' + JSON.stringify(error));
        alert('Policy generation failed. Please try again.');
      });
  };

}]);

