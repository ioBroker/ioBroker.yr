/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

const got = require('got');
const http = require('http');
const utils = require('@iobroker/adapter-core'); // Get common adapter utils

const pjson = require('./package.json');
const dictionary = require(__dirname + '/lib/words');

const LEGEND_URL = 'https://api.met.no/weatherapi/weathericon/2.0/legends';
const FORECAST_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';

/*
const adapter = utils.Adapter({
	name:          'yr',       // adapter name
	useFormatDate:  true       // read date format from config
});

adapter.on('ready', main);

function main() {
	const tmp  = adapter.config.location.split('/');
	const city = decodeURI(tmp.pop());

	adapter.config.language = adapter.config.language || 'en';
	if (adapter.config.sendTranslations === undefined) adapter.config.sendTranslations = true;
	if (adapter.config.sendTranslations === 'true')  adapter.config.sendTranslations = true;
	if (adapter.config.sendTranslations === 'false') adapter.config.sendTranslations = false;

	adapter.getObject('forecast.day0.temperatureActual', (err, obj) => {
		if (obj && obj.common && obj.common.unit) {
			if (obj.common.unit === '°C' && adapter.config.nonMetric) {
				obj.common.unit = '°F';
				adapter.setObject(obj._id, obj, () => {
					adapter.log.info(`Metrics changed for ${obj._id} to ${obj.common.unit}`);
				});
			} else if (obj.common.unit !== '°C' && !adapter.config.nonMetric) {
				obj.common.unit = '°C';
				adapter.setObject(obj._id, obj, () => {
					adapter.log.info(`Metrics changed for ${obj._id} to ${obj.common.unit}`);
				});
			}
		}
	});

	for (let d = 0; d < 3; d++) {
		adapter.getObject('forecast.day' + d + '.windSpeed',      (err, obj) => {
			if (obj && obj.common && obj.common.unit) {
				if (obj.common.unit === 'km/h' && adapter.config.nonMetric) {
					obj.common.unit = 'm/h';
					adapter.setObject(obj._id, obj, () => {
						adapter.log.info(`Metrics changed for ${obj._id} to ${obj.common.unit}`);
					});
				} else if (obj.common.unit !== 'km/h' && !adapter.config.nonMetric) {
					obj.common.unit = 'km/h';
					adapter.setObject(obj._id, obj, () => {
						adapter.log.info(`Metrics changed for ${obj._id} to ${obj.common.unit}`);
					});
				}
			}
		});
		adapter.getObject('forecast.day' + d + '.temperatureMin', (err, obj) => {
			if (obj && obj.common && obj.common.unit) {
				if (obj.common.unit === '°C' && adapter.config.nonMetric) {
					obj.common.unit = '°F';
					adapter.setObject(obj._id, obj, () => {
						adapter.log.info(`Metrics changed for ${obj._id} to ${obj.common.unit}`);
					});
				} else if (obj.common.unit !== '°C' && !adapter.config.nonMetric) {
					obj.common.unit = '°C';
					adapter.setObject(obj._id, obj, () => {
						adapter.log.info(`Metrics changed for ${obj._id} to ${obj.common.unit}`);
					});
				}
			}
		});
		adapter.getObject('forecast.day' + d + '.temperatureMax', (err, obj) => {
			if (obj && obj.common && obj.common.unit) {
				if (obj.common.unit === '°C' && adapter.config.nonMetric) {
					obj.common.unit = '°F';
					adapter.setObject(obj._id, obj, () => {
						adapter.log.info(`Metrics changed for ${obj._id} to ${obj.common.unit}`);
					});
				} else if (obj.common.unit !== '°C' && !adapter.config.nonMetric) {
					obj.common.unit = '°C';
					adapter.setObject(obj._id, obj, () => {
						adapter.log.info(`Metrics changed for ${obj._id} to ${obj.common.unit}`);
					});
				}
			}
		});
		adapter.getObject('forecast.day' + d + '.precipitation',  (err, obj) => {
			if (obj && obj.common && obj.common.unit) {
				if (obj.common.unit === 'mm' && adapter.config.nonMetric) {
					obj.common.unit = 'in';
					adapter.setObject(obj._id, obj, () => {
						adapter.log.info(`Metrics changed for ${obj._id} to ${obj.common.unit}`);
					});
				} else if (obj.common.unit !== 'mm' && !adapter.config.nonMetric) {
					obj.common.unit = 'mm';
					adapter.setObject(obj._id, obj, () => {
						adapter.log.info(`Metrics changed for ${obj._id} to ${obj.common.unit}`);
					});
				}
			}
		});
	}

	adapter.getObject('forecast', (err, obj) => {
		if (!obj || !obj.common || obj.common.name !== 'yr.no forecast ' + city) {
			adapter.setObject('forecast', {
				type: 'device',
				role: 'forecast',
				common: {
					name: 'yr.no forecast ' + city
				},
				native: {
					url:     adapter.config.location,
					country: decodeURI(tmp[0]),
					state:   decodeURI(tmp[1]),
					city:    city
				}
			});
		}
	});

	if (adapter.config.location.indexOf('forecast.xml') === -1) {
		if (adapter.config.location.indexOf('%') === -1) adapter.config.location = encodeURI(adapter.config.location);

		adapter.setState('forecast.info.diagram', 'http://www.yr.no/place/' + adapter.config.location + '/avansert_meteogram.png', true);

		const reqOptions = {
			hostname: 'www.yr.no',
			port:     80,
			path:     '/place/' + adapter.config.location + '/forecast.xml',
			method:   'GET'
		};

		adapter.log.debug('get http://' + reqOptions.hostname + reqOptions.path);

		const req = http.request(reqOptions, res => {
			let data = '';

			res.on('data', chunk => data += chunk);

			res.on('end', () => {
				adapter.log.debug('received data from yr.no');
				parseData(data.toString());
			});
		});

		req.on('error', e => {
			adapter.log.error(e.message);
			parseData(null);
		});

		req.end();
	} else {
		parseData(require('fs').readFileSync(adapter.config.location).toString());
	}

	// Force terminate after 5min
	setTimeout(() => {
		adapter.log.error('force terminate');
		process.exit(1);
	}, 300000);
}

function _(text) {
	if (!text) return '';

	if (dictionary[text]) {
		let newText = dictionary[text][adapter.config.language];
		if (newText) {
			return newText;
		} else if (adapter.config.language !== 'en') {
			newText = dictionary[text].en;
			if (newText) {
				return newText;
			}
		}
	} else {
		if (adapter.config.sendTranslations) {
			const options = {
				hostname: 'download.iobroker.net',
				port: 80,
				path: '/yr.php?word=' + encodeURIComponent(text)
			};
			const req = http.request(options, res => {
				console.log('STATUS: ' + res.statusCode);
				adapter.log.info('Missing translation sent to iobroker.net: "' + text + '"');
			});
			req.on('error', e => {
				adapter.log.error('Cannot send to server missing translation for "' + text + '": ' + e.message);
			});
			req.end();
		} else {
			adapter.log.warn('Translate: "' + text + '": {"en": "' + text + '", "de": "' + text + '", "ru": "' + text + '"}, please send to developer');
		}
	}
	return text;
}

function celsius2fahrenheit(degree, isConvert) {
	if (isConvert) {
		return degree * 9 / 5 + 32;
	} else {
		return degree;
	}
}

function parseData(xml) {
	if (!xml) {
		setTimeout(() => process.exit(0), 5000);
		return;
	}
	const options = {
		explicitArray: false,
		mergeAttrs: true
	};
	const parser = new xml2js.Parser(options);
	parser.parseString(xml, (err, result) => {
		if (err) {
			adapter.log.error(err);
		} else {
			adapter.log.info('got weather data from yr.no');
			const forecastArr = result.weatherdata.forecast.tabular.time;

			let tableDay =      '<table style="border-collapse: collapse; padding: 0; margin: 0"><tr class="yr-day">';
			let tableHead =     '</tr><tr class="yr-time">';
			let tableMiddle =   '</tr><tr class="yr-img">';
			let tableBottom =   '</tr><tr class="yr-temp">';
			const dateObj = new Date();
			const dayEnd = dateObj.getFullYear() + '-' + ('0' + (dateObj.getMonth() + 1)).slice(-2) + '-' + ('0' + dateObj.getDate()).slice(-2) + 'T24:00:00';
			let daySwitch = false;

			let day = -1; // Start from today
			const days = [];
			for (let i = 0; i < 12 && i < forecastArr.length; i++) {
				const period = forecastArr[i];

				if (!period.period || period.period === '0') day++;

				// We want to process only today, tomorrow and the day after tomorrow
				if (day === 3) break;
				period.symbol.url         = '/adapter/yr/icons/' + period.symbol.var + '.svg';
				period.symbol.name        = _(period.symbol.name);
				period.windDirection.code = _(period.windDirection.code);
				period.windDirection.name = _(period.windDirection.name);

				if (i < 8) {
					switch (i) {
						case 0:
							tableHead += '<td>' + _('Now') + '</td>';
							break;
						default:
							if (period.from > dayEnd) {
								if (!daySwitch) {
									daySwitch = true;
									tableDay += '<td colspan="' + i + '">' + _('Today') + '</td><td colspan="4">' + _('Tomorrow') + '</td>';
									if (i < 3) tableDay += '<td colspan="' + (4 - i) + '">' + _('After tomorrow') + '</td>';
									tableHead += '<td>' + parseInt(period.from.substring(11, 13), 10).toString() + '-' + parseInt(period.to.substring(11, 13), 10).toString() + '</td>';
								} else {
									tableHead += '<td>' + parseInt(period.from.substring(11, 13), 10).toString() + '-' + parseInt(period.to.substring(11, 13), 10).toString() + '</td>';
								}

							} else {
								tableHead += '<td>' + parseInt(period.from.substring(11, 13), 10).toString() + '-' + parseInt(period.to.substring(11, 13), 10).toString() + '</td>';
							}
					}

					tableMiddle += '<td><img style="position: relative;margin: 0;padding: 0;left: 0;top: 0;width: 38px;height: 38px;" src="' + period.symbol.url + '" alt="' + period.symbol.name + '" title="' + period.symbol.name + '"><br/>';
					tableBottom += '<td><span class="">' + period.temperature.value + '°C</span></td>';
				}

				if (day === -1 && !i) day = 0;
				if (!days[day]) {
					days[day] = {
						date:                new Date(period.from),
						icon:                period.symbol.url,
						state:               period.symbol.name,
						temperatureMin:      celsius2fahrenheit(parseFloat(period.temperature.value), adapter.config.nonMetric),
						temperatureMax:      celsius2fahrenheit(parseFloat(period.temperature.value), adapter.config.nonMetric),
						precipitation:  adapter.config.nonMetric ? parseFloat(period.precipitation.value) / 25.4 : parseFloat(period.precipitation.value),
						windDirection:       period.windDirection.code,
						windSpeed:           adapter.config.nonMetric ? parseFloat(period.windSpeed.mps) : parseFloat(period.windSpeed.mps) * 3.6,
						pressure:            parseFloat(period.pressure.value),
						count:               1
					};
				} else {
					// Summarize
					let t;
					// Take icon for day always from 12:00 to 18:00 if possible
					if (i === 2) {
						days[day].icon  = period.symbol.url;
						days[day].state = period.symbol.name;
						days[day].windDirection = period.windDirection.code;
					}
					t = celsius2fahrenheit(parseFloat(period.temperature.value), adapter.config.nonMetric);
					if (t < days[day].temperatureMin) {
						days[day].temperatureMin = t;
					} else
					if (t > days[day].temperatureMax) {
						days[day].temperatureMax = t;
					}

					days[day].precipitation  += adapter.config.nonMetric ? parseFloat(period.precipitation.value) / 25.4 : parseFloat(period.precipitation.value);
					days[day].windSpeed           += adapter.config.nonMetric ? parseFloat(period.windSpeed.mps) : parseFloat(period.windSpeed.mps) * 3.6;
					days[day].pressure            += parseFloat(period.pressure.value);
					days[day].count++;
				}
				// Set actual temperature
				if (!day && !i) {
					days[day].temperatureActual = celsius2fahrenheit(parseInt(period.temperature.value, 10), adapter.config.nonMetric);
				}
			}
			const style = '<style type="text/css">tr.yr-day td {font-family: sans-serif; font-size: 9px; padding:0; margin: 0;}\ntr.yr-time td {text-align: center; font-family: sans-serif; font-size: 10px; padding:0; margin: 0;}\ntr.yr-temp td {text-align: center; font-family: sans-serif; font-size: 12px; padding: 0; margin: 0;}\ntr.yr-img td {text-align: center; padding: 0; margin: 0;}</style>';
			const table = style + tableDay + tableHead + tableMiddle + tableBottom + '</tr></table>';
			//console.log(JSON.stringify(result, null, "  "));

			for (day = 0; day < days.length; day++) {
				// Take the average
				if (days[day].count > 1) {
					days[day].precipitation /= days[day].count;
					days[day].windSpeed          /= days[day].count;
					days[day].pressure           /= days[day].count;
				}
				days[day].temperatureMin = Math.round(days[day].temperatureMin);
				days[day].temperatureMax = Math.round(days[day].temperatureMax);
				days[day].precipitation  = Math.round(days[day].precipitation);
				days[day].windSpeed      = Math.round(days[day].windSpeed * 10) / 10;
				days[day].pressure       = Math.round(days[day].pressure);

				days[day].date = adapter.formatDate(days[day].date);

				delete days[day].count;
				for (const name in days[day]) {
					if (days[day].hasOwnProperty(name)) {
						adapter.setState('forecast.day' + day + '.' + name, {val: days[day][name], ack: true});
					}
				}
			}
					   
			adapter.log.debug('data successfully parsed. setting states');

			adapter.setState('forecast.info.html',   {val: table, ack: true});
			adapter.setState('forecast.info.object', {val: JSON.stringify(days),  ack: true}, () => {
				setTimeout(() => process.exit(0), 5000);
			});
		}
	});
}
*/

