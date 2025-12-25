const status = document.getElementById('status');
const placesList = document.getElementById('placesList');
const controls = document.getElementById('controls');
const pauseResumeBtn = document.getElementById('pauseResume');
const stopBtn = document.getElementById('stop');
const retryBtn = document.getElementById('retry');

const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeModal = document.querySelector('.close');
const unitsSelect = document.getElementById('units');
const autoCheck = document.getElementById('autoCheck');
const darkModeToggle = document.getElementById('darkMode');
const voiceSelect = document.getElementById('voiceSelect'); // NEW
const saveSettingsBtn = document.getElementById('saveSettings');

let utterance = null;
let isPaused = false;
let autoInterval = null;
let availableVoices = []; // Will hold speechSynthesis voices
let selectedVoiceName = localStorage.getItem('selectedVoice') || ''; // NEW: saved voice

// Load saved settings
let savedUnits = localStorage.getItem('units') || 'metric';
let savedAuto = localStorage.getItem('autoCheck') === 'true';
let savedDark = localStorage.getItem('darkMode') === 'true';

unitsSelect.value = savedUnits;
autoCheck.checked = savedAuto;
darkModeToggle.checked = savedDark;

// Apply dark mode
if (savedDark) {
  document.body.classList.add('dark');
}

// Apply auto-check
if (savedAuto) {
  autoInterval = setInterval(getLocation, 30000);
}

// Populate voices when available
function populateVoiceList() {
  availableVoices = speechSynthesis.getVoices();
  voiceSelect.innerHTML = '<option value="">Default Voice</option>';

  // Filter for English voices and sort by name
  const englishVoices = availableVoices
    .filter(voice => voice.lang.startsWith('en'))
    .sort((a, b) => a.name.localeCompare(b.name));

  englishVoices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    if (voice.name === selectedVoiceName) {
      option.selected = true;
    }
    voiceSelect.appendChild(option);
  });
}

// Load voices (some browsers load asynchronously)
if ('speechSynthesis' in window) {
  populateVoiceList();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
  }
}

function getSelectedVoice() {
  if (!selectedVoiceName) return null;
  return availableVoices.find(voice => voice.name === selectedVoiceName) || null;
}

function formatDistance(meters) {
  if (savedUnits === 'imperial') {
    const yards = meters * 1.09361;
    if (yards < 1000) {
      return Math.round(yards) + ' yards';
    } else {
      const miles = yards / 1760;
      return miles.toFixed(1) + ' miles';
    }
  } else {
    if (meters < 1000) {
      return Math.round(meters) + ' m';
    } else {
      return (meters / 1000).toFixed(1) + ' km';
    }
  }
}

function speak(text) {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;

    const voice = getSelectedVoice();
    if (voice) {
      utterance.voice = voice;
    }

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
      <strong>${place.title}</strong> (${formatDistance(place.dist)} away)
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

// Location permission handling (unchanged)
async function requestLocationPermission() {
  if (!navigator.permissions || !navigator.geolocation) {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        () => resolve('denied')
      );
    });
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    
    if (result.state === 'granted') return 'granted';
    if (result.state === 'denied') return 'denied';

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        () => resolve('denied')
      );
    });
  } catch (e) {
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

// Settings Modal Controls
settingsBtn.onclick = () => {
  // Refresh voice list in case new ones loaded
  populateVoiceList();
  settingsModal.style.display = 'flex';
};

closeModal.onclick = () => {
  settingsModal.style.display = 'none';
};

saveSettingsBtn.onclick = () => {
  const newUnits = unitsSelect.value;
  const newAuto = autoCheck.checked;
  const newDark = darkModeToggle.checked;
  const newVoice = voiceSelect.value; // NEW

  localStorage.setItem('units', newUnits);
  localStorage.setItem('autoCheck', newAuto);
  localStorage.setItem('darkMode', newDark);
  localStorage.setItem('selectedVoice', newVoice); // NEW

  // Update globals
  savedUnits = newUnits;
  savedDark = newDark;
  selectedVoiceName = newVoice; // NEW

  // Apply dark mode
  if (newDark) {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }

  // Handle auto-check
  if (newAuto) {
    if (!autoInterval) autoInterval = setInterval(getLocation, 30000);
    getLocation();
  } else {
    if (autoInterval) clearInterval(autoInterval);
    autoInterval = null;
  }

  settingsModal.style.display = 'none';
  status.textContent = "Settings saved! Refreshing places...";
  getLocation();
};

// Close modal if clicked outside
window.onclick = (event) => {
  if (event.target === settingsModal) {
    settingsModal.style.display = 'none';
  }
};

retryBtn.onclick = getLocation;

// Start on load
getLocation();
