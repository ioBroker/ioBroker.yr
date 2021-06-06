/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
'use strict';

const got = require('got');
const http = require('http');
const utils = require('@iobroker/adapter-core'); // Get common adapter utils

const pjson = require('./package.json');
const dictionary = require(__dirname + '/lib/words');

const LEGEND_URL = 'https://api.met.no/weatherapi/weathericon/2.0/legends';
const BASE_FORECAST_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/';

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
				this.log.info("system latitude: " + this.config.latitude + " longitude: " + this.config.longitude);
			} catch (err){
				this.log.error(err);
			}
		} else {
			this.log.info("longitude/longitude will be set by self-Config - longitude: " + this.config.longitude + " latitude: " + this.config.latitude);
		}
		this.config.language = this.config.language || 'en';
		if (this.config.sendTranslations === undefined) this.config.sendTranslations = true;
		if (this.config.sendTranslations === 'true')  this.config.sendTranslations = true;
		if (this.config.sendTranslations === 'false') this.config.sendTranslations = false;

		this.main();

		// Force terminate after 5min
		setTimeout(() => {
			this.log.error('force terminate');
			process.exit(1);
		}, 300000);
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

	async updateForecast(data, legend){
		var timeseries = data['properties']['timeseries'];
		const device = 'forecast';
		//Device
		await this.setObjectAsync(device, {
			type: 'device',
			common: {
				name: 'forecast',
				role: 'weather'
			},
			native: {},
		});
		var channel = 'info';
		await this.setObjectAsync(device + '.' + channel, {
			type: 'channel',
			common: {
				name: 'forecast links and objects',
				role: 'weather'
			},
			native: {},
		});
		var base_state_path = device + '.' + channel + '.';

		await this.setObjectAsync(base_state_path + 'object', {
			type: 'state',
			common: {
				name: 'forecast object',
				desc: 'forecast object',
				type: 'string',
				role: 'weather.json',
				read: true,
				write: false,
				def: ''
			},
			native: {},
		});
		await this.setStateAsync(base_state_path + 'object', JSON.stringify(data), true);

		var updated_at = new Date(data['properties']['meta']['updated_at']);
		await this.setObjectAsync(base_state_path + 'updated_at', {
			type: 'state',
			common: {
				name: 'Forecast update time',
				desc: '',
				type: 'string',
				role: 'text',
				read: true,
				write: false,
				def: ''
			},
			native: {},
		});
		await this.setStateAsync(base_state_path + 'updated_at', updated_at.toString(), true);

		//TODO Generate Daily Forecast
		//TODO Generate Forecast Table

		/*
		await this.setObjectAsync(base_state_path + 'html', {
			type: 'state',
			common: {
				name: 'forecast html',
				desc: '',
				type: 'string',
				role: 'weather.html',
				read: true,
				write: false,
				def: ''
			},
			native: {},
		});
		await this.setStateAsync(base_state_path + 'html', table, true);
		*/
	}

	async updateHourlyForecast(data, legend){
		const units = data['properties']['meta']['units'];
		var timeseries = data['properties']['timeseries'];
		const device = 'forecastHourly';
		var now = new Date();

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
				var value = hour_data['instant']['details'][key];
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
				await this.setStateAsync(base_state_path + key, value, true);
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
						var value = hour_data['next_1_hours']['details'][key];
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
						await this.setStateAsync(base_state_path + '1h_' + key, value, true);
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
						var value = hour_data['next_6_hours']['details'][key];
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
						await this.setStateAsync(base_state_path + '6h_' + key, value, true);
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
						var value = hour_data['next_12_hours']['details'][key];
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
						await this.setStateAsync(base_state_path + '12h_' + key, value, true);
					}
				}
			}
		}
	}

	async updateData(data){
		this.log.debug('Raw data: ' + JSON.stringify(data));

		const legend = await this.client(LEGEND_URL).json();

		await this.updateForecast(data, legend);
		await this.updateHourlyForecast(data, legend);
	}

	async main() {
		var forecast_param = "";
		if(this.config.latitude.length > 0
			&& this.config.longitude.length > 0){
				forecast_param += '?lat=' + this.config.latitude + '&lon=' + this.config.longitude;
				if(this.config.altitude.length > 0){
					forecast_param += '&altitude=' + this.config.altitude;
				}

				var method = this.config.compact ? "compact" : "complete";
				var url = BASE_FORECAST_URL + method + forecast_param;
				this.log.debug('Get forecast from: ' + url);
				const response = await this.client(url).json();
				await this.updateData(response);

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