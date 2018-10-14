var app = angular.module('christmas-rotation-app', []);

app.controller('defaultCtrl', ['$scope', function($scope) {

  $scope.participants = [
    'Tiffany and Trevor',
    'Ben and Brittney',
    'Michael and Rachel',
    'Mindy and Michael',
//    'Joseph', restore when he's back from his mission.
    'Becky'
  ];

  $scope.participantCount = $scope.participants.length;

  var START_YEAR = 2016;

  $scope.currentYear = new Date().getFullYear();
  $scope.selectedYear = $scope.currentYear;

  $scope.getOffset = function() {
    var offset = $scope.selectedYear - START_YEAR + 1;

    offset += Math.floor(($scope.selectedYear - START_YEAR) / ($scope.participantCount - 1));

    return offset;
  };

  $scope.range = function(min, max, step) {
    step = step || 1;
    var input = [];
    for (var i = min; i <= max; i += step) {
      input.push(i);
    }
    return input;
  };

}]);
