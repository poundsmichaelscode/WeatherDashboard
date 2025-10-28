
import React, { useEffect, useState, useRef, useCallback } from 'react';


const OPENWEATHER_KEY = "41a7ca8add2d5dfc0810834fbcbcac0c";

// Debounce hook
function useDebouncedCallback(callback, delay) {
  const timer = useRef(null);
  const cb = useRef(callback);
  useEffect(() => { cb.current = callback }, [callback]);

  return useCallback((...args) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => cb.current(...args), delay);
  }, [delay]);
}

export default function WeatherDashboard() {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState('light');
  const [variant, setVariant] = useState(null);
  const [unit, setUnit] = useState(localStorage.getItem('wd_unit') || 'metric'); // 'metric' = °C, 'imperial' = °F

  const lastRequestRef = useRef(0);
  const inFlightRef = useRef(false);

  // Load saved preferences
  useEffect(() => {
    const savedCity = localStorage.getItem('wd_lastCity');
    const savedTheme = localStorage.getItem('wd_theme') || 'light';
    const savedVariant = localStorage.getItem('wd_variant');

    if (savedCity) setCity(savedCity);
    setTheme(savedTheme);
    document.documentElement.dataset.theme = savedTheme;

    if (savedVariant) setVariant(savedVariant);
    else {
      const v = Math.random() > 0.5 ? 'A' : 'B';
      setVariant(v);
      localStorage.setItem('wd_variant', v);
    }
  }, []);

  // Persist preferences
  useEffect(() => {
    localStorage.setItem('wd_theme', theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (city) localStorage.setItem('wd_lastCity', city);
  }, [city]);

  useEffect(() => {
    localStorage.setItem('wd_unit', unit);
  }, [unit]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const toggleUnit = () => setUnit(prev => prev === 'metric' ? 'imperial' : 'metric');

  async function fetchWeatherForCity(q) {
    if (!q.trim()) {
      setError('Please enter a city name.');
      setWeather(null);
      setForecast([]);
      return;
    }

    const now = Date.now();
    if (now - lastRequestRef.current < 700) return;
    lastRequestRef.current = now;
    if (inFlightRef.current) return;

    setLoading(true);
    setError('');
    inFlightRef.current = true;

    try {
      if (!OPENWEATHER_KEY) throw new Error('Missing OpenWeather API key.');

      const base = `https://api.openweathermap.org/data/2.5`;
      const weatherUrl = `${base}/weather?q=${encodeURIComponent(q)}&units=${unit}&appid=${OPENWEATHER_KEY}`;
      const forecastUrl = `${base}/forecast?q=${encodeURIComponent(q)}&units=${unit}&appid=${OPENWEATHER_KEY}`;

      const [wResp, fResp] = await Promise.all([fetch(weatherUrl), fetch(forecastUrl)]);

      if (!wResp.ok) throw new Error('Weather fetch failed.');
      if (!fResp.ok) throw new Error('Forecast fetch failed.');

      const wData = await wResp.json();
      const fData = await fResp.json();

      // Parse 5-day forecast: pick one data point per day (at noon)
      const daily = [];
      const usedDates = new Set();
      fData.list.forEach(item => {
        const date = new Date(item.dt_txt);
        const day = date.toLocaleDateString(undefined, { weekday: 'short' });
        const hour = date.getHours();
        if (hour === 12 && !usedDates.has(day)) {
          usedDates.add(day);
          daily.push({
            day,
            temp: item.main.temp,
            icon: item.weather[0].icon,
            desc: item.weather[0].main
          });
        }
      });

      setWeather(wData);
      setForecast(daily);
    } catch (err) {
      setError(err.message || 'Failed to load weather data.');
      setWeather(null);
      setForecast([]);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }

  const debouncedFetch = useDebouncedCallback((q) => {
    if (!q.trim()) return;
    if (weather && weather.name && weather.name.toLowerCase() === q.trim().toLowerCase()) return;
    fetchWeatherForCity(q.trim());
  }, 800);

  const handleSearchClick = () => fetchWeatherForCity(city.trim());

  const VariantHeader = () => (
    <h2 className="text-lg font-semibold">
      Weather Dashboard — {variant === 'A' ? 'Compact' : 'Rich'} View ({variant})
    </h2>
  );

  const tempUnit = unit === 'metric' ? '°C' : '°F';

  return (
    <div className={`min-h-screen p-6 flex justify-center ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <VariantHeader />
            <p className="text-sm text-gray-500 dark:text-gray-400">A/B variant persisted between sessions.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleTheme} className="px-3 py-1 rounded border">
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
            <button onClick={() => {
              const v = variant === 'A' ? 'B' : 'A';
              setVariant(v);
              localStorage.setItem('wd_variant', v);
            }} className="px-3 py-1 rounded border">Switch Variant</button>
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          <input
            value={city}
            onChange={(e) => { setCity(e.target.value); debouncedFetch(e.target.value); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()}
            placeholder="Search city..."
            className="flex-1 px-3 py-2 border rounded dark:bg-gray-700 dark:text-white"
          />
          <button onClick={handleSearchClick} className="px-4 py-2 bg-blue-600 text-white rounded">Search</button>
          <button onClick={toggleUnit} className="px-3 py-2 border rounded">{unit === 'metric' ? '°C→°F' : '°F→°C'}</button>
        </div>

        <div className="min-h-[140px] border rounded p-4 bg-gray-50 dark:bg-gray-700">
          {loading && (
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-t-transparent border-blue-600 rounded-full animate-spin" />
              <span>Loading weather…</span>
            </div>
          )}

          {!loading && error && <div className="text-red-600">⚠️ {error}</div>}
          {!loading && !error && !weather && <div>No data yet. Try searching for a city.</div>}

          {!loading && weather && (
            <>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-2xl font-bold">{weather.name}, {weather.sys?.country}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{weather.weather[0].main} — {weather.weather[0].description}</p>
                  <p className="mt-1">Temperature: <strong>{Math.round(weather.main.temp)}{tempUnit}</strong></p>
                  <p>Feels like: {Math.round(weather.main.feels_like)}{tempUnit}</p>
                  <p>Humidity: {weather.main.humidity}% | Wind: {weather.wind?.speed} {unit === 'metric' ? 'm/s' : 'mph'}</p>
                </div>
                <img
                  alt={weather.weather[0].description}
                  src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`}
                  width={100}
                  height={100}
                  className="mt-3 md:mt-0"
                />
              </div>

              {forecast.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">5-Day Forecast</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {forecast.map((f, i) => (
                      <div key={i} className="p-3 bg-white dark:bg-gray-800 rounded-lg text-center shadow">
                        <div className="font-bold">{f.day}</div>
                        <img src={`https://openweathermap.org/img/wn/${f.icon}.png`} alt={f.desc} className="mx-auto" />
                        <div>{Math.round(f.temp)}{tempUnit}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{f.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          <p>  Olayenikan Mic</p>
        </div>
      </div>
    </div>
  );
}
