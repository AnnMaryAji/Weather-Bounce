
// Responsive canvas setup
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resizeCanvas() {
  let w = window.innerWidth;
  let h = window.innerHeight;
  let aspect = 480 / 640;
  if (w / h > aspect) {
    canvas.height = h;
    canvas.width = h * aspect;
  } else {
    canvas.width = w;
    canvas.height = w / aspect;
  }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// UI Elements
const welcomeDiv = document.getElementById('welcome');
const startBtn = document.getElementById('start-btn');
const locationBtn = document.getElementById('location-btn');
const citySearch = document.getElementById('city-search');
const errorDiv = document.getElementById('error');

let bgType = 'clear';
let birdY, birdV, gravity = 0.4;
let pipes = [];
let score = 0;
let highScore = 0;
let gameOver = false;
let started = false;
let paused = false;
let selectedCity = 'London';
let locationLabel = '';
let weatherMain = 'Clear';
let weatherTemp = '';
let weatherHumidity = '';
let powerUps = [];
let leaderboard = {}; // city: highScore

// Weather icons (SVG as string for simplicity)
const icons = {
  clear: `<svg width="40" height="40"><circle cx="20" cy="20" r="14" fill="#FFD700"/><circle cx="20" cy="20" r="10" fill="#FFF700" opacity="0.6"/></svg>`,
  clouds: `<svg width="40" height="40"><ellipse cx="20" cy="25" rx="14" ry="9" fill="#d0d0d0"/><ellipse cx="28" cy="22" rx="10" ry="7" fill="#e0e0e0"/></svg>`,
  rain: `<svg width="40" height="40"><ellipse cx="20" cy="25" rx="14" ry="9" fill="#b0c4de"/><ellipse cx="28" cy="22" rx="10" ry="7" fill="#d0e6f7"/><line x1="14" y1="36" x2="14" y2="40" stroke="#5dade2" stroke-width="3"/><line x1="22" y1="36" x2="22" y2="40" stroke="#5dade2" stroke-width="3"/><line x1="30" y1="36" x2="30" y2="40" stroke="#5dade2" stroke-width="3"/></svg>`,
  snow: `<svg width="40" height="40"><ellipse cx="20" cy="25" rx="14" ry="9" fill="#f0f8ff"/><ellipse cx="28" cy="22" rx="10" ry="7" fill="#fff"/><circle cx="14" cy="36" r="2" fill="#bce2ff"/><circle cx="22" cy="37" r="2" fill="#bce2ff"/><circle cx="30" cy="36" r="2" fill="#bce2ff"/></svg>`,
  night: `<svg width="40" height="40"><circle cx="25" cy="17" r="10" fill="#fdf5e6"/><circle cx="16" cy="24" r="5" fill="#191970" opacity="0.6"/><circle cx="33" cy="34" r="2" fill="#fff"/><circle cx="10" cy="33" r="1.5" fill="#fff"/></svg>`
};

const sndJump = new Audio('assets/jump.wav');
const sndScore = new Audio('assets/score.wav');
const sndHit = new Audio('assets/hit.wav');

// Animated background objects
let clouds = [];
let raindrops = [];
let snowflakes = [];
let stars = [];
let sunPos = {x:0, y:0};
let moonPos = {x:0, y:0};

let userApiKey = '';
const apiKeyInput = document.getElementById('api-key-input');


const WEATHER_API = 'https://api.openweathermap.org/data/2.5/weather';
//const API_KEY = '38a81d72802a0d5c8f718f6b7e473fe3';
startBtn.onclick = () => {
  const apiKey = apiKeyInput.value.trim();
  if (apiKey === '') {
    alert('Please enter your OpenWeather API key!');
    return;
  }
  
  userApiKey = apiKey;
  
  // Proceed with game start logic
  let city = citySearch.value.trim();
  if (!city) city = 'London';
  selectedCity = city;
  locationLabel = city;
  getWeatherForCity(city);
};

// UI: Use My Location
locationBtn.onclick = () => {
  errorDiv.textContent = '';
  if (!navigator.geolocation) {
    errorDiv.textContent = "Geolocation not supported.";
    return;
  }
  locationBtn.disabled = true;
  locationBtn.textContent = "Locating...";
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    getWeatherForCoords(latitude, longitude);
    reverseGeocode(latitude, longitude);
  }, () => {
    errorDiv.textContent = "Could not get your location.";
    locationBtn.textContent = "Use My Location";
    locationBtn.disabled = false;
  });
};
citySearch.onkeydown = (e) => {
  if (e.key === 'Enter') startBtn.click();
};

