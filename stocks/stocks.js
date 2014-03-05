var stocksApp = angular.module('stocks-app', []);

stocksApp.controller('teamCtrl', ['$scope', '$interval', '$http', function($scope, $interval, $http){

	$scope.teams = [
		{
			team: 'O_O',
			members: ['Ben Draut', 'Braden Hess'],
			stocks: [
				{ symbol: 'VIV.PA', shares: 465, paid: 21.25 },
				{ symbol: 'ALU.PA', shares: 4, paid: 3.178 },
				{ symbol: 'CAP.PA', shares: 1, paid: 56.68 },
				{ symbol: 'AC.PA', shares: 1, paid: 37.03 },
				{ symbol: 'ACA.PA', shares: 1, paid: 11.25 }
			]
		},
		{
			team: 'Les Mouchons de M. LeBras',
			members: ['Steven Livingston', 'Ryan Horne'],
			stocks: [
				{ symbol: 'ALU.PA', shares: 469, paid: 3.187 },
				{ symbol: 'DG.PA', shares: 25, paid: 53.95 },
				{ symbol: 'GLE.PA', shares: 29, paid: 47.53 },
				{ symbol: 'MT.AS', shares: 188, paid: 11.65 },
				{ symbol: 'ORA.PA', shares: 228, paid: 9.63 },
				{ symbol: 'UG.PA', shares: 110, paid: 12.66 }
			]
		},
		{
			team: 'Les sales types',
			members: ['Brian Williams', 'Joshua Fryer'],
			stocks: [
				{ symbol: 'AC.PA', shares: 40, paid: 37.0 },
				{ symbol: 'BN.PA', shares: 88, paid: 51.0 },
				{ symbol: 'EN.PA', shares: 41, paid: 30.0 },
				{ symbol: 'GLE.PA', shares: 40, paid: 47.0 },
				{ symbol: 'VIV.PA', shares: 40, paid: 21.0 }
			]
		}
	];

	$scope.teams.forEach(function (t) {
		t.currentValue = 0;
		t.originalValue = 0;
		t.yesterdayValue = 0;
		t.dayPercentChange = 0;
		t.totalGain = 0;
		t.totalPercentChange = 0;
		t.trailing = 0;
	});

	$scope.stockNames = {
		'VIV.PA': 'Vivendi SA',
		'ALU.PA': 'Alcatel-Lucent',
		'CAP.PA': 'Capgemini',
		'AC.PA': 'Accor SA',
		'ACA.PA': 'Credit Agricole',
		'BN.PA': 'Danone',
		'EN.PA': 'Bouygues',
		'GLE.PA': 'Societe Generale',
		'DG.PA': 'Vinci',
		'LG.PA': 'Lafarge SA',
		'ML.PA': 'Michelin',
		'MT.AS': 'ARCELORMITTAL REG',
		'ORA.PA': 'ORANGE',
		'UG.PA': 'Peugeot'
	};

	$scope.latestQuotes = [];

	getLatestQuotes();
	$interval(getLatestQuotes, 10000);

	function getLatestQuotes() {
		var url = 'http://query.yahooapis.com/v1/public/yql';
		var attrs = ['Symbol', 'Ask', 'Change', 'PercentChange', 'LastTradeTime', 'PreviousClose'];
		var data = encodeURIComponent("SELECT " + attrs.join(',') + 
									  " FROM yahoo.finance.quotes WHERE symbol IN (" + getSymbols() + ")");
		data += "&format=json&env=http://datatables.org/alltables.env";			
		url += "?q=" + data;

		$http({method: 'GET', url: url}).success(function(data, status, headers, config) {
			data.query.results.quote.forEach(function(res) {
				var time = getFormattedTime(res.LastTradeTime);

				$scope.latestQuotes[res.Symbol] = {
					change: res.Change,
					previousClose: res.PreviousClose,
					percentChange: res.PercentChange,
					currentBid: res.Ask,
					lastTradeTime: time
				};
			});

			updateTeamTotals();
		}).error(function(data, status, headers, config) {
			console.log("Error retrieiving stock data");
			console.log(status);
		});
	};

	function getFormattedTime(time) {
		time = time.replace(/(\d)([ap])/, "$1 $2");
		var chunks = time.split(/:| /);
		chunks[0] = Number(chunks[0]) + 6;

		var today = new Date();
		var traded = new Date(today.getFullYear(), today.getMonth(), today.getDay(), chunks[0], chunks[1], 0);

		return traded.format("hh:MMtt") + " CET";
	};

	function getSymbols() {
		return Object.keys($scope.stockNames).map(function(key) {
			return "'" + key + "'";
		}).join(',');
	};

	function updateTeamTotals() {
		$scope.teams.forEach(function (team) {
			team.currentValue = 0;
			team.originalValue = 0;
			team.yesterdayValue = 0;
			team.dayPercentChange = 0;
			for (var s=0; s<team.stocks.length; s++) {
				var currentStockValue = team.stocks[s].shares * $scope.latestQuotes[team.stocks[s].symbol].currentBid;
				var originalStockValue = team.stocks[s].shares * team.stocks[s].paid;

				team.currentValue += currentStockValue;
				team.originalValue += originalStockValue;
				team.yesterdayValue += team.stocks[s].shares * $scope.latestQuotes[team.stocks[s].symbol].previousClose;

				team.stocks[s].percentChange = (currentStockValue - originalStockValue) / originalStockValue;
			}
			team.dayPercentChange = (team.currentValue - team.yesterdayValue) / team.currentValue;
			team.totalGain = team.currentValue - team.originalValue;
			team.totalPercentChange = (team.currentValue - team.originalValue) / team.originalValue;
		});

		for (var t=0; t<$scope.teams.length; t++) {
			for (var op=0; op<$scope.teams.length; op++) {
				if (op == t) continue;

				$scope.teams[t].trailing = Math.min(
					$scope.teams[t].trailing,
					$scope.teams[t].currentValue - $scope.teams[op].currentValue
  				);
			}
		}
	};
}]);
	
