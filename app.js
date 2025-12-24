const status = document.getElementById('status');
const placesList = document.getElementById('placesList');
const controls = document.getElementById('controls');
const pauseResumeBtn = document.getElementById('pauseResume');
const stopBtn = document.getElementById('stop');
const autoToggle = document.getElementById('autoToggle');
const retryBtn = document.getElementById('retry');

let utterance = null;
let isPaused = false;
let autoInterval = null;

function speak(text) {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;

    utterance.onend = () => {
      controls.classList.add('hidden');
      pauseResumeBtn.textContent = 'Pause';
      isPaused = false;
    };

    speechSynthesis.speak(utterance);
    controls.classList.remove('hidden');
    pauseResumeBtn.textContent = 'Pause';
    isPaused = false;
  } else {
    alert("Text-to-speech not supported in your browser.");
  }
}

pauseResumeBtn.onclick = () => {
  if (isPaused) {
    speechSynthesis.resume();
    pauseResumeBtn.textContent = 'Pause';
    isPaused = false;
  } else {
    speechSynthesis.pause();
    pauseResumeBtn.textContent = 'Resume';
    isPaused = true;
  }
};

stopBtn.onclick = () => {
  speechSynthesis.cancel();
  controls.classList.add('hidden');
  pauseResumeBtn.textContent = 'Pause';
  isPaused = false;
};

async function fetchSummary(title) {
  const encoded = encodeURIComponent(title);
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.extract || "No summary available.";
  } catch (e) {
    return "Sorry, couldn't load the summary.";
  }
}

async function findNearbyWikipedia(lat, lon) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=5000&gslimit=5&format=json&origin=*`;
  
  const res = await fetch(url);
  const data = await res.json();
  const pages = data.query?.geosearch;

  placesList.innerHTML = '';

  if (!pages || pages.length === 0) {
    status.textContent = "No Wikipedia articles found nearby.";
    return;
  }

  status.textContent = `Found ${pages.length} nearby places:`;

  pages.forEach((place) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${place.title}</strong> (${Math.round(place.dist)}m away)
      <button class="place-play">▶ Play Summary</button>
    `;
    const playBtn = li.querySelector('.place-play');
    playBtn.onclick = async () => {
      playBtn.disabled = true;
      playBtn.textContent = "Loading...";
      const summary = await fetchSummary(place.title);
      playBtn.textContent = "▶ Play Summary";
      playBtn.disabled = false;
      speak(summary);
    };
    placesList.appendChild(li);
  });
}

// NEW: Smart location request with permission handling
async function requestLocationPermission() {
  if (!navigator.permissions || !navigator.geolocation) {
    // Fallback for very old browsers
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        () => resolve('denied')
      );
    });
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    
    if (result.state === 'granted') {
      return 'granted';
    } else if (result.state === 'denied') {
      return 'denied';
    } else {
      // 'prompt' — will ask user
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve('granted'),
          () => resolve('denied')
        );
      });
    }
  } catch (e) {
    // Permissions API not supported — fall back to direct request
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        () => resolve('denied')
      );
    });
  }
}

async function getLocation() {
  status.textContent = "Checking location permission...";

  const permissionStatus = await requestLocationPermission();

  if (permissionStatus === 'denied') {
    status.textContent = "Location access is blocked. Please enable it in your browser settings and try again.";
    placesList.innerHTML = '';
    return;
  }

  if (permissionStatus !== 'granted') {
    status.textContent = "Location permission required to find nearby places.";
    placesList.innerHTML = '';
    return;
  }

  // Permission is granted — now get location
  status.textContent = "Getting your location...";

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      await findNearbyWikipedia(lat, lon);
    },
    (error) => {
      status.textContent = "Failed to get location. Please try again.";
      placesList.innerHTML = '';
    },
    { timeout: 15000, enableHighAccuracy: true }
  );
}

autoToggle.onchange = () => {
  if (autoToggle.checked) {
    autoInterval = setInterval(getLocation, 30000);
    getLocation();
  } else {
    if (autoInterval) clearInterval(autoInterval);
  }
};

retryBtn.onclick = getLocation;

// Start on load — only asks permission the first time
getLocation();