// Weather by city
function getWeatherForCity(city) {
  errorDiv.textContent = '';
  if (!userApiKey) {
    errorDiv.textContent = 'Please enter your API key first!';
    return;
  }

  fetch(`${WEATHER_API}?q=${encodeURIComponent(city)}&units=metric&appid=${userApiKey}`)
    .then(res => res.json())
    .then(data => {
      if (data.cod != 200) {
        errorDiv.textContent = 'City not found. Try another!';
        return;
      }
      setupWeather(data);
    })
    .catch(() => {
      errorDiv.textContent = 'Weather load failed. Try again!';
    });
}

function getWeatherForCoords(lat, lon) {
  if (!userApiKey) {
    errorDiv.textContent = 'Please enter your API key first!';
    return;
  }

  fetch(`${WEATHER_API}?lat=${lat}&lon=${lon}&units=metric&appid=${userApiKey}`)
    .then(res => res.json())
    .then(data => {
      if (data.cod != 200) {
        errorDiv.textContent = 'Weather error, try a city instead!';
        locationBtn.textContent = "Use My Location";
        locationBtn.disabled = false;
        return;
      }
      setupWeather(data);
    })
    .catch(() => {
      errorDiv.textContent = 'Weather load failed. Try again!';
      locationBtn.textContent = "Use My Location";
      locationBtn.disabled = false;
    });
}

function reverseGeocode(lat, lon) {
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
    .then(res => res.json())
    .then(data => {
      if (data.address && data.address.city) {
        locationLabel = data.address.city;
      } else if (data.display_name) {
        locationLabel = data.display_name.split(',')[0];
      } else {
        locationLabel = "Your Location";
      }
    })
    .catch(() => {
      locationLabel = "Your Location";
    });
}
function mapWeather(data) {
  const weather = data.weather[0].main.toLowerCase();
  weatherMain = data.weather[0].main;
  weatherTemp = Math.round(data.main.temp) + "°C";
  weatherHumidity = Math.round(data.main.humidity) + "%";
  const hour = new Date().getHours();
  if (hour < 6 || hour > 19) return 'night';
  if (weather.includes('rain')) return 'rain';
  if (weather.includes('snow')) return 'snow';
  if (weather.includes('cloud')) return 'clouds';
  if (weather.includes('clear')) return 'clear';
  return 'clouds';
}
function setupWeather(data) {
  bgType = mapWeather(data);
  welcomeDiv.style.display = 'none';
  setupAnimatedBackground(bgType);
  loadLeaderboard();
  initGame();
  drawStartScreen();
}
// Animated backgrounds setup
function setupAnimatedBackground(type) {
  clouds = [];
  raindrops = [];
  snowflakes = [];
  stars = [];
  sunPos = {x: canvas.width - 60, y: 60};
  moonPos = {x: canvas.width - 80, y: 80};
  if (type === 'clouds' || type === 'rain' || type === 'snow') {
    for (let i = 0; i < 4; i++) {
      clouds.push({x: Math.random()*canvas.width, y: 40+80*i, speed: 1+Math.random()*1});
    }
  }
  if (type === 'rain') {
    for (let i = 0; i < 30; i++)
      raindrops.push({x: Math.random()*canvas.width, y: Math.random()*canvas.height, speed: 3+Math.random()*2});
  }
  if (type === 'snow') {
    for (let i = 0; i < 20; i++)
      snowflakes.push({x: Math.random()*canvas.width, y: Math.random()*canvas.height, speed: 1+Math.random()*1});
  }
  if (type === 'night') {
    for (let i = 0; i < 50; i++)
      stars.push({x: Math.random()*canvas.width, y: Math.random()*canvas.height*0.6, r: Math.random()*1.5+0.5});
  }
  powerUps = [];
}