const USER_AGENT = 'ioBroker.yr github.com/ioBroker/ioBroker.yr'

class Yr extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'yr',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('unload', this.onUnload.bind(this));

		this.client = got.extend({
			headers: {
			  'user-agent': `ioBroker.yr/${pjson.version} github.com/ioBroker/ioBroker.yr`
			}
		});
	}

	async onReady() {
		this.log.info('Start version ' + pjson.version);
		if (typeof this.config.longitude == undefined || this.config.longitude == null || this.config.longitude.length == 0 || isNaN(this.config.longitude) 
				|| typeof this.config.latitude == undefined || this.config.latitude == null || this.config.latitude.length == 0 || isNaN(this.config.latitude)) {
			this.log.info("longitude/longitude not set, get data from system ");
			try{
				const state = await this.getForeignObjectAsync("system.config");
				this.config.longitude = state.common.longitude;
				this.config.latitude = state.common.latitude;
				this.log.info("system  longitude: " + this.config.longitude + " latitude: " + this.config.latitude);
			} catch (err){
				this.log.error(err);
			}
		} else {
			this.log.info("longitude/longitude will be set by self-Config - longitude: " + this.config.longitude + " latitude: " + this.config.latitude);
		}

		this.main();
	}

	onUnload(callback) {
		try {
			callback();
		} catch (e) {
			callback();
		}
	}


	_(text) {
		if (!text) return '';
	
		if (dictionary[text]) {
			let newText = dictionary[text][this.config.language];
			if (newText) {
				return newText;
			} else if (this.config.language !== 'en') {
				newText = dictionary[text].en;
				if (newText) {
					return newText;
				}
			}
		} else {
			if (this.config.sendTranslations) {
				const options = {
					hostname: 'download.iobroker.net',
					port: 80,
					path: '/yr.php?word=' + encodeURIComponent(text)
				};
				const req = http.request(options, res => {
					console.log('STATUS: ' + res.statusCode);
					this.log.info('Missing translation sent to iobroker.net: "' + text + '"');
				});
				req.on('error', e => {
					this.log.error('Cannot send to server missing translation for "' + text + '": ' + e.message);
				});
				req.end();
			} else {
				this.log.warn('Translate: "' + text + '": {"en": "' + text + '", "de": "' + text + '", "ru": "' + text + '"}, please send to developer');
			}
		}
		return text;
	}


	celsius2fahrenheit(degree, isConvert) {
		if (isConvert) {
			return degree * 9 / 5 + 32;
		} else {
			return degree;
		}
	}

	async updateData(data){
		this.log.debug('Raw data: ' + JSON.stringify(data));

		//Legend
		const legend = await this.client(LEGEND_URL).json();

		var now = new Date();
		var units = data['properties']['meta']['units'];
		var updated_at = new Date(data['properties']['meta']['updated_at']);
		var timeseries = data['properties']['timeseries'];

		await this.setObjectAsync('updated_at', {
			type: 'state',
			common: {
				name: 'updated_at',
				desc: '',
				type: 'string',
				role: 'text',
				read: true,
				write: false,
				def: ''
			},
			native: {},
		});
		await this.setStateAsync('updated_at', updated_at.toString(), true);

		const device = 'forecastHourly';
		//Device
		await this.setObjectAsync(device, {
			type: 'device',
			common: {
				name: 'forecast hourly',
				role: 'weather'
			},
			native: {},
		});
		for(let i in timeseries){
			var forecast = timeseries[i];
			var time = new Date(forecast['time']);
			var hour_diff = Math.ceil((time - now) / (1000 * 60 * 60));
			hour_diff = hour_diff === -0 ? 0 : hour_diff;

			var hour_data = forecast['data'];
			var channel = hour_diff + 'h';
			
			await this.setObjectAsync(device + '.' + channel, {
				type: 'channel',
				common: {
					name: 'in ' + channel,
					role: 'weather'
				},
				native: {},
			});
			var base_state_path = device + '.' + channel + '.';

			await this.setObjectAsync(base_state_path + 'time', {
				type: 'state',
				common: {
					name: 'time',
					desc: '',
					type: 'string',
					role: 'text',
					read: true,
					write: false,
					def: ''
				},
				native: {},
			});
			await this.setStateAsync(base_state_path + 'time', time.toString(), true);
			

			//Instant
			for(var key in hour_data['instant']['details']) {
				var unit = key in units ? units[key] : '';
				unit = unit === "celsius" ? '°C' : unit;
				unit = unit === "degrees" ? '°' : unit;

				await this.setObjectAsync(base_state_path + key, {
					type: 'state',
					common: {
						name: key,
						desc: '',
						type: 'number',
						role: 'value',
						read: true,
						write: false,
						unit: unit,
						def: ''
					},
					native: {},
				});
				await this.setStateAsync(base_state_path + key, hour_data['instant']['details'][key], true);
			}
			//Next 1h
			if('next_1_hours' in hour_data){
				var summary1h = hour_data['next_1_hours']['summary']['symbol_code'];

				await this.setObjectAsync(base_state_path + '1h_summary_symbol', {
					type: 'state',
					common: {
						name: '1h_summary_symbol',
						desc: '',
						type: 'string',
						role: 'text',
						read: true,
						write: false,
						def: ''
					},
					native: {},
				});
				await this.setStateAsync(base_state_path + '1h_summary_symbol', '/adapter/yr/icons/' + summary1h+ '.svg', true);
			
				if(summary1h.split('_')[0] in legend){
					await this.setObjectAsync(base_state_path + '1h_summary_text', {
						type: 'state',
						common: {
							name: '1h_summary_text',
							desc: '',
							type: 'string',
							role: 'text',
							read: true,
							write: false,
							def: ''
						},
						native: {},
					});
					await this.setStateAsync(base_state_path + '1h_summary_text', this._(legend[summary1h.split('_')[0]]['desc_en']), true);
				}
				if('details' in hour_data['next_1_hours']){
					for(var key in hour_data['next_1_hours']['details']) {
						var unit = key in units ? units[key] : '';
						unit = unit === "celsius" ? '°C' : unit;
						unit = unit === "degrees" ? '°' : unit;
		
						await this.setObjectAsync(base_state_path + '1h_' + key, {
							type: 'state',
							common: {
								name: key,
								desc: '',
								type: 'number',
								role: 'value',
								read: true,
								write: false,
								unit: unit,
								def: ''
							},
							native: {},
						});
						await this.setStateAsync(base_state_path + '1h_' + key, hour_data['next_1_hours']['details'][key], true);
					}
				}
			}

			//Next 6h
			if('next_6_hours' in hour_data){
				var summary6h = hour_data['next_6_hours']['summary']['symbol_code'];

				await this.setObjectAsync(base_state_path + '6h_summary_symbol', {
					type: 'state',
					common: {
						name: '6h_summary_symbol',
						desc: '',
						type: 'string',
						role: 'text',
						read: true,
						write: false,
						def: ''
					},
					native: {},
				});
				await this.setStateAsync(base_state_path + '6h_summary_symbol', '/adapter/yr/icons/' + summary6h+ '.svg', true);
			
				if(summary6h.split('_')[0] in legend){
					await this.setObjectAsync(base_state_path + '6h_summary_text', {
						type: 'state',
						common: {
							name: '6h_summary_text',
							desc: '',
							type: 'string',
							role: 'text',
							read: true,
							write: false,
							def: ''
						},
						native: {},
					});
					await this.setStateAsync(base_state_path + '6h_summary_text', this._(legend[summary6h.split('_')[0]]['desc_en']), true);
				}
				if('details' in hour_data['next_6_hours']){
					for(var key in hour_data['next_6_hours']['details']) {
						var unit = key in units ? units[key] : '';
						unit = unit === "celsius" ? '°C' : unit;
						unit = unit === "degrees" ? '°' : unit;
		
						await this.setObjectAsync(base_state_path + '6h_' + key, {
							type: 'state',
							common: {
								name: key,
								desc: '',
								type: 'number',
								role: 'value',
								read: true,
								write: false,
								unit: unit,
								def: ''
							},
							native: {},
						});
						await this.setStateAsync(base_state_path + '6h_' + key, hour_data['next_6_hours']['details'][key], true);
					}
				}
			}

			//Next 12h
			if('next_12_hours' in hour_data){
				var summary12h = hour_data['next_12_hours']['summary']['symbol_code'];

				await this.setObjectAsync(base_state_path + '12h_summary_symbol', {
					type: 'state',
					common: {
						name: '12h_summary_symbol',
						desc: '',
						type: 'string',
						role: 'text',
						read: true,
						write: false,
						def: ''
					},
					native: {},
				});
				await this.setStateAsync(base_state_path + '12h_summary_symbol', '/adapter/yr/icons/' + summary12h+ '.svg', true);
			
				if(summary12h.split('_')[0] in legend){
					await this.setObjectAsync(base_state_path + '12h_summary_text', {
						type: 'state',
						common: {
							name: '12h_summary_text',
							desc: '',
							type: 'string',
							role: 'text',
							read: true,
							write: false,
							def: ''
						},
						native: {},
					});
					await this.setStateAsync(base_state_path + '12h_summary_text', this._(legend[summary12h.split('_')[0]]['desc_en']), true);
				}
				if('details' in hour_data['next_12_hours']){
					for(var key in hour_data['next_12_hours']['details']) {
						var unit = key in units ? units[key] : '';
						unit = unit === "celsius" ? '°C' : unit;
						unit = unit === "degrees" ? '°' : unit;
		
						await this.setObjectAsync(base_state_path + '12h_' + key, {
							type: 'state',
							common: {
								name: key,
								desc: '',
								type: 'number',
								role: 'value',
								read: true,
								write: false,
								unit: unit,
								def: ''
							},
							native: {},
						});
						await this.setStateAsync(base_state_path + '12h_' + key, hour_data['next_12_hours']['details'][key], true);
					}
				}
			}
		}
	}

	async main() {
		var forecast_param = "";
		if(this.config.latitude.length > 0 
			&& this.config.longitude.length > 0){
				forecast_param += '?lat=' + this.config.latitude + '&lon=' + this.config.longitude;
				if(this.config.altitude.length > 0){
					forecast_param += '&altitude=79';
				}
				
				const response = await this.client(FORECAST_URL + forecast_param).json();
				await this.updateData(response)

				this.log.info('Data updated.');
		} else {
			this.log.error('Longitude or Latitude not set correctly.');
		}
	}
}


// @ts-ignore parent is a valid property on module
if (module.parent) {
	// Export the constructor in compact mode
	/**
	 * @type Yr
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Yr(options);
} else {
	// otherwise start the instance directly
	new Yr();
}