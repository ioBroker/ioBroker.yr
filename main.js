/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
const got = require('got');
const fs = require('fs');
const path = require('path');
const http = require('http');
const utils = require('@iobroker/adapter-core'); // Get common adapter utils

const packJson = require('./package.json');
const dictionary = require('./lib/words');

//const LEGEND_URL = 'https://api.met.no/weatherapi/weathericon/2.0/legends'; Packed into legend.json now
const BASE_FORECAST_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/';

// const USER_AGENT = 'ioBroker.yr github.com/ioBroker/ioBroker.yr'

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

        this.runObjectUpdates = false;

        this.client = got.extend({
            headers: {
                'user-agent': `ioBroker.yr/${packJson.version} github.com/ioBroker/ioBroker.yr`
            }
        });
        this.unloaded = false;
    }

    onUnload(callback) {
        this.unloaded = true;
        callback && callback();
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(() => !this.unloaded && resolve(), ms));
    }

    async onReady() {
        if ((!this.config.longitude && this.config.longitude !== 0) || isNaN(this.config.longitude) ||
            (!this.config.latitude && this.config.latitude !== 0) || isNaN(this.config.latitude)
        ) {
            this.log.info('longitude/longitude not set, get data from system');
            try {
                const state = await this.getForeignObjectAsync('system.config');
                this.config.longitude = state.common.longitude;
                this.config.latitude = state.common.latitude;
                this.log.info(`system latitude: ${this.config.latitude} longitude: ${this.config.longitude}`);
            } catch (err) {
                this.log.error(err);
            }
        } else {
            this.log.info(`longitude/longitude will be set by self-Config - longitude: ${this.config.longitude} latitude: ${this.config.latitude}`);
        }
        this.config.language = this.config.language || 'en';
        if (this.config.sendTranslations === undefined) {
            this.config.sendTranslations = true;
        }
        if (this.config.sendTranslations === 'true') {
            this.config.sendTranslations = true;
        }
        if (this.config.sendTranslations === 'false') {
            this.config.sendTranslations = false;
        }

        try {
            const prevVersion = await this.getStateAsync('version') || {val: '0.0.1'};
            this.log.debug(`Configured version: ${JSON.stringify(prevVersion)}`);

            if (this.isNewerVersion(prevVersion.val, this.version)) {
                this.log.info('Newer version detected! Updating objects');
                this.runObjectUpdates = true;

                await this.setStateAsync('version', this.version, true);

                try {
                    const instObj = await this.getForeignObjectAsync(`system.adapter.${this.namespace}`);
                    if (instObj && instObj.common && instObj.common.schedule && instObj.common.schedule === '6 * * * *') {
                        instObj.common.schedule = `${Math.floor(Math.random() * 60)} * * * *`;
                        this.log.info(`Default schedule found and adjusted to spread calls better over the full hour!`);
                        await this.setForeignObjectAsync(`system.adapter.${this.namespace}`, instObj);
                        this.terminate ? this.terminate() : process.exit(0);
                        return;
                    }
                } catch (err) {
                    this.log.error(`Could not check or adjust the schedule: ${err.message}`);
                }
            }
        } catch (ex) {
            this.log.error(ex);
        }

        const delay = Math.floor(Math.random() * 30000);
        this.log.debug(`Delay execution by ${delay}ms to better spread API calls`);
        await this.sleep(delay);

        // Force terminate after 5min
        setTimeout(() => {
            this.unloaded = true;
            this.log.error('force terminate');
            this.terminate ? this.terminate() : process.exit(0);
        }, 300000);

        await this.main();
        this.log.debug('Update of data done, existing ...');
        this.terminate ? this.terminate() : process.exit(0);
    }

    _(text) {
        if (!text) {
            return '';
        }

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
                    //console.log('STATUS: ' + res.statusCode);
                    this.log.info(`Missing translation sent to iobroker.net: "${text}"`);
                });
                req.on('error', e => {
                    this.log.error(`Cannot send to server missing translation for "${text}": ${e.message}`);
                });
                req.end();
            } else {
                this.log.warn(`Translate: "${text}": {"en": "${text}", "de": "${text}", "ru": "${text}"}, please send to developer`);
            }
        }
        return text;
    }

    async updateForecast(data, legend) {
        if (this.unloaded) {
            return;
        }
        //const timeseries = data['properties']['timeseries'];
        const device = 'forecast';
        //Device
        await this.setObjectNotExistsAsync(device, {
            type: 'device',
            common: {
                name: 'forecast',
                role: 'weather'
            },
            native: {},
        });
        const channel = 'info';
        await this.setObjectNotExistsAsync(device + '.' + channel, {
            type: 'channel',
            common: {
                name: 'forecast links and objects',
                role: 'weather'
            },
            native: {},
        });
        const base_state_path = device + '.' + channel + '.';

        await this.setObjectNotExistsAsync(base_state_path + 'object', {
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

        const updated_at = new Date(data['properties']['meta']['updated_at']);
        await this.setObjectNotExistsAsync(base_state_path + 'updated_at', {
            type: 'state',
            common: {
                name: 'Forecast update time',
                desc: '',
                type: 'number',
                role: 'date',
                read: true,
                write: false,
                def: ''
            },
            native: {},
        });

        // Update existing
        if (this.runObjectUpdates) {
            await this.extendObjectAsync(base_state_path + 'updated_at', {
                common: {
                    type: 'number',
                    role: 'date'
                }
            });
        }

        await this.setStateAsync(base_state_path + 'updated_at', updated_at.getTime(), true);

        //TODO Generate Daily Forecast
        //TODO Generate Forecast Table

        /*
        await this.setObjectNotExistsAsync(base_state_path + 'html', {
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

    async updateHourlyForecast(data, legend) {
        if (this.unloaded) {
            return;
        }

        const units = data['properties']['meta']['units'];
        const timeseries = data['properties']['timeseries'];
        const device = 'forecastHourly';
        const now = Date.now();

        //Device
        await this.setObjectNotExistsAsync(device, {
            type: 'device',
            common: {
                name: 'forecast hourly',
                role: 'weather'
            },
            native: {},
        });

        for (const i in timeseries) {
            if (this.unloaded) {
                return;
            }
            const forecast = timeseries[i];
            const dateObj = new Date(forecast['time']);
            const time = dateObj.getTime();
            let hourDiff = Math.ceil((time - now) / (1000 * 60 * 60));
            hourDiff = hourDiff === -0 ? 0 : hourDiff;

            const hour_data = forecast['data'];
            const channel = hourDiff + 'h';

            this.log.debug(`Process Forecast data ${channel}: ${JSON.stringify(hour_data)}`);

            await this.setObjectNotExistsAsync(device + '.' + channel, {
                type: 'channel',
                common: {
                    name: 'in ' + channel,
                    role: 'weather'
                },
                native: {},
            });

            const base_state_path = device + '.' + channel + '.';

            await this.setObjectNotExistsAsync(base_state_path + 'time', {
                type: 'state',
                common: {
                    name: 'time',
                    desc: '',
                    type: 'number',
                    role: 'date',
                    read: true,
                    write: false,
                    def: ''
                },
                native: {},
            });
            // Update existing
            this.extendObjectAsync(base_state_path + 'time', {
                common: {
                    type: 'number',
                    role: 'date'
                }
            });
            await this.setStateAsync(base_state_path + 'time', time, true);

            //Instant
            for (const key in hour_data['instant']['details']) {
                if (this.unloaded) {
                    return;
                }
                let unit = key in units ? units[key] : '';
                const value = hour_data['instant']['details'][key];
                unit = unit === 'celsius' ? '°C' : unit;
                unit = unit === 'degrees' ? '°' : unit;

                await this.setObjectNotExistsAsync(base_state_path + key, {
                    type: 'state',
                    common: {
                        name: key,
                        desc: '',
                        type: 'number',
                        role: 'value',
                        read: true,
                        write: false,
                        unit: unit
                    },
                    native: {},
                });
                await this.setStateAsync(base_state_path + key, parseFloat(value), true);
            }
            //Next 1h
            if ('next_1_hours' in hour_data) {
                const summary1h = hour_data['next_1_hours']['summary']['symbol_code'];

                await this.setObjectNotExistsAsync(base_state_path + '1h_summary_symbol', {
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
                await this.setStateAsync(base_state_path + '1h_summary_symbol', '/adapter/yr/icons/' + summary1h + '.svg', true);

                if (summary1h.split('_')[0] in legend) {
                    await this.setObjectNotExistsAsync(base_state_path + '1h_summary_text', {
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
                if ('details' in hour_data['next_1_hours']) {
                    for (const key in hour_data['next_1_hours']['details']) {
                        let unit = key in units ? units[key] : '';
                        const value = hour_data['next_1_hours']['details'][key];
                        unit = unit === 'celsius' ? '°C' : unit;
                        unit = unit === 'degrees' ? '°' : unit;

                        await this.setObjectNotExistsAsync(base_state_path + '1h_' + key, {
                            type: 'state',
                            common: {
                                name: key,
                                desc: '',
                                type: 'number',
                                role: 'value',
                                read: true,
                                write: false,
                                unit: unit
                            },
                            native: {},
                        });
                        await this.setStateAsync(base_state_path + '1h_' + key, parseFloat(value), true);
                    }
                }
            }

            //Next 6h
            if ('next_6_hours' in hour_data) {
                const summary6h = hour_data['next_6_hours']['summary']['symbol_code'];

                await this.setObjectNotExistsAsync(base_state_path + '6h_summary_symbol', {
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
                await this.setStateAsync(base_state_path + '6h_summary_symbol', `/adapter/yr/icons/${summary6h}.svg`, true);

                if (summary6h.split('_')[0] in legend) {
                    await this.setObjectNotExistsAsync(base_state_path + '6h_summary_text', {
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
                if ('details' in hour_data['next_6_hours']) {
                    for (const key in hour_data['next_6_hours']['details']) {
                        let unit = key in units ? units[key] : '';
                        const value = hour_data['next_6_hours']['details'][key];
                        unit = unit === 'celsius' ? '°C' : unit;
                        unit = unit === 'degrees' ? '°' : unit;

                        await this.setObjectNotExistsAsync(base_state_path + '6h_' + key, {
                            type: 'state',
                            common: {
                                name: key,
                                desc: '',
                                type: 'number',
                                role: 'value',
                                read: true,
                                write: false,
                                unit: unit
                            },
                            native: {},
                        });
                        await this.setStateAsync(base_state_path + '6h_' + key, parseFloat(value), true);
                    }
                }
            }

            //Next 12h
            if ('next_12_hours' in hour_data) {
                const summary12h = hour_data['next_12_hours']['summary']['symbol_code'];

                await this.setObjectNotExistsAsync(base_state_path + '12h_summary_symbol', {
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
                await this.setStateAsync(base_state_path + '12h_summary_symbol', '/adapter/yr/icons/' + summary12h + '.svg', true);

                if (summary12h.split('_')[0] in legend) {
                    await this.setObjectNotExistsAsync(base_state_path + '12h_summary_text', {
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
                if ('details' in hour_data['next_12_hours']) {
                    for (const key in hour_data['next_12_hours']['details']) {
                        if (this.unloaded) {
                            return;
                        }
                        let unit = key in units ? units[key] : '';
                        const value = hour_data['next_12_hours']['details'][key];
                        unit = unit === 'celsius' ? '°C' : unit;
                        unit = unit === 'degrees' ? '°' : unit;

                        await this.setObjectNotExistsAsync(base_state_path + '12h_' + key, {
                            type: 'state',
                            common: {
                                name: key,
                                desc: '',
                                type: 'number',
                                role: 'value',
                                read: true,
                                write: false,
                                unit: unit
                            },
                            native: {},
                        });

                        await this.setStateAsync(base_state_path + '12h_' + key, parseFloat(value), true);
                    }
                }
            }
        }
    }

    async updateData(data) {
        this.log.debug(`Raw data: ${JSON.stringify(data)}`);

        let legend;
        const legendPath = path.join(__dirname, 'legend.json'); // Just store in module path

        try {
            legend = JSON.parse(fs.readFileSync(legendPath, 'utf-8'));
        } catch (err) {
            this.log.info(`Error while loading Legend data: ${err.message}`);
            this.log.info('Please reinstall the adapter!');
            return;
        }

        await this.updateForecast(data, legend);
        await this.updateHourlyForecast(data, legend);
    }

    async main() {
        let forecastParam = '';
        if (
            this.config.latitude !== undefined && this.config.longitude !== undefined &&
            this.config.latitude !== null && this.config.longitude !== null &&
            this.config.latitude !== '' && this.config.longitude !== '' &&
            !isNaN(this.config.latitude) && !isNaN(this.config.longitude)
        ) {
            forecastParam += `?lat=${this.config.latitude}&lon=${this.config.longitude}`;
            if (this.config.altitude !== undefined && !isNaN(this.config.altitude) && this.config.altitude !== '') {
                forecastParam += '&altitude=' + this.config.altitude;
            }

            const method = this.config.compact ? 'compact' : 'complete';
            const url = BASE_FORECAST_URL + method + forecastParam;
            this.log.debug(`Get forecast from: ${url}`);
            let response;
            try {
                response = await this.client(url).json();
            } catch (err) {
                this.log.info(`Error while requesting data: ${err.message}`);
                this.log.info('Please check your settings!');
            }
            if (response) {
                await this.updateData(response);
            }

            this.log.info('Data updated.');
        } else {
            this.log.error('Longitude or Latitude not set correctly.');
        }
    }

    isNewerVersion(oldVer, newVer) {
        const oldParts = oldVer.split('.');
        const newParts = newVer.split('.');
        for (let i = 0; i < newParts.length; i++) {
            const a = ~~newParts[i]; // parse int
            const b = ~~oldParts[i]; // parse int
            if (a > b) return true;
            if (a < b) return false;
        }
        return false;
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