function initGame() {
  birdY = canvas.height / 2;
  birdV = 0;
  pipes = [];
  score = 0;
  gameOver = false;
  started = false;
  paused = false;
  powerUps = [];
  document.addEventListener('keydown', handleKeydown);
  canvas.addEventListener('mousedown', handleMouseClick);
}

// Draw start screen
function drawStartScreen() {
  drawAnimatedBackground(bgType);
  drawWeatherIcon(bgType);
  drawBird(80, birdY);
  ctx.fillStyle = 'black';
  ctx.font = Math.round(canvas.height/20) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${locationLabel} Weather`, canvas.width / 2, canvas.height / 4);
  ctx.font = Math.round(canvas.height/27) + 'px Arial';
  ctx.fillText('Press SPACE or CLICK to start', canvas.width / 2, canvas.height / 4 + 40);
  // Weather info
  ctx.font = Math.round(canvas.height/32) + 'px Arial';
  ctx.fillText(`Condition: ${weatherMain}  Temp: ${weatherTemp}  Humidity: ${weatherHumidity}`, canvas.width / 2, canvas.height / 4 + 80);
  // High score
  ctx.fillText(`High Score (${locationLabel}): ${highScore}`, canvas.width / 2, canvas.height / 4 + 120);
  // Pause instructions
  ctx.fillText('Press P to pause/resume during game', canvas.width / 2, canvas.height / 4 + 160);
}

// Animated background for current frame
function drawAnimatedBackground(type) {
  if (type === 'night') ctx.fillStyle = '#191970';
  else if (type === 'rain') ctx.fillStyle = '#778899';
  else if (type === 'snow') ctx.fillStyle = '#f0f8ff';
  else if (type === 'clouds') ctx.fillStyle = '#b0c4de';
  else ctx.fillStyle = '#87ceeb';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Sun
  if (type === 'clear' || type === 'clouds') {
    ctx.beginPath();
    ctx.arc(sunPos.x, sunPos.y, 32, 0, Math.PI * 2);
    ctx.fillStyle = "#FFD700"; ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 12;
    ctx.fill(); ctx.shadowBlur = 0; sunPos.x -= 0.5;
    if(sunPos.x < -32) sunPos.x = canvas.width + 32;
  }
  // Moon
  if (type === 'night') {
    ctx.beginPath();
    ctx.arc(moonPos.x, moonPos.y, 28, 0, Math.PI * 2);
    ctx.fillStyle = "#fdf5e6"; ctx.shadowColor = "#fdf5e6"; ctx.shadowBlur = 18;
    ctx.fill(); ctx.shadowBlur = 0; moonPos.x -= 0.2;
    if(moonPos.x < -28) moonPos.x = canvas.width + 28;
    ctx.fillStyle = "#fff";
    stars.forEach(star => {
      ctx.globalAlpha = Math.random();
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
  }
  // Clouds
  ctx.fillStyle = "#fff";
  clouds.forEach(cloud => {
    drawCloud(cloud.x, cloud.y, 32);
    cloud.x -= cloud.speed; if(cloud.x < -60) cloud.x = canvas.width + 60;
  });
  // Rain
  if (type === 'rain') {
    ctx.strokeStyle = "#5dade2"; ctx.lineWidth = 2;
    raindrops.forEach(drop => {
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y); ctx.lineTo(drop.x, drop.y+12); ctx.stroke();
      drop.y += drop.speed;
      if(drop.y > canvas.height) { drop.x = Math.random()*canvas.width; drop.y = -12; }
    });
  }
  // Snow
  if (type === 'snow') {
    ctx.fillStyle = "#bce2ff";
    snowflakes.forEach(flake => {
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, 4, 0, Math.PI * 2); ctx.fill();
      flake.y += flake.speed;
      if(flake.y > canvas.height) { flake.x = Math.random()*canvas.width; flake.y = -4; }
    });
  }
}
// Draw a cloud (simple three-circle)
function drawCloud(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r, y + r/2, r*0.8, 0, Math.PI * 2);
  ctx.arc(x - r, y + r/2, r*0.8, 0, Math.PI * 2);
  ctx.fill();
}
// Draw weather icon (top-right corner)
function drawWeatherIcon(type) {
  let icon = icons[type] || icons['clear'];
  let img = new Image();
  img.src = "data:image/svg+xml;base64," + btoa(icon);
  img.onload = () => { ctx.drawImage(img, canvas.width - 48, 8, 40, 40); }
  ctx.beginPath();
  ctx.arc(canvas.width - 30, 28, 16, 0, Math.PI * 2);
  ctx.fillStyle = "#FFD700"; ctx.globalAlpha = 0.2;
  ctx.fill(); ctx.globalAlpha = 1.0;
}
// Bird drawing, scaled for canvas
function drawBird(x, y) {
  ctx.save(); ctx.translate(x, y); ctx.scale(canvas.width/480, canvas.height/640);
  ctx.fillStyle = 'yellow';
  ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(10, -10, 7, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
  ctx.beginPath(); ctx.arc(8, 6, 4, 0, Math.PI * 2); ctx.fillStyle = "#ffc"; ctx.fill();
  ctx.restore();
}

// Handle key/mouse input
function handleKeydown(e) {
  if (!started && (e.code === 'Space' || e.code === 'Enter')) {
    started = true; startGame();
  } else if (started && !gameOver && e.code === 'Space' && !paused) {
    birdV = -7; sndJump.play();
  } else if (gameOver && e.code === 'Enter') {
    initGame(); drawStartScreen();
  } else if (started && e.code === 'KeyP') {
    paused = !paused;
    if (!paused) loop();
  }
}
function handleMouseClick() {
  if (!started) { started = true; startGame();
  } else if (started && !gameOver && !paused) {
    birdV = -7; sndJump.play();
  }
}

// Difficulty by weather
function getPipeGapAndSpeed() {
  if (bgType === 'rain') return {gap:canvas.height/6, speed:4.5};
  if (bgType === 'snow') return {gap:canvas.height/5.7, speed:4};
  if (bgType === 'clouds') return {gap:canvas.height/4.7, speed:3.7};
  if (bgType === 'night') return {gap:canvas.height/4.3, speed:4.7};
  return {gap:canvas.height/4, speed:3};
}

// Power-ups
function spawnPowerUp() {
  let type = '';
  if (bgType === 'rain') type = 'umbrella';
  else if (bgType === 'clear') type = 'sunglasses';
  else return;
  powerUps.push({
    type,
    x: canvas.width,
    y: Math.random() * (canvas.height - 80) + 40,
    collected: false
  });
}
function drawPowerUps() {
  powerUps.forEach(pu => {
    if (pu.type === 'umbrella') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pu.x, pu.y, 18, Math.PI, 2*Math.PI);
      ctx.fillStyle = "#5dade2";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(pu.x, pu.y);
      ctx.lineTo(pu.x, pu.y+24);
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    } else if (pu.type === 'sunglasses') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pu.x-7, pu.y, 8, 0, Math.PI*2);
      ctx.arc(pu.x+7, pu.y, 8, 0, Math.PI*2);
      ctx.fillStyle = "#222";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(pu.x-7, pu.y);
      ctx.lineTo(pu.x+7, pu.y);
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    pu.x -= getPipeGapAndSpeed().speed;
  });
}

// Save/load leaderboard
function loadLeaderboard() {
  let lb = localStorage.getItem('flappyWeatherLeaderboard');
  leaderboard = lb ? JSON.parse(lb) : {};
  highScore = leaderboard[selectedCity] || 0;
}
function saveLeaderboard() {
  leaderboard[selectedCity] = Math.max(score, leaderboard[selectedCity] || 0);
  highScore = leaderboard[selectedCity];
  localStorage.setItem('flappyWeatherLeaderboard', JSON.stringify(leaderboard));
}

// Spawn pipes
function spawnPipe() {
  let {gap} = getPipeGapAndSpeed();
  const top = Math.random() * (canvas.height - gap - 100) + 50;
  pipes.push({ x: canvas.width, top, bottom: top + gap, passed: false });
}

// Main game loop
function startGame() {
  birdY = canvas.height / 2;
  birdV = 0;
  pipes = [];
  score = 0;
  gameOver = false;
  started = true;
  paused = false;
  powerUps = [];
  spawnPipe();
  requestAnimationFrame(loop);
}

function loop() {
  if (paused) {
    ctx.font = Math.round(canvas.height/13) + 'px Arial';
    ctx.fillStyle = "#222";
    ctx.textAlign = "center";
    ctx.fillText("Paused", canvas.width/2, canvas.height/2);
    ctx.font = Math.round(canvas.height/27) + 'px Arial';
    ctx.fillText("Press P to resume", canvas.width/2, canvas.height/2+40);
    return;
  }
  drawAnimatedBackground(bgType);
  drawWeatherIcon(bgType);
  drawBird(80, birdY);
  pipes.forEach(pipe => {
    ctx.fillStyle = 'green';
    ctx.fillRect(pipe.x, 0, 60, pipe.top);
    ctx.fillRect(pipe.x, pipe.bottom, 60, canvas.height - pipe.bottom);
  });

  drawPowerUps();

  birdV += gravity;
  birdY += birdV;

  // Collision with pipes
  pipes.forEach(pipe => {
    if (
      80 + 20 > pipe.x &&
      80 - 20 < pipe.x + 60 &&
      (birdY - 20 < pipe.top || birdY + 20 > pipe.bottom)
    ) { gameOver = true; sndHit.play(); }
    if (!pipe.passed && pipe.x + 60 < 80) {
      score++; sndScore.play(); pipe.passed = true;
      if (score % 10 === 0) spawnPowerUp();
    }
  });

  // Collision with ground/ceiling
  if (birdY + 20 > canvas.height || birdY - 20 < 0) { gameOver = true; sndHit.play(); }

  // Collision with power-ups
  powerUps.forEach(pu => {
    if (!pu.collected &&
      Math.abs(80-pu.x)<25 && Math.abs(birdY-pu.y)<25
    ) {
      pu.collected = true; 
      score += 5; sndScore.play(); // Bonus!
    }
  });

  // Move pipes
  let {speed} = getPipeGapAndSpeed();
  pipes.forEach(pipe => pipe.x -= speed);
  if (pipes.length && pipes[0].x < -60) { pipes.shift(); spawnPipe(); }

  // Remove off-screen power-ups
  powerUps = powerUps.filter(pu => pu.x > -30 && !pu.collected);

  // Score and weather info
  ctx.fillStyle = 'black';
  ctx.font = Math.round(canvas.height/20) + 'px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(score, 20, 50);
  ctx.font = Math.round(canvas.height/35) + 'px Arial';
  ctx.fillText(`Temp: ${weatherTemp}  Humidity: ${weatherHumidity}  Condition: ${weatherMain}`, 20, 80);

  if (gameOver) {
    saveLeaderboard();
    ctx.fillStyle = 'red';
    ctx.font = Math.round(canvas.height/13) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
    ctx.font = Math.round(canvas.height/27) + 'px Arial';
    ctx.fillText('Press ENTER to restart', canvas.width / 2, canvas.height / 2 + 40);
    ctx.fillText(`High Score (${locationLabel}): ${highScore}`, canvas.width / 2, canvas.height / 2 + 100);
    started = false;
    return;
  }
  requestAnimationFrame(loop);
}